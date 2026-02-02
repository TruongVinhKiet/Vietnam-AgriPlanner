package com.agriplanner.service;

import com.agriplanner.model.PlanningZoneType;
import com.agriplanner.model.SoilType;
import com.agriplanner.service.GeminiVisionService.GeminiErrorType;
import com.agriplanner.service.GeminiVisionService.GeminiResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.stream.Stream;

/**
 * Hybrid Multi-AI Orchestrator Service (v2.1)
 * 
 * HỖ TRỢ 2 LOẠI BẢN ĐỒ:
 * - soil (Thổ nhưỡng): Mapping với bảng soil_types (Phèn, Mặn, Phù sa...)
 * - planning (Quy hoạch): Mapping với bảng planning_zone_types (LUC, ONT,
 * RSX...)
 * 
 * LUỒNG XỬ LÝ HYBRID:
 * ┌─────────────────────────────────────────────────────────────┐
 * │ Bước 1: GEMINI 1.5 PRO → Trích xuất tọa độ từ bản đồ │
 * │ (Fallback: GPT-4o nếu Gemini lỗi/hết quota) │
 * ├─────────────────────────────────────────────────────────────┤
 * │ Bước 2: OPENCV (Python) → Tách vùng màu, tạo polygon │
 * │ Trích xuất ảnh chú giải (legend) │
 * ├─────────────────────────────────────────────────────────────┤
 * │ Bước 3: GPT-4o → Đọc chú giải, gán nhãn loại đất │
 * │ Map với Database chuẩn (soil_types / planning_zone_types) │
 * └─────────────────────────────────────────────────────────────┘
 */
@Service
public class MultiAIOrchestrator {

    private static final Logger logger = LoggerFactory.getLogger(MultiAIOrchestrator.class);

    // AI-specific loggers for detailed tracking
    private static final Logger opencvLogger = LoggerFactory.getLogger("AI.OpenCV");
    private static final Logger gpt4oLogger = LoggerFactory.getLogger("AI.GPT4o");
    private static final Logger geminiLogger = LoggerFactory.getLogger("AI.Gemini");

    // Map type constants
    public static final String MAP_TYPE_SOIL = "soil"; // Bản đồ thổ nhưỡng
    public static final String MAP_TYPE_PLANNING = "planning"; // Bản đồ quy hoạch

    @Value("${ai.github.token:}")
    private String githubToken;

    @Value("${ai.github.model:gpt-4o}")
    private String githubModel;

    @Value("${python.path:python}")
    private String pythonPath;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    // Soil type mapping service for AI-to-DB mapping (Thổ nhưỡng)
    @Autowired
    private SoilTypeMappingService soilTypeMappingService;

    // Planning zone type mapping service for AI-to-DB mapping (Quy hoạch)
    @Autowired
    private PlanningZoneTypeMappingService planningZoneTypeMappingService;

    // Gemini Vision service for coordinate extraction
    @Autowired
    private GeminiVisionService geminiVisionService;

    // API Endpoints
    private static final String GITHUB_API_URL = "https://models.inference.ai.azure.com/chat/completions";

    /**
     * Callback interface for progress updates with detailed error info
     */
    public interface ProgressCallback {
        void onProgress(String step, String status, String message);

        default void onProgress(String step, String status, String message, Map<String, Object> details) {
            onProgress(step, status, message);
        }
    }

    /**
     * Backwards-compatible method - defaults to soil map analysis
     */
    public Map<String, Object> analyzeMapImage(File imageFile, String province, String district,
            ProgressCallback callback) {
        return analyzeMapImage(imageFile, province, district, MAP_TYPE_SOIL, callback);
    }

