package com.agriplanner.controller;

import com.agriplanner.model.PlanningZone;
import com.agriplanner.model.User;
import com.agriplanner.repository.PlanningZoneRepository;
import com.agriplanner.service.MultiAIOrchestrator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.File;
import java.math.BigDecimal;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;

/**
 * REST Controller for Map Image Analysis
 * Xử lý upload ảnh bản đồ và điều phối Multi-AI analysis
 */
@RestController
@RequestMapping("/api/admin/map-image")
@PreAuthorize("hasAnyRole('SYSTEM_ADMIN', 'OWNER')")
public class MapImageAnalysisController {

    private static final Logger logger = LoggerFactory.getLogger(MapImageAnalysisController.class);

    @Autowired
    private MultiAIOrchestrator multiAIOrchestrator;

    @Autowired
    private PlanningZoneRepository planningZoneRepository;

    @Value("${map.image.upload.dir:${user.home}/agriplanner/uploads/map-images}")
    private String uploadDir;

    private final ExecutorService executorService = Executors.newFixedThreadPool(2);

    // Store analysis results temporarily for confirmation
    private final Map<String, Map<String, Object>> analysisResults = new ConcurrentHashMap<>();

    // Store SSE emitters for progress updates
    private final Map<String, SseEmitter> progressEmitters = new ConcurrentHashMap<>();

    /**
     * Start analysis with Server-Sent Events for real-time progress
     * Hỗ trợ 2 loại bản đồ: "soil" (Thổ nhưỡng) và "planning" (Quy hoạch)
     */
    @PostMapping("/analyze")
    public ResponseEntity<?> startAnalysis(
            @RequestParam("image") MultipartFile imageFile,
            @RequestParam(value = "province", defaultValue = "Cà Mau") String province,
            @RequestParam(value = "district", required = false) String district,
            @RequestParam(value = "mapType", defaultValue = "soil") String mapType) {

        logger.info("=== MAP IMAGE ANALYSIS REQUEST ===");
        logger.info("File: {}, Size: {} bytes", imageFile.getOriginalFilename(), imageFile.getSize());
        logger.info("Province: {}, District: {}, MapType: {}", province, district, mapType);

        try {
            // Validate file
            String filename = imageFile.getOriginalFilename();
            if (filename == null || filename.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "error", "Tên file không hợp lệ"));
            }

