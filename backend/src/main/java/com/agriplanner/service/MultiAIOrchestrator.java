package com.agriplanner.service;

import com.agriplanner.model.SoilType;
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

/**
 * Multi-AI Orchestrator Service
 * Điều phối AI để phân tích ảnh bản đồ:
 * 1. GPT-4o Vision - Trích xuất tọa độ 4 góc
 * 2. OpenCV (Python) - Auto-crop, tách vùng màu, tạo polygon
 * 3. GPT-4o Vision - Đọc chú giải, gán nhãn loại đất
 */
@Service
public class MultiAIOrchestrator {

    private static final Logger logger = LoggerFactory.getLogger(MultiAIOrchestrator.class);

    // AI-specific loggers for detailed tracking
    private static final Logger opencvLogger = LoggerFactory.getLogger("AI.OpenCV");
    private static final Logger gpt4oLogger = LoggerFactory.getLogger("AI.GPT4o");

    @Value("${ai.github.token:}")
    private String githubToken;

    @Value("${ai.github.model:gpt-4o}")
    private String githubModel;

    @Value("${python.path:python}")
    private String pythonPath;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    // Soil type mapping service for AI-to-DB mapping
    @Autowired
    private SoilTypeMappingService soilTypeMappingService;

    // API Endpoints
    private static final String GITHUB_API_URL = "https://models.inference.ai.azure.com/chat/completions";

    /**
     * Callback interface for progress updates
     */
    public interface ProgressCallback {
        void onProgress(String step, String status, String message);
    }

    /**
     * Main orchestration method - SIMPLIFIED: OpenCV + GPT-4o only
     * Removed: Gemini (coordinates), Groq/Cohere (cross-check)
     */
    public Map<String, Object> analyzeMapImage(File imageFile, String province, String district,
            ProgressCallback callback) {
        logger.info("=== AI ANALYSIS START (OpenCV + GPT-4o) ===");
        logger.info("Image: {}, Province: {}, District: {}", imageFile.getName(), province, district);

        Map<String, Object> result = new LinkedHashMap<>();
        List<Map<String, Object>> logs = new ArrayList<>();

        try {
            // Step 1: GPT-4o - Extract coordinates from map corners
            callback.onProgress("gpt4o_coords", "running", "Đang phân tích tọa độ 4 góc (GPT-4o)...");
            addLog(logs, "GPT-4o", "START", "Bắt đầu phân tích tọa độ");

            Map<String, Object> coordinatesResult = analyzeCoordinatesWithGPT4o(imageFile);

            if (coordinatesResult != null && !coordinatesResult.isEmpty()) {
                result.put("coordinates", coordinatesResult);
                addLog(logs, "GPT-4o", "SUCCESS", "Đã trích xuất tọa độ: " + coordinatesResult.get("center"));
                callback.onProgress("gpt4o_coords", "completed", "Hoàn thành phân tích tọa độ");
            } else {
                addLog(logs, "GPT-4o", "WARNING", "Không thể trích xuất tọa độ chính xác");
                callback.onProgress("gpt4o_coords", "warning", "Không tìm thấy tọa độ rõ ràng");
            }

            // Step 2: OpenCV - Extract polygons by color
            callback.onProgress("opencv", "running", "Đang trích xuất các vùng màu và polygon...");
            addLog(logs, "OpenCV", "START", "Bắt đầu trích xuất polygon bằng OpenCV");

            // Pass coordinates to OpenCV if available
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
                callback.onProgress("opencv", "completed", "Hoàn thành trích xuất " + zones.size() + " vùng");
            } else {
                addLog(logs, "OpenCV", "WARNING", "Không trích xuất được polygon");
                callback.onProgress("opencv", "warning", "Sử dụng fallback");
            }

            // Extract legend info from OpenCV result (optimized flow)
            @SuppressWarnings("unchecked")
            Map<String, Object> legendInfo = opencvResult != null ? 
                    (Map<String, Object>) opencvResult.get("legend") : null;
            
            if (legendInfo != null && legendInfo.get("base64") != null) {
                addLog(logs, "OpenCV", "SUCCESS", "Đã tách ảnh legend tại: " + legendInfo.get("position"));
            }

            // Step 3: GPT-4o Vision - Label colors and identify soil types
            // OPTIMIZED: Use legend image if available (much smaller than full map)
            callback.onProgress("gpt4o", "running", "AI đang phân loại loại đất từ chú giải...");
            addLog(logs, "GPT-4o", "START", "Bắt đầu phân loại màu sắc bằng GPT-4o");

            Map<String, Object> colorMapping = labelColorsWithGPT4o(imageFile, colorSummary, province, legendInfo);

            if (colorMapping != null && !colorMapping.isEmpty()) {
                result.put("colorMapping", colorMapping);

                // Apply labels to zones - use fillColor key (matches Python output)
                @SuppressWarnings("unchecked")
                Map<String, String> colorToSoil = (Map<String, String>) colorMapping.getOrDefault("colorToSoil",
                        new HashMap<>());
                String dominantType = (String) colorMapping.get("dominantType");

                // Step 4: POST-PROCESSING - Map AI names to DB codes
                // This is the "smart translator" that links AI output to database
                int mappedCount = 0;
                int unmappedCount = 0;
                Map<String, String> colorToCode = new HashMap<>(); // For result
                
                for (Map<String, Object> zone : zones) {
                    // Python outputs 'fillColor'
                    String color = (String) zone.getOrDefault("fillColor", zone.get("color"));
                    if (color != null && colorToSoil.containsKey(color)) {
                        String aiSoilName = colorToSoil.get(color);
                        
                        // Map AI name to DB code using SoilTypeMappingService
                        String dbCode = soilTypeMappingService.mapAiNameToCode(aiSoilName);
                        
                        if (dbCode != null) {
                            // Found mapping! Get full SoilType info
                            Optional<SoilType> soilTypeOpt = soilTypeMappingService.getSoilTypeByCode(dbCode);
                            if (soilTypeOpt.isPresent()) {
                                SoilType soilType = soilTypeOpt.get();
                                // Enrich zone with full DB info
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
                                gpt4oLogger.debug("Mapped '{}' -> {} ({})", aiSoilName, dbCode, soilType.getName());
                            }
                        } else {
                            // No mapping found - use AI name but generate code
                            String generatedCode = "AI_" + color.replace("#", "").substring(0, 6).toUpperCase();
                            zone.put("zoneCode", generatedCode);
                            zone.put("zoneType", aiSoilName);
                            zone.put("landUsePurpose", aiSoilName);
                            unmappedCount++;
                            gpt4oLogger.warn("No DB mapping for '{}', using generated code: {}", aiSoilName, generatedCode);
                        }
                    }
                }
                
                result.put("colorToCode", colorToCode);
                result.put("dominantType", dominantType);
                
                // Map dominant type to DB code too
                if (dominantType != null) {
                    String dominantCode = soilTypeMappingService.mapAiNameToCode(dominantType);
                    if (dominantCode != null) {
                        result.put("dominantCode", dominantCode);
                    }
                }
                
                addLog(logs, "GPT-4o", "SUCCESS", 
                        String.format("Đã gán nhãn %d màu. Mapped: %d, Unmapped: %d", 
                                colorToSoil.size(), mappedCount, unmappedCount));
                callback.onProgress("gpt4o", "completed", 
                        String.format("Hoàn thành phân loại: %d/%d màu đã liên kết DB", mappedCount, colorToSoil.size()));
            } else {
                addLog(logs, "GPT-4o", "WARNING", "Không thể đọc chú giải");
                callback.onProgress("gpt4o", "warning", "Bỏ qua phân loại");
            }

            // Final summary
            result.put("logs", logs);
            result.put("province", province);
            result.put("district", district);
            result.put("originalImage", imageFile.getAbsolutePath());
            result.put("analysisTime", System.currentTimeMillis());
            result.put("success", true);

            logger.info("=== MULTI-AI ORCHESTRATION COMPLETE ===");
            logger.info("Total zones detected: {}",
                    ((List<?>) result.getOrDefault("zones", Collections.emptyList())).size());

        } catch (Exception e) {
            logger.error("Multi-AI orchestration failed: {}", e.getMessage(), e);
            result.put("success", false);
            result.put("error", e.getMessage());
            result.put("logs", logs);
            addLog(logs, "System", "ERROR", "Lỗi hệ thống: " + e.getMessage());
        }

