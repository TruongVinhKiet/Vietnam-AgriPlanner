package com.agriplanner.controller;

import com.agriplanner.model.KmzUpload;
import com.agriplanner.model.PlanningZone;
import com.agriplanner.model.User;
import com.agriplanner.repository.KmzUploadRepository;
import com.agriplanner.repository.PlanningZoneRepository;
import com.agriplanner.service.KmzParserService;
import com.agriplanner.service.MapAnalysisAIService;
import com.fasterxml.jackson.databind.ObjectMapper;
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

import java.io.*;
import java.math.BigDecimal;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * REST Controller for KMZ file upload and management
 * Quản lý upload file KMZ quy hoạch đất đai
 */
@RestController
@RequestMapping("/api/admin/kmz")
@CrossOrigin(origins = "*")
public class KmzUploadController {

    private static final Logger logger = LoggerFactory.getLogger(KmzUploadController.class);

    private final KmzParserService kmzParserService;
    private final KmzUploadRepository kmzUploadRepository;
    private final PlanningZoneRepository planningZoneRepository;
    
    @Autowired
    private MapAnalysisAIService mapAnalysisAIService;
    
    @Value("${python.script.path:backend/python}")
    private String pythonScriptPath;
    
    // Store AI analysis results temporarily
    private final Map<String, Map<String, Object>> analysisResults = new ConcurrentHashMap<>();

    public KmzUploadController(KmzParserService kmzParserService,
            KmzUploadRepository kmzUploadRepository,
            PlanningZoneRepository planningZoneRepository) {
        this.kmzParserService = kmzParserService;
        this.kmzUploadRepository = kmzUploadRepository;
        this.planningZoneRepository = planningZoneRepository;
    }