            String ext = filename.toLowerCase();
            if (!ext.endsWith(".jpg") && !ext.endsWith(".jpeg") && !ext.endsWith(".png")) {
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "error", "Chỉ hỗ trợ file JPG và PNG"));
            }

            // Validate size (max 50MB)
            if (imageFile.getSize() > 50 * 1024 * 1024) {
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "error", "File quá lớn (tối đa 50MB)"));
            }

            // Save file temporarily
            String analysisId = UUID.randomUUID().toString().substring(0, 8);
            Path uploadPath = Paths.get(uploadDir);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }

            // Sanitize filename to avoid Unicode issues with OpenCV
            String sanitizedFilename = sanitizeFilename(filename);
            String savedFilename = analysisId + "_" + sanitizedFilename;
            Path filePath = uploadPath.resolve(savedFilename);
            File targetFile = filePath.toFile();
            Objects.requireNonNull(targetFile, "Target file cannot be null");
            imageFile.transferTo(targetFile);

            logger.info("File saved: {}", filePath);

            // Return analysis ID immediately, process async
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", true);
            response.put("analysisId", analysisId);
            response.put("message", "Đã nhận file, bắt đầu phân tích...");
            response.put("imagePath", filePath.toString());

            // Start async analysis
            executorService.submit(() -> runAnalysisAsync(analysisId, filePath.toFile(), province, district, mapType));

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("Error starting analysis: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "error", "Lỗi xử lý file: " + e.getMessage()));
        }
    }

    /**
     * SSE endpoint for real-time progress updates
     */
    @GetMapping("/analyze/{analysisId}/progress")
    public SseEmitter getAnalysisProgress(@PathVariable String analysisId) {
        logger.info("SSE connection for analysis: {}", analysisId);

        SseEmitter emitter = new SseEmitter(300000L); // 5 minutes timeout

        emitter.onCompletion(() -> {
            progressEmitters.remove(analysisId);
            logger.debug("SSE completed for: {}", analysisId);
        });

        emitter.onTimeout(() -> {
            progressEmitters.remove(analysisId);
            logger.debug("SSE timeout for: {}", analysisId);
        });

        emitter.onError(e -> {
            progressEmitters.remove(analysisId);
            logger.debug("SSE error for {}: {}", analysisId, e.getMessage());
        });

        progressEmitters.put(analysisId, emitter);

        // Send initial event
        try {
            emitter.send(SseEmitter.event()
                    .name("connected")
                    .data(Objects.requireNonNull(Map.of("status", "connected", "analysisId", analysisId))));
        } catch (Exception e) {
            logger.error("Error sending initial SSE event", e);
        }

        return emitter;
    }

    /**
     * Get analysis status and results
     */
    @GetMapping("/analyze/{analysisId}/status")
    public ResponseEntity<?> getAnalysisStatus(@PathVariable String analysisId) {
        Map<String, Object> result = analysisResults.get(analysisId);

        if (result == null) {
            return ResponseEntity.ok(Map.of(
                    "status", "processing",
                    "message", "Đang phân tích..."));
        }

        Boolean success = (Boolean) result.get("success");
        if (success != null && success) {
            return ResponseEntity.ok(Map.of(
                    "status", "completed",
                    "results", result));
        } else {
            return ResponseEntity.ok(Map.of(
                    "status", "failed",
                    "error", result.getOrDefault("error", "Unknown error"),
                    "logs", result.get("logs")));
        }
    }

    /**
     * Confirm and save analysis results to database
     */
    @PostMapping("/analyze/{analysisId}/confirm")
    public ResponseEntity<?> confirmAnalysis(
            @PathVariable String analysisId,
            @RequestBody Map<String, Object> confirmData) {

        logger.info("Confirming analysis: {}", analysisId);

        Map<String, Object> analysisResult = analysisResults.get(analysisId);
        if (analysisResult == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "Không tìm thấy kết quả phân tích"));
        }

        try {
            // Get parameters
            // P0 FIX: Prioritize analysisResult mapType (from analysis), fallback to body
            // then default "planning"
            String mapType = (String) analysisResult.getOrDefault("mapType",
                    confirmData.getOrDefault("mapType", "planning"));
            String province = (String) analysisResult.getOrDefault("province", "Cà Mau");
            String district = (String) analysisResult.get("district");

            @SuppressWarnings("unchecked")
            Map<String, Object> coordinates = (Map<String, Object>) analysisResult.get("coordinates");

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> zones = (List<Map<String, Object>>) analysisResult.get("zones");

            // Get current user
            Long userId = getCurrentUserId();

            // Convert and save zones
            int savedCount = 0;
            if (zones != null && !zones.isEmpty()) {
                for (Map<String, Object> zoneData : zones) {
                    try {
                        PlanningZone zone = convertToZone(zoneData, coordinates, province, district, mapType, userId);
                        PlanningZone saved = planningZoneRepository.save(Objects.requireNonNull(zone));
                        if (saved != null) {
                            savedCount++;
                        }
                    } catch (Exception e) {
                        logger.warn("Error saving zone: {}", e.getMessage());
                    }
                }
            }

            logger.info("Saved {} zones for analysis {}", savedCount, analysisId);

            // Clean up
            analysisResults.remove(analysisId);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "savedZones", savedCount,
                    "message", String.format("Đã lưu %d vùng vào hệ thống", savedCount)));

        } catch (Exception e) {
            logger.error("Error confirming analysis: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "error", "Lỗi lưu dữ liệu: " + e.getMessage()));
        }
    }

    /**
     * Discard analysis results
     */
    @DeleteMapping("/analyze/{analysisId}")
    public ResponseEntity<?> discardAnalysis(@PathVariable String analysisId) {
        analysisResults.remove(analysisId);
        progressEmitters.remove(analysisId);

        logger.info("Discarded analysis: {}", analysisId);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Đã hủy kết quả phân tích"));
    }

    /**
     * Get analysis history
     */
    @GetMapping("/history")
    public ResponseEntity<?> getAnalysisHistory() {
        // Placeholder for history from database
        return ResponseEntity.ok(Map.of(
                "history", Collections.emptyList(),
                "total", 0));
    }

    /**
     * P3 FIX: Cleanup old analysis results (called by scheduler)
     */
    public void cleanupOldAnalysisResults() {
        long now = System.currentTimeMillis();
        long expirationTime = 3600000; // 1 hour
        int removedCount = 0;

        Iterator<Map.Entry<String, Map<String, Object>>> it = analysisResults.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry<String, Map<String, Object>> entry = it.next();
            Map<String, Object> result = entry.getValue();

            // Check if analysis has timestamp
            if (result.containsKey("timestamp") && result.get("timestamp") instanceof Long) {
                long timestamp = (Long) result.get("timestamp");
                if (now - timestamp > expirationTime) {
                    it.remove();
                    removedCount++;
                }
            } else {
                // If no timestamp, effectively give it a TTL from now (or just leave it until
                // size limit)
                // For safety, we'll just add a timestamp now if missing so it gets cleaned up
                // next time
                result.putIfAbsent("timestamp", now);
            }
        }

        if (removedCount > 0) {
            logger.info("Cleaned up {} expired analysis results", removedCount);
        }

        // Secondary check: size limit
        if (analysisResults.size() > 100) {
            analysisResults.clear();
            logger.info("Force cleaned up all cached analysis results (size limit exceeded)");
        }
    }

    // ============ PRIVATE METHODS ============

    private void runAnalysisAsync(String analysisId, File imageFile, String province, String district, String mapType) {
        logger.info("Starting async analysis: {} (mapType: {})", analysisId, mapType);

        try {
            // Create progress callback
            MultiAIOrchestrator.ProgressCallback callback = (step, status, message) -> {
                sendProgressUpdate(analysisId, step, status, message);
            };

            // Run multi-AI orchestration with mapType
            Map<String, Object> result = multiAIOrchestrator.analyzeMapImage(
                    imageFile, province, district, mapType, callback);

            // Store result
            result.put("analysisId", analysisId);
            analysisResults.put(analysisId, result);

            // Send completion event
            sendProgressUpdate(analysisId, "complete",
                    (Boolean) result.getOrDefault("success", false) ? "completed" : "failed",
                    "Phân tích hoàn tất");

            // Close SSE
            SseEmitter emitter = progressEmitters.get(analysisId);
            if (emitter != null) {
                try {
                    emitter.send(SseEmitter.event()
                            .name("complete")
                            .data(result));
                    emitter.complete();
                } catch (Exception e) {
                    logger.debug("Error completing SSE", e);
                }
            }

        } catch (Exception e) {
            logger.error("Async analysis failed: {}", e.getMessage(), e);

            Map<String, Object> errorResult = new HashMap<>();
            errorResult.put("success", false);
            errorResult.put("error", e.getMessage());
            analysisResults.put(analysisId, errorResult);

            sendProgressUpdate(analysisId, "error", "failed", e.getMessage());
        }
    }

    private void sendProgressUpdate(String analysisId, String step, String status, String message) {
        SseEmitter emitter = progressEmitters.get(analysisId);
        if (emitter != null) {
            try {
                Map<String, Object> progressData = new HashMap<>();
                progressData.put("step", step);
                progressData.put("status", status);
                progressData.put("message", message);
                progressData.put("timestamp", System.currentTimeMillis());
                emitter.send(SseEmitter.event()
                        .name("progress")
                        .data(progressData));
            } catch (Exception e) {
                logger.debug("Error sending SSE progress: {}", e.getMessage());
            }
        }
    }

    @SuppressWarnings("unchecked")
    private PlanningZone convertToZone(
            Map<String, Object> zoneData,
            Map<String, Object> coordinates,
            String province,
            String district,
            String mapType,
            Long userId) {

        PlanningZone zone = new PlanningZone();

        // Basic info - Validate name length (max 255 chars)
        String name = (String) zoneData.getOrDefault("name", "Vùng AI");
        zone.setName(name.length() > 255 ? name.substring(0, 255) : name);

        // Notes/Description
        String description = (String) zoneData.get("description");
        zone.setNotes(description);

        // Zone code - AI generated or from standard codes (max 20 chars)
        String aiZoneCode = (String) zoneData.get("zoneCode");
        if (aiZoneCode != null && aiZoneCode.length() <= 20) {
            zone.setZoneCode(aiZoneCode);
        } else {
            zone.setZoneCode("AI_" + UUID.randomUUID().toString().substring(0, 6).toUpperCase());
        }

        // Province/District (max 100 chars each)
        zone.setProvince(province != null && province.length() > 100 ? province.substring(0, 100) : province);
        zone.setDistrict(district != null && district.length() > 100 ? district.substring(0, 100) : district);

        // Map type (max 20 chars) - 'soil' or 'planning'
        zone.setMapType(mapType != null ? mapType.substring(0, Math.min(20, mapType.length())) : "soil");

        // Soil type or zone type - Use zoneType field (max 50 chars)
        String soilType = (String) zoneData.getOrDefault("soilType",
                zoneData.getOrDefault("zoneType", "Unknown"));
        zone.setZoneType(soilType != null && soilType.length() > 50 ? soilType.substring(0, 50) : soilType);
        zone.setLandUsePurpose(soilType != null && soilType.length() > 255 ? soilType.substring(0, 255) : soilType);

        // Color - Use fillColor from Python (fallback to color for backwards compat)
        String color = (String) zoneData.getOrDefault("fillColor",
                zoneData.getOrDefault("color", "#808080"));
        if (color != null && color.matches("^#[0-9A-Fa-f]{6}$")) {
            zone.setFillColor(color);
        } else {
            zone.setFillColor("#808080"); // Default gray
        }
        zone.setStrokeColor("#333333"); // Black border for all zones
        zone.setFillOpacity(new BigDecimal("0.5"));

        // Area calculation - from percentage or boundaryCoordinates
        Object areaPercent = zoneData.get("areaPercent");
        if (areaPercent instanceof Number) {
            // Estimate: 1% = ~10000 m² (rough estimate for province maps)
            double estimatedArea = ((Number) areaPercent).doubleValue() * 10000;
            zone.setAreaSqm(BigDecimal.valueOf(estimatedArea).setScale(2, java.math.RoundingMode.HALF_UP));
        }

        // Boundary coordinates - JSON string from Python (already serialized)
        Object boundaries = zoneData.get("boundaryCoordinates");
        if (boundaries != null) {
            if (boundaries instanceof String) {
                zone.setBoundaryCoordinates((String) boundaries);
            } else if (boundaries instanceof List) {
                try {
                    zone.setBoundaryCoordinates(new com.fasterxml.jackson.databind.ObjectMapper()
                            .writeValueAsString(boundaries));
                } catch (Exception e) {
                    logger.warn("Could not serialize boundary coordinates");
                }
            }
        } else {
            // Create default boundary from center if no boundaries provided
            zone.setBoundaryCoordinates("[]");
        }

        // Center coordinates - directly from Python if available (geo-transformed)
        Number centerLat = (Number) zoneData.get("centerLat");
        Number centerLng = (Number) zoneData.get("centerLng");
        if (centerLat != null && centerLng != null) {
            zone.setCenterLat(BigDecimal.valueOf(centerLat.doubleValue()).setScale(7, java.math.RoundingMode.HALF_UP));
            zone.setCenterLng(BigDecimal.valueOf(centerLng.doubleValue()).setScale(7, java.math.RoundingMode.HALF_UP));
        } else if (coordinates != null) {
            // Fallback: use coordinates from GPT-4o analysis
            Object centerObj = coordinates.get("center");
            if (centerObj instanceof Map) {
                Map<String, Object> center = (Map<String, Object>) centerObj;
                Number lat = (Number) center.get("lat");
                Number lng = (Number) center.get("lng");
                if (lat != null && lng != null) {
                    // Validate coordinates are in Vietnam range
                    double latVal = lat.doubleValue();
                    double lngVal = lng.doubleValue();
                    if (latVal >= 8.0 && latVal <= 24.0 && lngVal >= 102.0 && lngVal <= 110.0) {
                        zone.setCenterLat(BigDecimal.valueOf(latVal).setScale(7, java.math.RoundingMode.HALF_UP));
                        zone.setCenterLng(BigDecimal.valueOf(lngVal).setScale(7, java.math.RoundingMode.HALF_UP));
                    }
                }
            }
        }

        // Metadata
        zone.setCreatedBy(userId);
        zone.setCreatedAt(LocalDateTime.now());
        zone.setUpdatedAt(LocalDateTime.now());
        zone.setSource("AI_MULTI_ANALYSIS");
        zone.setVerified(false);

        return zone;
    }

    private Long getCurrentUserId() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getPrincipal() instanceof User) {
                return ((User) auth.getPrincipal()).getId();
            }
        } catch (Exception e) {
            logger.warn("Could not get current user ID", e);
        }
        // Log warning and use system user for AI-generated zones
        logger.warn("No authenticated user found, using system user ID=1 for AI analysis");
        return 1L; // System/admin user
    }

    /**
     * Sanitize filename to remove Unicode/Vietnamese characters
     * OpenCV has issues with non-ASCII paths on Windows
     */
    private String sanitizeFilename(String filename) {
        if (filename == null)
            return "image.jpg";

        // Get extension
        String ext = "";
        int dotIdx = filename.lastIndexOf('.');
        if (dotIdx > 0) {
            ext = filename.substring(dotIdx).toLowerCase();
            filename = filename.substring(0, dotIdx);
        }

        // Replace Vietnamese characters with ASCII equivalents
        String normalized = java.text.Normalizer.normalize(filename, java.text.Normalizer.Form.NFD);
        String ascii = normalized.replaceAll("[\\p{InCombiningDiacriticalMarks}]", "");

        // Replace spaces and special chars with underscore
        ascii = ascii.replaceAll("[^a-zA-Z0-9_-]", "_");

        // Remove consecutive underscores
        ascii = ascii.replaceAll("_+", "_");

        // Trim underscores from start/end
        ascii = ascii.replaceAll("^_|_$", "");

        // Ensure not empty
        if (ascii.isEmpty()) {
            ascii = "image";
        }

        return ascii + ext;
    }
}