        return result;
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

        try {
            // Create output JSON path
            Path tempDir = Files.createTempDirectory("map_polygons_");
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
        }
    }

    /**
     * Step 3 (OPTIMIZED): Use GPT-4o to label colors with soil types
     * Now uses extracted legend image if available (10-20x smaller than full map)
     * Falls back to full image if legend extraction failed
     * 
     * @param imageFile Full map image (fallback)
     * @param colorSummary List of detected colors from OpenCV
     * @param province Province name for context
     * @param legendInfo Legend info from OpenCV containing base64 encoded legend crop
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> labelColorsWithGPT4o(File imageFile, List<Map<String, Object>> colorSummary,
            String province, Map<String, Object> legendInfo) {
        gpt4oLogger.info("[HYBRID] Starting color labeling for: {}", imageFile.getName());

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
            
            // Get standard soil type names from DB for better AI guidance
            String standardSoilTypes = soilTypeMappingService.formatSoilTypesForPrompt();
            
            String promptText;
            if (usingLegendImage) {
                // OPTIMIZED PROMPT: Direct legend reading with standard soil types reference
                promptText = String.format(
                    "Day la BANG CHU GIAI (legend) cua ban do tho nhuong tinh %s. " +
                    "Cac mau da phat hien tren ban do: %s. \n\n" +
                    "DANH SACH LOAI DAT CHUAN CUA VIET NAM (hay co gang gan dung ten nay):\n%s\n" +
                    "HAY DOC CHINH XAC ten loai dat trong chu giai va GAN DUNG TEN CHUAN o tren neu co the. " +
                    "Tra ve JSON: {\"colorToSoil\":{\"#hex\":\"ten loai dat chuan\",...},\"dominantType\":\"loai dat pho bien nhat\"}",
                    province, colorList.toString(), standardSoilTypes);
            } else {
                // FALLBACK PROMPT: Full map reading with standard soil types reference
                promptText = String.format(
                    "Nhin vao chu giai (legend) cua ban do %s. Cac mau chinh: %s. \n\n" +
                    "DANH SACH LOAI DAT CHUAN:\n%s\n" +
                    "Gan ten loai dat CHUAN cho tung mau. JSON: " +
                    "{\"colorToSoil\":{\"#hex\":\"ten loai dat chuan\",...},\"dominantType\":\"loai dat pho bien nhat\"}",
                    province, colorList.toString(), standardSoilTypes);
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
}