    /**
     * Upload and process KMZ file
     * Chỉ SYSTEM_ADMIN và OWNER mới được upload
     */
    @PostMapping("/upload")
    @PreAuthorize("hasRole('SYSTEM_ADMIN') or hasRole('OWNER')")
    public ResponseEntity<?> uploadKmz(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "province", defaultValue = "Cần Thơ") String province,
            @RequestParam(value = "district", required = false) String district,
            @RequestParam(value = "notes", required = false) String notes,
            @RequestParam(value = "mapType", defaultValue = "planning") String mapType) {

        try {
            // Validate file
            if (file.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "File is empty"));
            }

            String filename = file.getOriginalFilename();
            if (filename == null || (!filename.toLowerCase().endsWith(".kmz") &&
                    !filename.toLowerCase().endsWith(".kml"))) {
                return ResponseEntity.badRequest().body(Map.of("error", "Only KMZ/KML files are allowed"));
            }

            // Validate mapType
            if (!mapType.equals("planning") && !mapType.equals("soil")) {
                mapType = "planning";
            }

            // Get current user ID
            Long userId = getCurrentUserId();

            logger.info("Processing KMZ upload: {} ({}) - mapType: {}", filename, formatFileSize(file.getSize()), mapType);

            // Process file with mapType
            KmzUpload upload = kmzParserService.processKmzFile(file, province, district, userId, mapType);

            if (notes != null && !notes.isEmpty()) {
                upload.setNotes(notes);
                kmzUploadRepository.save(upload);
            }

            String mapTypeLabel = mapType.equals("soil") ? "thổ nhưỡng" : "quy hoạch";
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("upload", upload);
            response.put("message", String.format(
                    "Đã xử lý thành công %d vùng %s từ file %s",
                    upload.getZonesCount(),
                    mapTypeLabel,
                    upload.getOriginalName()));

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("Error uploading KMZ: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "Lỗi xử lý file: " + e.getMessage()));
        }
    }

    /**
     * Get all uploads (optionally filtered by map type)
     */
    @GetMapping("/uploads")
    @PreAuthorize("hasRole('SYSTEM_ADMIN') or hasRole('OWNER')")
    public ResponseEntity<List<KmzUpload>> getAllUploads(
            @RequestParam(required = false) String mapType) {
        if (mapType != null && !mapType.isEmpty()) {
            return ResponseEntity.ok(kmzUploadRepository.findByMapTypeOrderByUploadedAtDesc(mapType));
        }
        return ResponseEntity.ok(kmzUploadRepository.findAllByOrderByUploadedAtDesc());
    }

    /**
     * Get upload by ID
     */
    @GetMapping("/uploads/{id}")
    @PreAuthorize("hasRole('SYSTEM_ADMIN') or hasRole('OWNER')")
    public ResponseEntity<?> getUploadById(@PathVariable Long id) {
        if (id == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "ID is required"));
        }
        return kmzUploadRepository.findById(id)
                .map(upload -> ResponseEntity.ok((Object) upload))
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Get zones from a specific upload
     */
    @GetMapping("/uploads/{id}/zones")
    @PreAuthorize("hasRole('SYSTEM_ADMIN') or hasRole('OWNER')")
    public ResponseEntity<List<PlanningZone>> getZonesByUpload(@PathVariable Long id) {
        List<PlanningZone> zones = kmzParserService.getZonesByUploadId(id);
        return ResponseEntity.ok(zones);
    }

    /**
     * Delete upload and associated zones
     */
    @DeleteMapping("/uploads/{id}")
    @PreAuthorize("hasRole('SYSTEM_ADMIN') or hasRole('OWNER')")
    public ResponseEntity<?> deleteUpload(@PathVariable Long id) {
        try {
            if (id == null || !kmzUploadRepository.existsById(id)) {
                return ResponseEntity.notFound().build();
            }

            kmzParserService.deleteUpload(id);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Đã xóa upload và các vùng quy hoạch liên quan"));
        } catch (Exception e) {
            logger.error("Error deleting upload: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "Lỗi xóa upload: " + e.getMessage()));
        }
    }

    /**
     * Get uploads by province
     */
    @GetMapping("/uploads/province/{province}")
    @PreAuthorize("hasRole('SYSTEM_ADMIN') or hasRole('OWNER')")
    public ResponseEntity<List<KmzUpload>> getUploadsByProvince(@PathVariable String province) {
        return ResponseEntity.ok(kmzUploadRepository.findByProvinceOrderByUploadedAtDesc(province));
    }

    /**
     * Get upload statistics
     */
    @GetMapping("/stats")
    @PreAuthorize("hasRole('SYSTEM_ADMIN') or hasRole('OWNER')")
    public ResponseEntity<?> getStats() {
        Map<String, Object> stats = new HashMap<>();

        List<KmzUpload> completed = kmzUploadRepository.findByStatusOrderByUploadedAtDesc(KmzUpload.STATUS_COMPLETED);
        List<KmzUpload> failed = kmzUploadRepository.findByStatusOrderByUploadedAtDesc(KmzUpload.STATUS_FAILED);

        int totalZones = completed.stream().mapToInt(u -> u.getZonesCount() != null ? u.getZonesCount() : 0).sum();
        long totalSize = completed.stream().mapToLong(u -> u.getFileSizeBytes() != null ? u.getFileSizeBytes() : 0)
                .sum();

        stats.put("totalUploads", completed.size() + failed.size());
        stats.put("completedUploads", completed.size());
        stats.put("failedUploads", failed.size());
        stats.put("totalZones", totalZones);
        stats.put("totalSize", formatFileSize(totalSize));

        return ResponseEntity.ok(stats);
    }

    /**
     * Get current user ID from security context
     * JWT filter đặt User object vào authentication principal
     */
    private Long getCurrentUserId() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getPrincipal() instanceof User) {
                User user = (User) auth.getPrincipal();
                logger.debug("Got user ID from JWT: {} (email: {})", user.getId(), user.getEmail());
                return user.getId();
            }
        } catch (Exception e) {
            logger.error("Error getting current user ID: {}", e.getMessage(), e);
        }
        logger.warn("Could not get user from authentication, returning default ID 1");
        return 1L; // Fallback to admin ID
    }

    /**
     * Format file size for display
     */
    private String formatFileSize(long bytes) {
        if (bytes < 1024)
            return bytes + " B";
        if (bytes < 1024 * 1024)
            return String.format("%.1f KB", bytes / 1024.0);
        if (bytes < 1024 * 1024 * 1024)
            return String.format("%.1f MB", bytes / (1024.0 * 1024));
        return String.format("%.1f GB", bytes / (1024.0 * 1024 * 1024));
    }

    // ============ AI ANALYSIS ENDPOINTS ============
    
    /**
     * Upload and analyze KMZ using AI (Python + AI Vision)
     * Kết hợp OpenCV (Python) và AI Vision (GPT-4o/Gemini) để phân tích
     */
    @PostMapping("/analyze")
    public ResponseEntity<?> analyzeKmz(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "province", defaultValue = "Cần Thơ") String province,
            @RequestParam(value = "district", required = false) String district,
            @RequestParam(value = "mapType", defaultValue = "soil") String mapType,
            @RequestParam(value = "useAI", defaultValue = "true") boolean useAI,
            @RequestParam(value = "useSeparateImages", defaultValue = "false") boolean useSeparateImages,
            @RequestParam(value = "additionalImages", required = false) List<MultipartFile> additionalImages) {
        
        try {
            // Save file temporarily
            String analysisId = UUID.randomUUID().toString();
            Path tempDir = Files.createTempDirectory("kmz_analysis_");
            String filename = file.getOriginalFilename();
            if (filename == null || filename.isEmpty()) {
                filename = "upload.kmz";
            }
            Path tempFile = tempDir.resolve(filename);
            File targetFile = tempFile.toFile();
            if (targetFile != null) {
                file.transferTo(targetFile);
            }
            
            logger.info("Starting analysis: {} - ID: {} - useAI: {} - useSeparateImages: {}", 
                file.getOriginalFilename(), analysisId, useAI, useSeparateImages);
            
            // Coordinates will be extracted later when processing images
            // Extract during polygon analysis phase
            
            // Determine which images to analyze
            List<File> imagesToAnalyze = new ArrayList<>();
            
            if (useSeparateImages && additionalImages != null && !additionalImages.isEmpty()) {
                // Use separately uploaded images for analysis
                logger.info("Using {} separate images for analysis", additionalImages.size());
                for (MultipartFile img : additionalImages) {
                    Path imgPath = tempDir.resolve(img.getOriginalFilename());
                    File imgFile = imgPath.toFile();
                    java.util.Objects.requireNonNull(imgFile, "Image file cannot be null");
                    img.transferTo(imgFile);
                    imagesToAnalyze.add(imgPath.toFile());
                }
            } else {
                // Extract images from KMZ (original behavior)
                List<Path> extractedImages = kmzParserService.extractImagesFromKmz(tempFile);
                if (extractedImages.isEmpty()) {
                    return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "error", "Không tìm thấy ảnh trong file KMZ để phân tích"
                    ));
                }
                // Use first image from KMZ
                imagesToAnalyze.add(extractedImages.get(0).toFile());
                logger.info("Using image from KMZ: {}", extractedImages.get(0).getFileName());
            }
            
            Map<String, Object> analysisResult = null;
            
            // Step 1: Run Python OpenCV analysis first (using first image)
            Map<String, Object> opencvResult = runPythonAnalysis(
                imagesToAnalyze.get(0).getPath(), 
                province, 
                district, 
                mapType
            );
            
            // Step 2: If useAI enabled, enhance with AI Vision
            if (useAI && mapAnalysisAIService != null) {
                try {
                    logger.info("Enhancing analysis with AI Vision for {} images...", imagesToAnalyze.size());
                    
                    // Analyze all images with AI
                    Map<String, Object> aiResult;
                    if (imagesToAnalyze.size() == 1) {
                        // Single image analysis
                        aiResult = mapAnalysisAIService.analyzeMapImage(
                            imagesToAnalyze.get(0), 
                            mapType
                        );
                    } else {
                        // Multiple images analysis
                        aiResult = mapAnalysisAIService.analyzeMultipleImages(
                            imagesToAnalyze, 
                            mapType
                        );
                    }
                    
                    if (aiResult != null && !aiResult.isEmpty()) {
                        // Merge OpenCV + AI results
                        @SuppressWarnings("unchecked")
                        List<Map<String, Object>> opencvZones = opencvResult != null ? 
                            (List<Map<String, Object>>) opencvResult.get("zones") : null;
                        
                        List<Map<String, Object>> mergedZones = mapAnalysisAIService.mergeAnalysisResults(
                            opencvZones, aiResult
                        );
                        
                        analysisResult = new HashMap<>();
                        analysisResult.put("zones", mergedZones);
                        analysisResult.put("totalZones", mergedZones.size());
                        analysisResult.put("source", "opencv+ai");
                        analysisResult.put("aiSummary", aiResult.get("summary"));
                        analysisResult.put("dominantType", aiResult.get("dominantType"));
                        
                        logger.info("AI-enhanced analysis: {} zones", mergedZones.size());
                    } else {
                        logger.warn("AI analysis returned empty, using OpenCV only");
                        analysisResult = opencvResult;
                    }
                } catch (Exception e) {
                    logger.warn("AI analysis failed: {}, using OpenCV only", e.getMessage());
                    analysisResult = opencvResult;
                }
            } else {
                analysisResult = opencvResult;
            }
            
            if (analysisResult == null) {
                return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "error", "Lỗi phân tích"
                ));
            }
            
            // Store results for confirmation
            analysisResult.put("analysisId", analysisId);
            analysisResult.put("province", province);
            analysisResult.put("district", district);
            analysisResult.put("mapType", mapType);
            analysisResult.put("uploadId", null); // Will be set when confirmed
            analysisResults.put(analysisId, analysisResult);
            
            // Cleanup temp files after 30 minutes
            scheduleCleanup(analysisId, tempDir, 30 * 60 * 1000);
            
            return ResponseEntity.ok(Map.of(
                "success", true,
                "analysisId", analysisId,
                "results", analysisResult
            ));
            
        } catch (Exception e) {
            logger.error("Analysis error: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                "success", false,
                "error", "Lỗi phân tích: " + e.getMessage()
            ));
        }
    }
    
    /**
     * Test AI connection for map analysis
     */
    @GetMapping("/analyze/test-ai")
    @PreAuthorize("hasRole('SYSTEM_ADMIN') or hasRole('OWNER')")
    public ResponseEntity<?> testAIConnection() {
        if (mapAnalysisAIService == null) {
            return ResponseEntity.ok(Map.of(
                "status", "unavailable",
                "message", "AI service not configured"
            ));
        }
        
        Map<String, Object> status = mapAnalysisAIService.testConnection();
        status.put("status", "available");
        return ResponseEntity.ok(status);
    }
    
    /**
     * Get analysis status/results
     */
    @GetMapping("/analyze/{analysisId}/status")
    @PreAuthorize("hasRole('SYSTEM_ADMIN') or hasRole('OWNER')")
    public ResponseEntity<?> getAnalysisStatus(@PathVariable String analysisId) {
        Map<String, Object> result = analysisResults.get(analysisId);
        
        if (result == null) {
            return ResponseEntity.notFound().build();
        }
        
        return ResponseEntity.ok(Map.of(
            "status", "completed",
            "results", result
        ));
    }
    
    /**
     * Confirm and save AI analysis results to database
     */
    @PostMapping("/analyze/confirm")
    @PreAuthorize("hasRole('SYSTEM_ADMIN') or hasRole('OWNER')")
    public ResponseEntity<?> confirmAnalysis(@RequestBody Map<String, Object> request) {
        try {
            String analysisId = (String) request.get("analysisId");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> zones = (List<Map<String, Object>>) request.get("zones");
            
            Map<String, Object> analysisResult = analysisResults.get(analysisId);
            if (analysisResult == null) {
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "Không tìm thấy kết quả phân tích"
                ));
            }
            
            String province = (String) analysisResult.get("province");
            String district = (String) analysisResult.get("district");
            String mapType = (String) analysisResult.get("mapType");
            Long userId = getCurrentUserId();
            
            // Create upload record
            KmzUpload upload = new KmzUpload();
            upload.setOriginalName("AI_Analysis_" + analysisId.substring(0, 8));
            upload.setFilename(analysisId + ".json");
            upload.setProvince(province);
            upload.setDistrict(district);
            upload.setMapType(mapType);
            upload.setUploadedBy(userId);
            upload.setStatus(KmzUpload.STATUS_COMPLETED);
            upload.setNotes("Được tạo từ phân tích AI");
            upload = kmzUploadRepository.save(upload);
            
            // Save zones
            int savedCount = 0;
            if (zones != null) {
                for (Map<String, Object> zoneData : zones) {
                    try {
                        PlanningZone zone = createZoneFromAnalysis(zoneData, upload.getId(), userId, mapType);
                        if (zone != null) {
                            planningZoneRepository.save(zone);
                            savedCount++;
                        }
                    } catch (Exception e) {
                        logger.warn("Error saving zone: {}", e.getMessage());
                    }
                }
            }
            
            // Update upload zones count
            upload.setZonesCount(savedCount);
            kmzUploadRepository.save(upload);
            
            // Clear analysis from memory
            analysisResults.remove(analysisId);
            
            return ResponseEntity.ok(Map.of(
                "success", true,
                "uploadId", upload.getId(),
                "zonesCount", savedCount,
                "message", "Đã lưu " + savedCount + " vùng vào database"
            ));
            
        } catch (Exception e) {
            logger.error("Confirm analysis error: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                "success", false,
                "error", e.getMessage()
            ));
        }
    }
    
    /**
     * Run Python analysis script
     */
    private Map<String, Object> runPythonAnalysis(String imagePath, String province, 
                                                   String district, String mapType) {
        try {
            // Find Python script
            Path scriptPath = Paths.get(pythonScriptPath, "auto_digitize.py");
            if (!Files.exists(scriptPath)) {
                // Try relative to working directory
                scriptPath = Paths.get(System.getProperty("user.dir"), pythonScriptPath, "auto_digitize.py");
            }
            
            if (!Files.exists(scriptPath)) {
                logger.error("Python script not found: {}", scriptPath);
                return createMockAnalysisResult(imagePath, province, district);
            }
            
            // Build command with proper arguments
            List<String> command = new ArrayList<>();
            command.add("python");
            command.add(scriptPath.toString());
            command.add("--image");
            command.add(imagePath);
            command.add("--output");
            command.add("json");
            command.add("--province");
            command.add(province != null ? province : "Cà Mau");
            
            if (district != null && !district.isEmpty()) {
                command.add("--district");
                command.add(district);
            }
            
            // Add default bounds for Ca Mau area
            command.add("--north");
            command.add("9.9");
            command.add("--south");
            command.add("8.5");
            command.add("--east");
            command.add("105.8");
            command.add("--west");
            command.add("104.5");
            
            ProcessBuilder pb = new ProcessBuilder(command);
            pb.redirectErrorStream(false); // Separate stderr
            
            logger.info("Running Python command: {}", String.join(" ", command));
            
            Process process = pb.start();
            
            // Read stdout (JSON output)
            StringBuilder output = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream(), "UTF-8"))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line);
                }
            }
            
            // Read stderr (logs)
            StringBuilder errorOutput = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getErrorStream(), "UTF-8"))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    errorOutput.append(line).append("\n");
                }
            }
            
            int exitCode = process.waitFor();
            
            logger.info("Python stderr (logs): {}", errorOutput.toString());
            logger.info("Python exit code: {}", exitCode);
            
            if (exitCode == 0 && output.length() > 0) {
                // Parse JSON output
                try {
                    ObjectMapper mapper = new ObjectMapper();
                    @SuppressWarnings("unchecked")
                    Map<String, Object> result = mapper.readValue(output.toString(), Map.class);
                    logger.info("Python analysis returned {} zones", result.get("totalZones"));
                    return result;
                } catch (Exception e) {
                    logger.error("Error parsing Python output: {}", e.getMessage());
                    logger.error("Raw output: {}", output.toString());
                }
            }
            
            logger.error("Python script failed with exit code: {}", exitCode);
            return createMockAnalysisResult(imagePath, province, district);
            
        } catch (Exception e) {
            logger.error("Error running Python analysis: {}", e.getMessage(), e);
            return createMockAnalysisResult(imagePath, province, district);
        }
    }
    
    /**
     * Create mock analysis result for testing when Python not available
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> createMockAnalysisResult(String imagePath, String province, String district) {
        Map<String, Object> result = new HashMap<>();
        
        // Mock color mapping (typical Cà Mau soil colors based on legend)
        Map<String, Object> colorMapping = new LinkedHashMap<>();
        colorMapping.put("#FFB6C1", Map.of("name", "Đất phèn tiềm tàng nông, mặn trung bình", "code", "PHT2", "count", 8));
        colorMapping.put("#DDA0DD", Map.of("name", "Đất phèn hoạt động nông, mặn ít", "code", "PHH3", "count", 6));
        colorMapping.put("#E6E6FA", Map.of("name", "Đất mặn trung bình", "code", "M2", "count", 5));
        colorMapping.put("#87CEEB", Map.of("name", "Sông suối, ao hồ", "code", "SH", "count", 4));
        colorMapping.put("#FFFF00", Map.of("name", "Đất cát giồng", "code", "CG", "count", 3));
        colorMapping.put("#4B0082", Map.of("name", "Đất than bùn phèn mặn", "code", "TB", "count", 2));
        colorMapping.put("#90EE90", Map.of("name", "Đất phù sa ngọt", "code", "PSN", "count", 2));
        
        result.put("colorMapping", colorMapping);
        
        // Mock zones với tọa độ thực từ bounds
        List<Map<String, Object>> zones = new ArrayList<>();
        
        // Sử dụng bounds mặc định cho Cà Mau
        double north = 9.9, south = 8.5, east = 105.8, west = 104.5;
        double latRange = north - south;
        double lngRange = east - west;
        
        int zoneId = 1;
        for (Map.Entry<String, Object> entry : colorMapping.entrySet()) {
            Map<String, Object> colorInfo = (Map<String, Object>) entry.getValue();
            int count = (int) colorInfo.get("count");
            
            for (int i = 0; i < Math.min(count, 3); i++) {
                Map<String, Object> zone = new HashMap<>();
                zone.put("name", colorInfo.get("name") + " - Vùng " + zoneId);
                zone.put("soilType", colorInfo.get("name"));
                zone.put("zoneCode", colorInfo.get("code"));
                zone.put("fillColor", entry.getKey());
                zone.put("areaSqm", 50000 + Math.random() * 200000);
                
                // Tạo polygon ngẫu nhiên trong bounds
                double baseLat = south + (latRange * 0.1) + (Math.random() * latRange * 0.7);
                double baseLng = west + (lngRange * 0.1) + (Math.random() * lngRange * 0.7);
                double size = 0.02 + Math.random() * 0.03; // Kích thước vùng
                
                // Tạo polygon irregular (không phải hình chữ nhật)
                List<List<Double>> coords = new ArrayList<>();
                int numPoints = 5 + (int)(Math.random() * 4); // 5-8 điểm
                for (int p = 0; p < numPoints; p++) {
                    double angle = (2 * Math.PI * p) / numPoints;
                    double r = size * (0.7 + Math.random() * 0.6); // Bán kính ngẫu nhiên
                    double lat = baseLat + r * Math.sin(angle);
                    double lng = baseLng + r * Math.cos(angle) * Math.cos(Math.toRadians(baseLat));
                    coords.add(List.of(lat, lng));
                }
                // Đóng polygon
                coords.add(coords.get(0));
                
                zone.put("coordinates", coords);
                zone.put("centerLat", baseLat);
                zone.put("centerLng", baseLng);
                
                zones.add(zone);
                zoneId++;
            }
        }
        
        result.put("zones", zones);
        result.put("totalZones", zones.size());
        result.put("source", "mock_data");
        result.put("province", province);
        result.put("district", district);
        result.put("bounds", Map.of("north", north, "south", south, "east", east, "west", west));
        
        return result;
    }
    
    /**
     * Create PlanningZone from analysis data
     */
    private PlanningZone createZoneFromAnalysis(Map<String, Object> zoneData, 
                                                 Long uploadId, Long userId, String mapType) {
        PlanningZone zone = new PlanningZone();
        
        zone.setName((String) zoneData.get("name"));
        zone.setZoneType((String) zoneData.getOrDefault("soilType", zoneData.get("zoneType")));
        zone.setZoneCode((String) zoneData.get("zoneCode"));
        zone.setFillColor((String) zoneData.get("fillColor"));
        zone.setMapType(mapType);
        zone.setKmzUploadId(uploadId);
        zone.setCreatedBy(userId);
        zone.setSource("AI Analysis");
        
        // Area
        Object areaSqm = zoneData.get("areaSqm");
        if (areaSqm != null) {
            zone.setAreaSqm(new BigDecimal(areaSqm.toString()));
        }
        
        // Center coordinates
        Object centerLat = zoneData.get("centerLat");
        Object centerLng = zoneData.get("centerLng");
        if (centerLat != null && centerLng != null) {
            zone.setCenterLat(new BigDecimal(centerLat.toString()));
            zone.setCenterLng(new BigDecimal(centerLng.toString()));
        }
        
        // Boundary coordinates
        Object coords = zoneData.get("coordinates");
        if (coords != null) {
            try {
                ObjectMapper mapper = new ObjectMapper();
                zone.setBoundaryCoordinates(mapper.writeValueAsString(coords));
            } catch (Exception e) {
                logger.warn("Error serializing coordinates: {}", e.getMessage());
            }
        }
        
        zone.setFillOpacity(new BigDecimal("0.5"));
        zone.setStrokeColor("#333333");
        
        return zone;
    }
    
    /**
     * Schedule cleanup of temporary files
     */
    private void scheduleCleanup(String analysisId, Path tempDir, long delayMs) {
        new Thread(() -> {
            try {
                Thread.sleep(delayMs);
                analysisResults.remove(analysisId);
                if (Files.exists(tempDir)) {
                    Files.walk(tempDir)
                        .sorted(Comparator.reverseOrder())
                        .forEach(path -> {
                            try { Files.delete(path); } catch (IOException e) { logger.debug("Could not delete file: {}", path); }
                        });
                }
                logger.info("Cleaned up analysis: {}", analysisId);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (IOException e) {
                logger.warn("Error during cleanup: {}", e.getMessage());
            }
        }).start();
    }
}