    /**
     * Main orchestration method - HYBRID: Gemini + OpenCV + GPT-4o
     * Hỗ trợ 2 loại bản đồ: soil (Thổ nhưỡng) và planning (Quy hoạch)
     * 
     * Flow:
     * 1. Gemini 1.5 Pro: Extract coordinates (fallback: GPT-4o)
     * 2. OpenCV: Extract polygons and legend image
     * 3. GPT-4o: Read legend and map zone types
     * 
     * @param imageFile File ảnh bản đồ
     * @param province  Tên tỉnh
     * @param district  Tên huyện
     * @param mapType   Loại bản đồ: "soil" (Thổ nhưỡng) hoặc "planning" (Quy hoạch)
     * @param callback  Callback để cập nhật tiến trình
     */
    public Map<String, Object> analyzeMapImage(File imageFile, String province, String district,
            String mapType, ProgressCallback callback) {

        // Validate mapType - default to soil if not specified
        if (mapType == null || mapType.isEmpty()) {
            mapType = MAP_TYPE_SOIL;
        }
        boolean isPlanningMap = MAP_TYPE_PLANNING.equalsIgnoreCase(mapType);

        String mapTypeLabel = isPlanningMap ? "QUY HOẠCH" : "THỔ NHƯỠNG";
        logger.info("=== HYBRID AI ANALYSIS START ({}) ===", mapTypeLabel);
        logger.info("Image: {}, Province: {}, District: {}, MapType: {}",
                imageFile.getName(), province, district, mapType);

        Map<String, Object> result = new LinkedHashMap<>();
        List<Map<String, Object>> logs = new ArrayList<>();
        Map<String, Object> aiUsage = new LinkedHashMap<>(); // Track which AI was used

        // Store map type in result
        result.put("mapType", mapType);
        result.put("mapTypeLabel", mapTypeLabel);

        try {
            // ╔═══════════════════════════════════════════════════════════════╗
            // ║ BƯỚC 1: TRÍCH XUẤT TỌA ĐỘ (GEMINI → GPT-4o FALLBACK) ║
            // ╚═══════════════════════════════════════════════════════════════╝
            callback.onProgress("step1_coords", "running", "Bước 1: Đang phân tích tọa độ bản đồ...");

            Map<String, Object> coordinatesResult = null;
            String coordsProvider = "none";
            // String coordsError = null; // Unused

            // Try Gemini first (better for OCR/coordinate reading)
            if (geminiVisionService.isConfigured()) {
                callback.onProgress("gemini", "running",
                        "Đang dùng Gemini " + geminiVisionService.getModelName() + " đọc tọa độ...");
                addLog(logs, "Gemini", "START",
                        "Bắt đầu phân tích tọa độ với Gemini " + geminiVisionService.getModelName());

                GeminiResult geminiResult = geminiVisionService.analyzeCoordinates(imageFile);

                if (geminiResult.isSuccess()) {
                    coordinatesResult = geminiResult.getData();
                    coordsProvider = "gemini";
                    addLog(logs, "Gemini", "SUCCESS", "Đã trích xuất tọa độ: " + coordinatesResult.get("center"));
                    callback.onProgress("gemini", "completed", "✓ Gemini: Đã trích xuất tọa độ thành công");
                    geminiLogger.info("Coordinate extraction successful via Gemini");
                } else {
                    // Gemini failed - log detailed error
                    // coordsError = geminiResult.getErrorMessage(); // Unused
                    String errorIcon = getErrorIcon(geminiResult.getErrorType());

                    addLog(logs, "Gemini", "ERROR", errorIcon + " " + geminiResult.getErrorMessage());
                    callback.onProgress("gemini", "error",
                            errorIcon + " Gemini lỗi: " + geminiResult.getErrorMessage(),
                            Map.of("errorType", geminiResult.getErrorType().name(),
                                    "details",
                                    geminiResult.getErrorDetails() != null ? geminiResult.getErrorDetails() : ""));

                    geminiLogger.warn("Gemini failed: {} - {}", geminiResult.getErrorType(),
                            geminiResult.getErrorMessage());

                    // Decide whether to fallback
                    if (geminiResult.shouldFallback()) {
                        addLog(logs, "System", "INFO", "🔄 Chuyển sang GPT-4o (fallback)...");
                        callback.onProgress("fallback", "running", "🔄 Đang chuyển sang GPT-4o...");
                    }
                }
            } else {
                addLog(logs, "Gemini", "SKIP", "Gemini không được cấu hình, sử dụng GPT-4o");
                callback.onProgress("gemini", "skipped", "Gemini chưa cấu hình, dùng GPT-4o");
            }

            // Fallback to GPT-4o if Gemini failed or not configured
            if (coordinatesResult == null) {
                callback.onProgress("gpt4o_coords", "running", "Đang dùng GPT-4o đọc tọa độ (fallback)...");
                addLog(logs, "GPT-4o", "START", "Bắt đầu phân tích tọa độ (fallback)");

                coordinatesResult = analyzeCoordinatesWithGPT4o(imageFile);

                if (coordinatesResult != null && !coordinatesResult.isEmpty()) {
                    coordsProvider = "gpt4o";
                    addLog(logs, "GPT-4o", "SUCCESS", "Đã trích xuất tọa độ: " + coordinatesResult.get("center"));
                    callback.onProgress("gpt4o_coords", "completed", "✓ GPT-4o: Đã trích xuất tọa độ");
                    gpt4oLogger.info("Coordinate extraction successful via GPT-4o (fallback)");
                } else {
                    addLog(logs, "GPT-4o", "WARNING", "Không thể trích xuất tọa độ chính xác");
                    callback.onProgress("gpt4o_coords", "warning", "⚠️ Không tìm thấy tọa độ rõ ràng");
                }
            }

            // Save coordinate provider info
            aiUsage.put("coordinates", coordsProvider);
            if (coordinatesResult != null) {
                result.put("coordinates", coordinatesResult);
            }

            callback.onProgress("step1_coords", "completed",
                    String.format("Bước 1 hoàn thành (%s)", coordsProvider.toUpperCase()));

            // ╔═══════════════════════════════════════════════════════════════╗
            // ║ BƯỚC 2: TRÍCH XUẤT POLYGON VÀ LEGEND (OPENCV) ║
            // ╚═══════════════════════════════════════════════════════════════╝
            callback.onProgress("step2_opencv", "running", "Bước 2: Đang trích xuất vùng màu và polygon...");
            addLog(logs, "OpenCV", "START", "Bắt đầu trích xuất polygon bằng OpenCV");

            Map<String, Object> opencvResult = extractPolygonsWithOpenCV(imageFile, coordinatesResult);

            List<Map<String, Object>> zones = new ArrayList<>();
            List<Map<String, Object>> colorSummary = new ArrayList<>();

            if (opencvResult != null && opencvResult.containsKey("zones")) {
                Object zonesObj = opencvResult.get("zones");
                if (zonesObj instanceof List) {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> castedZones = (List<Map<String, Object>>) zonesObj;
                    zones = castedZones;
                }

                Object colorsObj = opencvResult.get("colorSummary");
                if (colorsObj instanceof List) {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> castedColors = (List<Map<String, Object>>) colorsObj;
                    colorSummary = castedColors;
                }

                result.put("zones", zones);
                result.put("colorSummary", colorSummary);
                addLog(logs, "OpenCV", "SUCCESS",
                        "Đã trích xuất " + zones.size() + " vùng polygon (tối đa 20 điểm/zone)");
                callback.onProgress("step2_opencv", "completed",
                        String.format("Bước 2 hoàn thành: %d vùng đất", zones.size()));
            } else {
                addLog(logs, "OpenCV", "WARNING", "Không trích xuất được polygon");
                callback.onProgress("step2_opencv", "warning", "⚠️ Không trích xuất được polygon");
            }

            // Extract legend info from OpenCV result
            @SuppressWarnings("unchecked")
            Map<String, Object> legendInfo = opencvResult != null ? (Map<String, Object>) opencvResult.get("legend")
                    : null;

            if (legendInfo != null && legendInfo.get("base64") != null) {
                addLog(logs, "OpenCV", "SUCCESS", "Đã tách ảnh legend tại: " + legendInfo.get("position"));
                callback.onProgress("legend", "completed", "✓ Đã trích xuất bảng chú giải");
            }

            aiUsage.put("polygons", "opencv");

            // ╔═══════════════════════════════════════════════════════════════╗
            // ║ BƯỚC 3: GÁN NHÃN LOẠI ĐẤT (GPT-4o) ║
            // ╚═══════════════════════════════════════════════════════════════╝
            String step3Label = isPlanningMap ? "loại đất quy hoạch" : "loại đất thổ nhưỡng";
            callback.onProgress("step3_labels", "running",
                    "Bước 3: AI đang phân loại " + step3Label + " từ chú giải...");
            addLog(logs, "GPT-4o", "START", "Bắt đầu phân loại màu sắc bằng GPT-4o (mode: " + mapType + ")");

            Map<String, Object> colorMapping = labelColorsWithGPT4o(imageFile, colorSummary, province, legendInfo,
                    mapType);

            if (colorMapping != null && !colorMapping.isEmpty()) {
                result.put("colorMapping", colorMapping);

                // Apply labels to zones
                @SuppressWarnings("unchecked")
                Map<String, String> colorToSoil = (Map<String, String>) colorMapping.getOrDefault("colorToSoil",
                        new HashMap<>());
                String dominantType = (String) colorMapping.get("dominantType");

                // POST-PROCESSING: Map AI names to DB codes - based on mapType
                int mappedCount = 0;
                int unmappedCount = 0;
                Map<String, String> colorToCode = new HashMap<>();

                for (Map<String, Object> zone : zones) {
                    String color = (String) zone.getOrDefault("fillColor", zone.get("color"));
                    if (color != null && colorToSoil.containsKey(color)) {
                        String aiZoneName = colorToSoil.get(color);

                        if (isPlanningMap) {
                            // === PLANNING MAP: Use PlanningZoneTypeMappingService ===
                            String dbCode = planningZoneTypeMappingService.mapAiNameToCode(aiZoneName);

                            if (dbCode != null) {
                                Optional<PlanningZoneType> zoneTypeOpt = planningZoneTypeMappingService
                                        .getZoneTypeByCode(dbCode);
                                if (zoneTypeOpt.isPresent()) {
                                    PlanningZoneType zoneType = zoneTypeOpt.get();
                                    zone.put("zoneCode", zoneType.getCode());
                                    zone.put("zoneType", zoneType.getName());
                                    zone.put("landUsePurpose", zoneType.getName());
                                    zone.put("planningCategory", zoneType.getCategory());
                                    zone.put("description", zoneType.getDescription());
                                    zone.put("icon", zoneType.getIcon());
                                    zone.put("defaultColor", zoneType.getDefaultColor());
                                    colorToCode.put(color, dbCode);
                                    mappedCount++;
                                }
                            } else {
                                // P1 FIX: Safe AI_* code generation
                                String generatedCode = "AI_" + sanitizeColorCode(color);
                                zone.put("zoneCode", generatedCode);
                                zone.put("zoneType", aiZoneName);
                                zone.put("landUsePurpose", aiZoneName);
                                unmappedCount++;
                            }
                        } else {
                            // === SOIL MAP: Use SoilTypeMappingService ===
                            String dbCode = soilTypeMappingService.mapAiNameToCode(aiZoneName);

                            if (dbCode != null) {
                                Optional<SoilType> soilTypeOpt = soilTypeMappingService.getSoilTypeByCode(dbCode);
                                if (soilTypeOpt.isPresent()) {
                                    SoilType soilType = soilTypeOpt.get();
                                    zone.put("zoneCode", soilType.getCode());
                                    zone.put("zoneType", soilType.getName());
                                    zone.put("landUsePurpose", soilType.getName());
                                    zone.put("soilCategory", soilType.getCategory());
                                    zone.put("phRange", soilType.getPhRange());
                                    zone.put("fertility", soilType.getFertility());
                                    zone.put("suitableCrops", soilType.getSuitableCrops());
                                    zone.put("limitations", soilType.getLimitations());
                                    zone.put("icon", soilType.getIcon());
                                    zone.put("defaultColor", soilType.getDefaultColor());
                                    colorToCode.put(color, dbCode);
                                    mappedCount++;
                                }
                            } else {
                                // P1 FIX: Safe AI_* code generation
                                String generatedCode = "AI_" + sanitizeColorCode(color);
                                zone.put("zoneCode", generatedCode);
                                zone.put("zoneType", aiZoneName);
                                zone.put("landUsePurpose", aiZoneName);
                                unmappedCount++;
                            }
                        }
                    }
                }

                result.put("colorToCode", colorToCode);
                result.put("dominantType", dominantType);

                if (dominantType != null) {
                    String dominantCode = isPlanningMap
                            ? planningZoneTypeMappingService.mapAiNameToCode(dominantType)
                            : soilTypeMappingService.mapAiNameToCode(dominantType);
                    if (dominantCode != null) {
                        result.put("dominantCode", dominantCode);
                    }
                }

                addLog(logs, "GPT-4o", "SUCCESS",
                        String.format("Đã gán nhãn %d màu. Mapped: %d, Unmapped: %d",
                                colorToSoil.size(), mappedCount, unmappedCount));
                callback.onProgress("step3_labels", "completed",
                        String.format("Bước 3 hoàn thành: %d/%d %s đã liên kết DB", mappedCount,
                                colorToSoil.size(), isPlanningMap ? "loại quy hoạch" : "loại đất"));
            } else {
                addLog(logs, "GPT-4o", "WARNING", "Không thể đọc chú giải");
                callback.onProgress("step3_labels", "warning", "⚠️ Không thể đọc chú giải");
            }

            aiUsage.put("labeling", "gpt4o");

            // Final summary
            result.put("logs", logs);
            result.put("aiUsage", aiUsage);
            result.put("province", province);
            result.put("district", district);
            result.put("originalImage", imageFile.getAbsolutePath());
            result.put("analysisTime", System.currentTimeMillis());
            result.put("success", true);
            result.put("hybridMode", true);

            logger.info("=== HYBRID AI ORCHESTRATION COMPLETE ===");
            logger.info("AI Usage: {}", aiUsage);
            logger.info("Total zones detected: {}",
                    ((List<?>) result.getOrDefault("zones", Collections.emptyList())).size());

        } catch (Exception e) {
            logger.error("Hybrid AI orchestration failed: {}", e.getMessage(), e);
            result.put("success", false);
            result.put("error", e.getMessage());
            result.put("logs", logs);
            addLog(logs, "System", "ERROR", "Lỗi hệ thống: " + e.getMessage());
            callback.onProgress("error", "failed", "❌ Lỗi: " + e.getMessage());
        }

        return result;
    }

