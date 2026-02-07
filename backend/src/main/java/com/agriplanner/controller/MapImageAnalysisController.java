package com.agriplanner.controller;

import com.agriplanner.model.MapAnalysisHistory;
import com.agriplanner.model.PlanningZone;
import com.agriplanner.model.User;
import com.agriplanner.repository.MapAnalysisHistoryRepository;
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
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import jakarta.annotation.PreDestroy;
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

    @Autowired
    private MapAnalysisHistoryRepository analysisHistoryRepository;

    @Value("${map.image.upload.dir:${user.home}/agriplanner/uploads/map-images}")
    private String uploadDir;

    private final ExecutorService executorService = Executors.newFixedThreadPool(2);

    // Store analysis results temporarily for confirmation
    private final Map<String, Map<String, Object>> analysisResults = new ConcurrentHashMap<>();

    // Store SSE emitters for progress updates
    private final Map<String, SseEmitter> progressEmitters = new ConcurrentHashMap<>();

    @PreDestroy
    public void cleanup() {
        logger.info("Shutting down MapImageAnalysisController executor service...");
        executorService.shutdown();
        try {
            if (!executorService.awaitTermination(30, TimeUnit.SECONDS)) {
                executorService.shutdownNow();
            }
        } catch (InterruptedException e) {
            executorService.shutdownNow();
            Thread.currentThread().interrupt();
        }
        // Close all SSE emitters
        progressEmitters.forEach((id, emitter) -> {
            try {
                emitter.complete();
            } catch (Exception ignored) {
            }
        });
        progressEmitters.clear();
    }

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
     * NEW: Start georeferenced offline analysis with control points
     * Sử dụng OpenCV hoàn toàn offline, không cần AI API
     */
    @PostMapping("/analyze/georef")
    public ResponseEntity<?> startGeorefAnalysis(
            @RequestParam("image") MultipartFile imageFile,
            @RequestParam("controlPoints") String controlPointsJson,
            @RequestParam(value = "province", defaultValue = "Cà Mau") String province,
            @RequestParam(value = "district", required = false) String district,
            @RequestParam(value = "mapType", defaultValue = "soil") String mapType) {

        logger.info("=== GEOREFERENCED ANALYSIS REQUEST ===");
        logger.info("File: {}, Size: {} bytes, MapType: {}",
                imageFile.getOriginalFilename(), imageFile.getSize(), mapType);
        logger.info("ControlPoints JSON length: {}", controlPointsJson != null ? controlPointsJson.length() : 0);

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

            // Parse control points
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> controlPoints = new com.fasterxml.jackson.databind.ObjectMapper()
                    .readValue(controlPointsJson, List.class);

            if (controlPoints == null || controlPoints.size() != 4) {
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "error", "Cần đúng 4 điểm tham chiếu (control points)"));
            }

            // Validate each control point has required fields
            for (int i = 0; i < controlPoints.size(); i++) {
                Map<String, Object> cp = controlPoints.get(i);
                if (cp.get("pixelX") == null || cp.get("pixelY") == null ||
                        cp.get("lat") == null || cp.get("lng") == null) {
                    return ResponseEntity.badRequest().body(Map.of(
                            "success", false,
                            "error", "Điểm tham chiếu " + (i + 1) + " thiếu thông tin (pixelX, pixelY, lat, lng)"));
                }
            }

            // Save file
            String analysisId = UUID.randomUUID().toString().substring(0, 8);
            Path uploadPath = Paths.get(uploadDir);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }

            String sanitizedFilename = sanitizeFilename(filename);
            String savedFilename = analysisId + "_" + sanitizedFilename;
            Path filePath = uploadPath.resolve(savedFilename);
            imageFile.transferTo(java.util.Objects.requireNonNull(filePath.toFile()));

            logger.info("File saved: {}", filePath);

            // Return ID immediately, process async
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", true);
            response.put("analysisId", analysisId);
            response.put("message", "Đã nhận file và 4 điểm tham chiếu, bắt đầu phân tích offline...");
            response.put("imagePath", filePath.toString());
            response.put("offlineMode", true);

            // Start async georeferenced analysis
            final List<Map<String, Object>> finalControlPoints = controlPoints;
            executorService.submit(() -> runGeorefAnalysisAsync(
                    analysisId, filePath.toFile(), finalControlPoints, province, district, mapType));

            return ResponseEntity.ok(response);

        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            logger.error("Invalid control points JSON: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "JSON control points không hợp lệ: " + e.getMessage()));
        } catch (Exception e) {
            logger.error("Error starting georef analysis: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "error", "Lỗi xử lý: " + e.getMessage()));
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
     * Get analysis history from database
     * Combines persisted history with in-memory pending analyses
     */
    @GetMapping("/analyze/history")
    public ResponseEntity<?> getAnalysisHistory() {
        logger.info("Getting analysis history from database");

        List<Map<String, Object>> history = new ArrayList<>();

        // 1. Get persisted history from database
        try {
            List<MapAnalysisHistory> dbHistory = analysisHistoryRepository.findAllByOrderByCreatedAtDesc();
            for (MapAnalysisHistory h : dbHistory) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("analysisId", h.getAnalysisId());
                item.put("timestamp", h.getCreatedAt());
                item.put("mapType", h.getMapType());
                item.put("province", h.getProvince());
                item.put("district", h.getDistrict());
                item.put("status", h.getStatus());
                item.put("zoneCount", h.getZoneCount() != null ? h.getZoneCount() : 0);
                item.put("notes", h.getNotes());
                item.put("persisted", true); // Mark as from database
                history.add(item);
            }
        } catch (Exception e) {
            logger.warn("Error reading history from database: {}", e.getMessage());
        }

        // 2. Add in-memory pending analyses (not yet confirmed)
        Set<String> persistedIds = new HashSet<>();
        history.forEach(h -> persistedIds.add((String) h.get("analysisId")));

        analysisResults.forEach((id, result) -> {
            if (!persistedIds.contains(id)) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("analysisId", id);
                item.put("timestamp", result.get("timestamp"));
                item.put("mapType", result.get("mapType"));
                item.put("province", result.get("province"));
                item.put("district", result.get("district"));
                item.put("status", result.getOrDefault("status", "pending"));

                // Add zone count if available
                if (result.containsKey("zones")) {
                    List<?> zones = (List<?>) result.get("zones");
                    item.put("zoneCount", zones != null ? zones.size() : 0);
                }
                item.put("persisted", false); // Mark as in-memory only
                history.add(item);
            }
        });

        // Sort by timestamp descending (newest first)
        history.sort((a, b) -> {
            Object timeA = a.get("timestamp");
            Object timeB = b.get("timestamp");
            if (timeA instanceof LocalDateTime && timeB instanceof LocalDateTime) {
                return ((LocalDateTime) timeB).compareTo((LocalDateTime) timeA);
            }
            return 0;
        });

        return ResponseEntity.ok(Map.of(
                "success", true,
                "history", history,
                "totalCount", history.size()));
    }

    /**
     * Delete analysis result and associated zones
     * Removes from both in-memory cache and database
     */
    @DeleteMapping("/analyze/{analysisId}")
    @Transactional
    public ResponseEntity<?> deleteAnalysisResult(@PathVariable String analysisId) {
        java.util.Objects.requireNonNull(analysisId, "Analysis ID must not be null");
        logger.info("Deleting analysis result: {}", analysisId);

        int deletedZones = 0;
        boolean removedFromMemory = false;
        boolean removedFromDb = false;

        // 1. Remove from in-memory cache
        Map<String, Object> removed = analysisResults.remove(analysisId);
        if (removed != null) {
            removedFromMemory = true;
        }

        // 2. Remove from SSE emitters
        SseEmitter emitter = progressEmitters.remove(analysisId);
        if (emitter != null) {
            try {
                emitter.complete();
            } catch (Exception ignored) {
            }
        }

        // 3. Delete associated zones from database
        try {
            long zoneCount = planningZoneRepository.countByAnalysisId(analysisId);
            if (zoneCount > 0) {
                planningZoneRepository.deleteByAnalysisId(analysisId);
                deletedZones = (int) zoneCount;
                logger.info("Deleted {} zones for analysis {}", deletedZones, analysisId);
            }
        } catch (Exception e) {
            logger.warn("Error deleting zones for analysis {}: {}", analysisId, e.getMessage());
        }

        // 4. Delete from history database
        try {
            if (analysisHistoryRepository.existsById(analysisId)) {
                analysisHistoryRepository.deleteById(analysisId);
                removedFromDb = true;
                logger.info("Deleted history record for analysis {}", analysisId);
            }
        } catch (Exception e) {
            logger.warn("Error deleting history for analysis {}: {}", analysisId, e.getMessage());
        }

        if (removedFromMemory || removedFromDb || deletedZones > 0) {
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", String.format("Đã xóa kết quả phân tích và %d vùng liên quan", deletedZones),
                    "deletedZones", deletedZones));
        } else {
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Kết quả phân tích không tồn tại hoặc đã được xóa"));
        }
    }

    /**
     * Delete all planning zones from database
     */
    @DeleteMapping("/zones/all")
    public ResponseEntity<?> deleteAllPlanningZones() {
        logger.info("Deleting all planning zones from database");

        try {
            long count = planningZoneRepository.count();
            planningZoneRepository.deleteAll();

            // Also clear in-memory analysis results
            analysisResults.clear();

            logger.info("Deleted {} planning zones", count);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Đã xóa " + count + " vùng quy hoạch",
                    "deletedCount", count));
        } catch (Exception e) {
            logger.error("Failed to delete planning zones: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "error", "Lỗi xóa vùng quy hoạch: " + e.getMessage()));
        }
    }

    /**
     * Confirm and save analysis results to database
     * Also saves analysis history for admin management
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

            // === Duplicate location check ===
            if (coordinates != null) {
                @SuppressWarnings("unchecked")
                Map<String, Object> swCheck = (Map<String, Object>) coordinates.get("sw");
                @SuppressWarnings("unchecked")
                Map<String, Object> neCheck = (Map<String, Object>) coordinates.get("ne");
                if (swCheck != null && neCheck != null) {
                    double swLat = ((Number) swCheck.get("lat")).doubleValue();
                    double swLng = ((Number) swCheck.get("lng")).doubleValue();
                    double neLat = ((Number) neCheck.get("lat")).doubleValue();
                    double neLng = ((Number) neCheck.get("lng")).doubleValue();

                    List<MapAnalysisHistory> overlapping = analysisHistoryRepository
                            .findOverlappingAnalyses(mapType, swLat, swLng, neLat, neLng);

                    if (!overlapping.isEmpty()) {
                        MapAnalysisHistory existing = overlapping.get(0);
                        String msg = String.format(
                                "Vị trí này đã được phân tích trước đó (ID: %s, ngày: %s, %d vùng). " +
                                "Vui lòng xóa bản đồ cũ trước khi lưu bản đồ mới cùng vị trí.",
                                existing.getAnalysisId(),
                                existing.getCreatedAt() != null ? existing.getCreatedAt().toLocalDate().toString() : "N/A",
                                existing.getZoneCount() != null ? existing.getZoneCount() : 0);
                        logger.warn("Duplicate location detected for {} analysis: overlaps with {}",
                                mapType, existing.getAnalysisId());
                        return ResponseEntity.badRequest().body(Map.of(
                                "success", false,
                                "error", msg,
                                "duplicateLocation", true,
                                "existingAnalysisId", existing.getAnalysisId()));
                    }
                }
            }

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> zones = (List<Map<String, Object>>) analysisResult.get("zones");

            // Get current user
            Long userId = getCurrentUserId();

            // Save zones one by one (each in its own flush to avoid transaction rollback cascade)
            int savedCount = 0;
            int errorCount = 0;
            if (zones != null && !zones.isEmpty()) {
                for (Map<String, Object> zoneData : zones) {
                    try {
                        PlanningZone zone = convertToZone(zoneData, coordinates, province, district, mapType, userId);
                        zone.setAnalysisId(analysisId);
                        planningZoneRepository.saveAndFlush(zone);
                        savedCount++;
                    } catch (Exception e) {
                        errorCount++;
                        logger.warn("Error saving zone {}/{}: {} - {}",
                            errorCount, zones.size(), e.getClass().getSimpleName(), e.getMessage());
                        if (errorCount <= 3) {
                            logger.debug("Zone save error detail:", e);
                        }
                    }
                }
            }

            logger.info("Saved {}/{} zones for analysis {} ({} errors)",
                savedCount, zones != null ? zones.size() : 0, analysisId, errorCount);

            // Save analysis history to database
            try {
                MapAnalysisHistory history = new MapAnalysisHistory();
                history.setAnalysisId(analysisId);
                history.setCreatedAt(LocalDateTime.now());
                history.setMapType(mapType);
                history.setProvince(province);
                history.setDistrict(district);
                history.setZoneCount(savedCount);
                history.setStatus("completed");
                history.setUserId(userId);
                history.setOriginalImagePath((String) analysisResult.get("imagePath"));
                history.setNotes((String) confirmData.get("notes"));

                // Save geo bounds if available (from georef analysis)
                if (coordinates != null) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> sw = (Map<String, Object>) coordinates.get("sw");
                    @SuppressWarnings("unchecked")
                    Map<String, Object> ne = (Map<String, Object>) coordinates.get("ne");
                    if (sw != null && ne != null) {
                        history.setBoundsSWLat(((Number) sw.get("lat")).doubleValue());
                        history.setBoundsSWLng(((Number) sw.get("lng")).doubleValue());
                        history.setBoundsNELat(((Number) ne.get("lat")).doubleValue());
                        history.setBoundsNELng(((Number) ne.get("lng")).doubleValue());
                    }
                }

                // Save control points if available
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> controlPoints = (List<Map<String, Object>>) analysisResult.get("controlPoints");
                if (controlPoints != null && controlPoints.size() == 4) {
                    for (int i = 0; i < 4; i++) {
                        Map<String, Object> cp = controlPoints.get(i);
                        Number pxX = (Number) cp.get("pixelX");
                        Number pxY = (Number) cp.get("pixelY");
                        Number lat = (Number) cp.get("lat");
                        Number lng = (Number) cp.get("lng");
                        switch (i) {
                            case 0:
                                if (pxX != null) history.setPoint1PixelX(pxX.intValue());
                                if (pxY != null) history.setPoint1PixelY(pxY.intValue());
                                if (lat != null) history.setPoint1Lat(lat.doubleValue());
                                if (lng != null) history.setPoint1Lng(lng.doubleValue());
                                break;
                            case 1:
                                if (pxX != null) history.setPoint2PixelX(pxX.intValue());
                                if (pxY != null) history.setPoint2PixelY(pxY.intValue());
                                if (lat != null) history.setPoint2Lat(lat.doubleValue());
                                if (lng != null) history.setPoint2Lng(lng.doubleValue());
                                break;
                            case 2:
                                if (pxX != null) history.setPoint3PixelX(pxX.intValue());
                                if (pxY != null) history.setPoint3PixelY(pxY.intValue());
                                if (lat != null) history.setPoint3Lat(lat.doubleValue());
                                if (lng != null) history.setPoint3Lng(lng.doubleValue());
                                break;
                            case 3:
                                if (pxX != null) history.setPoint4PixelX(pxX.intValue());
                                if (pxY != null) history.setPoint4PixelY(pxY.intValue());
                                if (lat != null) history.setPoint4Lat(lat.doubleValue());
                                if (lng != null) history.setPoint4Lng(lng.doubleValue());
                                break;
                        }
                    }
                }

                // Calculate and save total area in hectares
                double totalHa = 0;
                if (zones != null) {
                    for (Map<String, Object> z : zones) {
                        Number ha = (Number) z.get("areaHectares");
                        if (ha != null) totalHa += ha.doubleValue();
                    }
                }
                if (totalHa > 0) {
                    history.setTotalAreaHectares(Math.round(totalHa * 100.0) / 100.0);
                }

                analysisHistoryRepository.saveAndFlush(history);
                logger.info("Saved analysis history for {} with {} zones, {} ha", analysisId, savedCount, totalHa);
            } catch (Exception e) {
                logger.warn("Error saving analysis history: {}", e.getMessage());
                // Don't fail the whole operation if history save fails
            }

            // Clean up in-memory cache
            analysisResults.remove(analysisId);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "savedZones", savedCount,
                    "analysisId", analysisId,
                    "message", String.format("Đã lưu %d vùng vào hệ thống", savedCount)));

        } catch (Exception e) {
            logger.error("Error confirming analysis: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "error", "Lỗi lưu dữ liệu: " + e.getMessage()));
        }
    }

    // discardAnalysis and old getAnalysisHistory moved to new methods above

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

    /**
     * NEW: Async worker for georeferenced analysis using advanced_zone_detector.py
     */
    private void runGeorefAnalysisAsync(String analysisId, File imageFile,
            List<Map<String, Object>> controlPoints, String province, String district, String mapType) {

        logger.info("Starting async georeferenced analysis: {} (mapType: {})", analysisId, mapType);

        try {
            // Create progress callback
            MultiAIOrchestrator.ProgressCallback callback = (step, status, message) -> {
                sendProgressUpdate(analysisId, step, status, message);
            };

            // Run georeferenced analysis (offline, no AI API)
            Map<String, Object> result = multiAIOrchestrator.analyzeWithGeoreferencing(
                    imageFile, controlPoints, province, district, mapType, callback);

            // Store result
            result.put("analysisId", analysisId);
            result.put("timestamp", System.currentTimeMillis());
            result.put("mapType", mapType);
            result.put("province", province);
            result.put("district", district);
            // Ensure coordinates key is set for frontend compatibility
            if (!result.containsKey("coordinates") && result.containsKey("bounds")) {
                result.put("coordinates", result.get("bounds"));
            }
            analysisResults.put(analysisId, result);

            // Send completion event
            sendProgressUpdate(analysisId, "complete",
                    (Boolean) result.getOrDefault("success", false) ? "completed" : "failed",
                    "Phân tích hoàn tất");

            // Close SSE with result
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
            logger.error("Async georef analysis failed: {}", e.getMessage(), e);

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
        if (soilType == null || soilType.trim().isEmpty()) soilType = "Unknown";
        zone.setZoneType(soilType.length() > 50 ? soilType.substring(0, 50) : soilType);
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

        // Area calculation - prefer Python-calculated areaSqm/areaHectares, fallback to percentage estimate
        Object areaSqm = zoneData.get("areaSqm");
        Object areaM2 = zoneData.get("areaM2");
        Object areaHectares = zoneData.get("areaHectares");
        if (areaSqm instanceof Number && ((Number) areaSqm).doubleValue() > 0) {
            zone.setAreaSqm(BigDecimal.valueOf(((Number) areaSqm).doubleValue()).setScale(2, java.math.RoundingMode.HALF_UP));
        } else if (areaM2 instanceof Number && ((Number) areaM2).doubleValue() > 0) {
            zone.setAreaSqm(BigDecimal.valueOf(((Number) areaM2).doubleValue()).setScale(2, java.math.RoundingMode.HALF_UP));
        } else if (areaHectares instanceof Number && ((Number) areaHectares).doubleValue() > 0) {
            double m2 = ((Number) areaHectares).doubleValue() * 10000;
            zone.setAreaSqm(BigDecimal.valueOf(m2).setScale(2, java.math.RoundingMode.HALF_UP));
        } else {
            Object areaPercent = zoneData.get("areaPercent");
            if (areaPercent instanceof Number) {
                // Estimate: use geo bounds if available for better accuracy
                double estimatedArea = ((Number) areaPercent).doubleValue() * 10000;
                zone.setAreaSqm(BigDecimal.valueOf(estimatedArea).setScale(2, java.math.RoundingMode.HALF_UP));
            }
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

        // IMAGE OVERLAY MODE: Set imageUrl if this is an overlay zone
        String imageUrl = (String) zoneData.get("imageUrl");
        if (imageUrl != null && !imageUrl.isEmpty()) {
            zone.setImageUrl(imageUrl);
            logger.info("Set imageUrl for zone: {}", imageUrl);
        }

        // Handle fillOpacity from Python
        Number fillOpacity = (Number) zoneData.get("fillOpacity");
        if (fillOpacity != null) {
            zone.setFillOpacity(
                    BigDecimal.valueOf(fillOpacity.doubleValue()).setScale(2, java.math.RoundingMode.HALF_UP));
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

    // ===========================================
    // HISTORY & ROLLBACK ENDPOINTS (Phase 6)
    // ===========================================

    /**
     * Get analysis history list (simple version for Phase 6 rollback UI)
     */
    @GetMapping("/history")
    public ResponseEntity<?> getAnalysisHistorySimple() {
        try {
            // Sort by createdAt desc
            List<MapAnalysisHistory> history = analysisHistoryRepository.findAll(
                    org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC,
                            "createdAt"));
            return ResponseEntity.ok(Map.of("success", true, "history", history));
        } catch (Exception e) {
            logger.error("Error fetching history: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    /**
     * Delete/Rollback an analysis
     * This removes all zones created by this analysis and the history record itself
     */
    @DeleteMapping("/history/{analysisId}")
    @Transactional
    public ResponseEntity<?> rollbackAnalysis(@PathVariable String analysisId) {
        logger.info("Rolling back analysis: {}", analysisId);
        try {
            Optional<MapAnalysisHistory> historyOpt = analysisHistoryRepository
                    .findById(java.util.Objects.requireNonNull(analysisId));
            if (historyOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            // 1. Delete all planning zones associated with this analysis
            long zonesDeleted = planningZoneRepository.countByAnalysisId(analysisId);
            planningZoneRepository.deleteByAnalysisId(analysisId);
            logger.info("Deleted {} zones for analysis {}", zonesDeleted, analysisId);

            // 2. Delete the history record
            analysisHistoryRepository.deleteById(java.util.Objects.requireNonNull(analysisId));

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Đã xóa lịch sử và " + zonesDeleted + " vùng quy hoạch liên quan",
                    "deletedZones", zonesDeleted));

        } catch (Exception e) {
            logger.error("Error rolling back analysis {}: {}", analysisId, e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of("success", false, "error", e.getMessage()));
        }
    }
}