    /**
     * Get error icon based on error type
     */
    private String getErrorIcon(GeminiErrorType errorType) {
        return switch (errorType) {
            case QUOTA_EXCEEDED -> "⏱️ Hết quota";
            case INVALID_API_KEY -> "🔑 API key lỗi";
            case TIMEOUT -> "⌛ Timeout";
            case NETWORK_ERROR -> "🌐 Lỗi mạng";
            case CONTENT_FILTERED -> "🚫 Bị chặn";
            case MODEL_NOT_FOUND -> "❓ Model không tồn tại";
            case PARSE_ERROR -> "📄 Lỗi parse";
            default -> "❌ Lỗi";
        };
    }

    /**
     * Step 1: Use GPT-4o (GitHub Models) to analyze map coordinates
     * Replaces Gemini
     */
    private Map<String, Object> analyzeCoordinatesWithGPT4o(File imageFile) {
        gpt4oLogger.info("Starting coordinate analysis for: {}", imageFile.getName());

        if (githubToken == null || githubToken.isEmpty()) {
            gpt4oLogger.warn("GitHub token not configured");
            return null;
        }

        try {
            byte[] imageBytes = Files.readAllBytes(imageFile.toPath());
            String base64Image = Base64.getEncoder().encodeToString(imageBytes);
            String mimeType = getMimeType(imageFile);

            gpt4oLogger.debug("Image encoded, size: {} bytes", imageBytes.length);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(Objects.requireNonNull(githubToken));

            ObjectNode requestBody = objectMapper.createObjectNode();
            requestBody.put("model", githubModel);
            requestBody.put("max_tokens", 1024);
            requestBody.put("temperature", 0.1);

            ArrayNode messages = requestBody.putArray("messages");

            ObjectNode systemMsg = messages.addObject();
            systemMsg.put("role", "system");
            systemMsg.put("content", "You are a GIS expert. Extract coordinates from map images. Return only JSON.");

            ObjectNode userMsg = messages.addObject();
            userMsg.put("role", "user");
            ArrayNode content = userMsg.putArray("content");

            ObjectNode textPart = content.addObject();
            textPart.put("type", "text");
            textPart.put("text", """
                    Analyze this map image. Find geographic coordinates (lat/long) for the 4 corners or the center.
                    Also identify scale and province/district name.

                    Return valid JSON only (no markdown):
                    {
                      "sw": {"lat": 10.123, "lng": 105.123},
                      "ne": {"lat": 10.456, "lng": 105.456},
                      "center": {"lat": 10.289, "lng": 105.289},
                      "scale": "1:25000",
                      "province": "Ten Tinh",
                      "district": "Ten Huyen"
                    }

                    If specific corners are not found, approximate based on location name.
                    """);

            ObjectNode imagePart = content.addObject();
            imagePart.put("type", "image_url");
            ObjectNode imageUrl = imagePart.putObject("image_url");
            imageUrl.put("url", "data:" + mimeType + ";base64," + base64Image);
            imageUrl.put("detail", "high"); // Need high detail for coordinates

            HttpEntity<String> entity = new HttpEntity<>(requestBody.toString(), headers);

            gpt4oLogger.info("Calling GPT-4o for coordinates...");
            ResponseEntity<String> response = restTemplate.exchange(
                    Objects.requireNonNull(GITHUB_API_URL), Objects.requireNonNull(HttpMethod.POST), entity,
                    String.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                JsonNode responseJson = objectMapper.readTree(response.getBody());
                String text = responseJson.path("choices").path(0)
                        .path("message").path("content").asText();

                gpt4oLogger.debug("GPT-4o response: {}", text);

                String jsonStr = extractJsonFromText(text);
                if (jsonStr != null) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> coords = objectMapper.readValue(jsonStr, Map.class);
                    // Ensure format matches what Python expects (sw, ne)
                    // If GPT returned topLeft/bottomRight, perform conversion if needed
                    // But prompt asked for sw/ne
                    return coords;
                }
            }
            return null;

        } catch (Exception e) {
            gpt4oLogger.error("Coordinate analysis failed: {}", e.getMessage(), e);
            return null;
        }
    }

    /**
     * Step 2 (NEW): Extract polygons using Python/OpenCV
     * Returns zones with polygon coordinates extracted by color segmentation
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> extractPolygonsWithOpenCV(File imageFile, Map<String, Object> geoBounds) {
        opencvLogger.info("[HYBRID] Starting polygon extraction for: {}", imageFile.getName());

        Path tempDir = null;
        try {
            // Create output JSON path
            tempDir = Files.createTempDirectory("map_polygons_");
            File outputJson = new File(tempDir.toFile(), "polygons.json");

            // Find Python script - try multiple paths
            String scriptPath = findPythonScript("map_polygon_extractor.py");
            if (scriptPath == null) {
                opencvLogger.error("Cannot find map_polygon_extractor.py script!");
                return null;
            }
            opencvLogger.info("[DEBUG] Using script path: {}", scriptPath);

            List<String> command = new ArrayList<>();
            command.add(pythonPath != null ? pythonPath : "python");
            command.add(scriptPath);
            command.add(imageFile.getAbsolutePath());
            command.add(outputJson.getAbsolutePath());
            command.add("--with-legend");

            if (geoBounds != null) {
                String pointsJson = objectMapper.writeValueAsString(geoBounds);
                // Windows might need careful escaping for JSON in args, but ProcessBuilder
                // handles basic spaces
                // Enclose in quotes to be safe?
                // Actually passing simple JSON structure without spaces is safer
                command.add("--geo-bounds=" + pointsJson);
            }

            ProcessBuilder pb = new ProcessBuilder(command);
            pb.redirectErrorStream(true);

            opencvLogger.debug("Running polygon extractor: {}", pb.command());

            Process process = pb.start();

            // Read output and look for JSON marker
            StringBuilder fullOutput = new StringBuilder();
            String jsonOutput = null;
            boolean inJsonBlock = false;
            StringBuilder jsonBuilder = new StringBuilder();

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    fullOutput.append(line).append("\n");
                    opencvLogger.debug("Python: {}", line);

                    if (line.equals("===JSON_START===")) {
                        inJsonBlock = true;
                        continue;
                    }
                    if (line.equals("===JSON_END===")) {
                        inJsonBlock = false;
                        jsonOutput = jsonBuilder.toString();
                        continue;
                    }
                    if (inJsonBlock) {
                        jsonBuilder.append(line);
                    }
                }
            }

            int exitCode = process.waitFor();

            opencvLogger.info("[DEBUG] Python exit code: {}", exitCode);
            opencvLogger.info("[DEBUG] Full Python output:\n{}", fullOutput.toString());
            opencvLogger.info("[DEBUG] Extracted JSON output: {}",
                    jsonOutput != null ? jsonOutput.substring(0, Math.min(500, jsonOutput.length())) : "null");

            if (exitCode == 0 && jsonOutput != null && !jsonOutput.isEmpty()) {
                Map<String, Object> result = objectMapper.readValue(jsonOutput, Map.class);
                List<?> zones = (List<?>) result.get("zones");
                opencvLogger.info("[HYBRID] Successfully extracted {} zones", zones != null ? zones.size() : 0);
                if (zones != null && !zones.isEmpty()) {
                    opencvLogger.info("[DEBUG] First zone sample: {}", zones.get(0));
                }
                return result;
            } else if (outputJson.exists()) {
                // Fallback: read from file
                opencvLogger.info("[DEBUG] Reading from output file: {}", outputJson.getAbsolutePath());
                Map<String, Object> result = objectMapper.readValue(outputJson, Map.class);
                List<?> zones = (List<?>) result.get("zones");
                opencvLogger.info("[FALLBACK] Loaded {} zones from file", zones != null ? zones.size() : 0);
                return result;
            } else {
                opencvLogger.warn("Polygon extraction failed with exit code: {}", exitCode);
                opencvLogger.warn("[DEBUG] Output file exists: {}, path: {}", outputJson.exists(),
                        outputJson.getAbsolutePath());
                return null;
            }

        } catch (Exception e) {
            opencvLogger.error("Polygon extraction failed: {}", e.getMessage(), e);
            return null;
        } finally {
            deleteTempDirQuietly(tempDir);
        }
    }

    /**
     * Step 3 (OPTIMIZED): Use GPT-4o to label colors with zone types
     * Now uses extracted legend image if available (10-20x smaller than full map)
     * Falls back to full image if legend extraction failed
     * 
     * HỖ TRỢ 2 LOẠI:
     * - soil: Bản đồ thổ nhưỡng (Phèn, Mặn, Phù sa...)
     * - planning: Bản đồ quy hoạch (LUC, ONT, RSX...)
     * 
     * @param imageFile    Full map image (fallback)
     * @param colorSummary List of detected colors from OpenCV
     * @param province     Province name for context
     * @param legendInfo   Legend info from OpenCV containing base64 encoded legend
     *                     crop
     * @param mapType      "soil" hoặc "planning"
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> labelColorsWithGPT4o(File imageFile, List<Map<String, Object>> colorSummary,
            String province, Map<String, Object> legendInfo, String mapType) {

        boolean isPlanningMap = MAP_TYPE_PLANNING.equalsIgnoreCase(mapType);
        gpt4oLogger.info("[HYBRID] Starting color labeling for: {} (mode: {})", imageFile.getName(), mapType);

        if (githubToken == null || githubToken.isEmpty()) {
            gpt4oLogger.warn("GitHub token not configured");
            return null;
        }

        try {
            // Build a compact color list string
            StringBuilder colorList = new StringBuilder();
            for (Map<String, Object> c : colorSummary) {
                colorList.append(c.get("color")).append("(").append(c.get("percentage")).append("%), ");
            }

            // OPTIMIZED: Use legend image if available (much smaller = faster + cheaper)
            String base64Image;
            String mimeType;
            boolean usingLegendImage = false;

            if (legendInfo != null && legendInfo.get("base64") != null) {
                // Use extracted legend image - typically 10-20x smaller than full map!
                base64Image = (String) legendInfo.get("base64");
                mimeType = "image/jpeg"; // Legend is always saved as JPEG
                usingLegendImage = true;
                gpt4oLogger.info("[OPTIMIZED] Using extracted legend image (position: {})",
                        legendInfo.get("position"));
            } else {
                // Fallback: Use full map image
                byte[] imageBytes = Files.readAllBytes(imageFile.toPath());
                base64Image = Base64.getEncoder().encodeToString(imageBytes);
                mimeType = getMimeType(imageFile);
                gpt4oLogger.info("[FALLBACK] Using full map image (legend extraction failed)");
            }

            gpt4oLogger.debug("Sending {} colors for labeling", colorSummary.size());

            // Build request - MUCH SIMPLER prompt
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(Objects.requireNonNull(githubToken));

            ObjectNode requestBody = objectMapper.createObjectNode();
            requestBody.put("model", githubModel);
            requestBody.put("max_tokens", 1024); // Much smaller!
            requestBody.put("temperature", 0.1);

            ArrayNode messages = requestBody.putArray("messages");

            // System message
            ObjectNode systemMsg = messages.addObject();
            systemMsg.put("role", "system");
            systemMsg.put("content", "Ban la chuyen gia phan tich ban do Viet Nam. Tra loi ngan gon bang JSON.");

            // User message - Different prompts for legend image vs full map
            ObjectNode userMsg = messages.addObject();
            userMsg.put("role", "user");
            ArrayNode content = userMsg.putArray("content");

            ObjectNode textPart = content.addObject();
            textPart.put("type", "text");

            // Get standard names based on map type
            String standardTypes;
            String mapTypeDesc;

            if (isPlanningMap) {
                standardTypes = planningZoneTypeMappingService.formatZoneTypesForPrompt();
                mapTypeDesc = "quy hoach su dung dat";
            } else {
                standardTypes = soilTypeMappingService.formatSoilTypesForPrompt();
                mapTypeDesc = "tho nhuong (loai dat)";
            }

            String promptText;
            if (usingLegendImage) {
                // OPTIMIZED PROMPT: Direct legend reading with standard types reference
                promptText = String.format(
                        "Day la BANG CHU GIAI (legend) cua ban do %s tinh %s. " +
                                "Cac mau da phat hien tren ban do: %s. \n\n" +
                                "DANH SACH LOAI %s CHUAN CUA VIET NAM (hay co gang gan dung ten nay):\n%s\n" +
                                "HAY DOC CHINH XAC ten %s trong chu giai va GAN DUNG TEN CHUAN o tren neu co the. " +
                                "Tra ve JSON: {\"colorToSoil\":{\"#hex\":\"ten loai dat chuan\",...},\"dominantType\":\"loai dat pho bien nhat\"}",
                        mapTypeDesc, province, colorList.toString(),
                        isPlanningMap ? "QUY HOACH" : "DAT",
                        standardTypes,
                        isPlanningMap ? "loai quy hoach" : "loai dat");
            } else {
                // FALLBACK PROMPT: Full map reading with standard types reference
                promptText = String.format(
                        "Nhin vao chu giai (legend) cua ban do %s %s. Cac mau chinh: %s. \n\n" +
                                "DANH SACH %s CHUAN:\n%s\n" +
                                "Gan ten %s CHUAN cho tung mau. JSON: " +
                                "{\"colorToSoil\":{\"#hex\":\"ten loai dat chuan\",...},\"dominantType\":\"loai dat pho bien nhat\"}",
                        mapTypeDesc, province, colorList.toString(),
                        isPlanningMap ? "LOAI QUY HOACH" : "LOAI DAT",
                        standardTypes,
                        isPlanningMap ? "loai quy hoach" : "loai dat");
            }
            textPart.put("text", promptText);

            ObjectNode imagePart = content.addObject();
            imagePart.put("type", "image_url");
            ObjectNode imageUrl = imagePart.putObject("image_url");
            imageUrl.put("url", "data:" + mimeType + ";base64," + base64Image);
            // Use higher detail for legend image since it's already small
            imageUrl.put("detail", usingLegendImage ? "high" : "low");

            HttpEntity<String> entity = new HttpEntity<>(requestBody.toString(), headers);

            gpt4oLogger.info("Calling GPT-4o for color labeling...");
            ResponseEntity<String> response = restTemplate.exchange(
                    Objects.requireNonNull(GITHUB_API_URL), Objects.requireNonNull(HttpMethod.POST), entity,
                    String.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                JsonNode responseJson = objectMapper.readTree(response.getBody());
                String text = responseJson.path("choices").path(0)
                        .path("message").path("content").asText();

                gpt4oLogger.debug("GPT-4o color labeling response: {} chars", text.length());

                String jsonStr = extractJsonFromText(text);
                if (jsonStr != null) {
                    Map<String, Object> result = objectMapper.readValue(jsonStr, Map.class);
                    Map<?, ?> colorToSoil = (Map<?, ?>) result.get("colorToSoil");
                    gpt4oLogger.info("[HYBRID] Successfully labeled {} colors",
                            colorToSoil != null ? colorToSoil.size() : 0);
                    return result;
                }
            }

            gpt4oLogger.warn("Failed to parse color labeling response");
            return null;

        } catch (Exception e) {
            gpt4oLogger.error("Color labeling failed: {}", e.getMessage(), e);
            return null;
        }
    }

    // ============ UTILITY METHODS ============

    private void addLog(List<Map<String, Object>> logs, String ai, String level, String message) {
        Map<String, Object> log = new LinkedHashMap<>();
        log.put("timestamp", System.currentTimeMillis());
        log.put("ai", ai);
        log.put("level", level);
        log.put("message", message);
        logs.add(log);

        // Log to specific logger
        switch (ai) {
            case "OpenCV" -> opencvLogger.info("[{}] {}", level, message);
            case "GPT-4o" -> gpt4oLogger.info("[{}] {}", level, message);
            default -> logger.info("[{}] [{}] {}", ai, level, message);
        }
    }

    private String getMimeType(File file) {
        String name = file.getName().toLowerCase();
        if (name.endsWith(".png"))
            return "image/png";
        if (name.endsWith(".jpg") || name.endsWith(".jpeg"))
            return "image/jpeg";
        if (name.endsWith(".gif"))
            return "image/gif";
        if (name.endsWith(".webp"))
            return "image/webp";
        return "image/jpeg";
    }

    private String extractJsonFromText(String text) {
        if (text == null || text.isEmpty())
            return null;

        // Try to find JSON block
        int start = text.indexOf("{");
        int end = text.lastIndexOf("}");

        if (start >= 0 && end > start) {
            String jsonStr = text.substring(start, end + 1);
            // Validate it's valid JSON
            try {
                objectMapper.readTree(jsonStr);
                return jsonStr;
            } catch (Exception e) {
                logger.debug("Invalid JSON extracted: {}", e.getMessage());
            }
        }

        // Try markdown code block
        if (text.contains("```json")) {
            int jsonStart = text.indexOf("```json") + 7;
            int jsonEnd = text.indexOf("```", jsonStart);
            if (jsonEnd > jsonStart) {
                return text.substring(jsonStart, jsonEnd).trim();
            }
        }

        return null;
    }

    /**
     * Find Python script by trying multiple possible paths
     */
    private String findPythonScript(String scriptName) {
        // List of possible paths to try
        String[] pathCandidates = {
                // Running from project root (E:\Agriplanner)
                Paths.get("backend", "python", scriptName).toAbsolutePath().toString(),
                // Running from backend directory (E:\Agriplanner\backend)
                Paths.get("python", scriptName).toAbsolutePath().toString(),
                // Absolute path based on user.dir
                Paths.get(System.getProperty("user.dir"), "backend", "python", scriptName).toString(),
                Paths.get(System.getProperty("user.dir"), "python", scriptName).toString(),
                // Try parent directory
                Paths.get(System.getProperty("user.dir")).getParent().resolve("backend").resolve("python")
                        .resolve(scriptName).toString(),
        };

        for (String path : pathCandidates) {
            File file = new File(path);
            if (file.exists() && file.isFile()) {
                opencvLogger.debug("Found script at: {}", path);
                return path;
            }
        }

        // Log all tried paths for debugging
        opencvLogger.error("Script {} not found. Tried paths:", scriptName);
        for (String path : pathCandidates) {
            opencvLogger.error("  - {} (exists: {})", path, new File(path).exists());
        }

        return null;
    }

    private void deleteTempDirQuietly(Path tempDir) {
        if (tempDir == null) {
            return;
        }
        try {
            if (!Files.exists(tempDir)) {
                return;
            }
            try (Stream<Path> paths = Files.walk(tempDir)) {
                paths.sorted(Comparator.reverseOrder()).forEach(path -> {
                    try {
                        Files.deleteIfExists(path);
                    } catch (Exception e) {
                        opencvLogger.debug("Failed to delete temp path {}: {}", path, e.getMessage());
                    }
                });
            }
        } catch (Exception e) {
            opencvLogger.debug("Failed to cleanup temp dir {}: {}", tempDir, e.getMessage());
        }
    }

    /**
     * P1 FIX: Safely extract 6-char hex from color string
     * Prevents StringIndexOutOfBoundsException when color is null/short/malformed
     */
    private String sanitizeColorCode(String color) {
        if (color == null || color.isEmpty()) {
            return "UNKNOWN";
        }
        String hex = color.startsWith("#") ? color.substring(1) : color;
        if (hex.length() >= 6) {
            return hex.substring(0, 6).toUpperCase();
        } else if (!hex.isEmpty()) {
            return hex.toUpperCase();
        }
        return "UNKNOWN";
    }
}
