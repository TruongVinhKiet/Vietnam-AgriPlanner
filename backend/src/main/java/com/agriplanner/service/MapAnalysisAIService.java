package com.agriplanner.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.*;

/**
 * Service phân tích bản đồ thổ nhưỡng và quy hoạch sử dụng AI Vision
 * Primary: GitHub Models (GPT-4o) - Hỗ trợ phân tích hình ảnh
 * Backup: Google Gemini 1.5 Pro - Khi GitHub hết lượt
 */
@Service
@SuppressWarnings({ "null", "unchecked" })
public class MapAnalysisAIService {

    private static final Logger logger = LoggerFactory.getLogger(MapAnalysisAIService.class);

    @Value("${ai.github.token:}")
    private String githubToken;

    @Value("${ai.github.model:gpt-4o}")
    private String githubModel;

    @Value("${ai.gemini.api-key:}")
    private String geminiApiKey;

    @Value("${ai.gemini.model:gemini-1.5-pro}")
    private String geminiModel;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    // API Endpoints
    private static final String GITHUB_API_URL = "https://models.inference.ai.azure.com/chat/completions";
    private static final String GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s";

    // Map colors for soil types (Vietnamese) - Theo chú dẫn bản đồ Cà Mau
    private static final Map<String, String> SOIL_TYPE_COLORS = new LinkedHashMap<>() {
        {
            // Đất cát giồng - Vàng tươi
            put("Đất cát giồng", "#FFFF00,#FFFF32,#FFFF64");
            // Đất mặn - Hồng nhạt/Cam nhạt
            put("Đất mặn nhiều", "#FFC8B4,#FFB4A0");
            put("Đất mặn trung bình", "#FFD2BE,#FFDCC8");
            put("Đất mặn ít", "#FFDCC8,#FFE6D2");
            // Đất phèn tiềm tàng nông
            put("Đất phèn tiềm tàng nông dưới rừng ngập mặn", "#E6C8FF,#DCC8FA");
            put("Đất phèn tiềm tàng nông, mặn nhiều", "#C896C8,#D2A0D2");
            put("Đất phèn tiềm tàng nông, mặn trung bình", "#D2A0D2,#DCB4DC");
            put("Đất phèn tiềm tàng nông, mặn ít", "#DCB4DC,#E6C8E6");
            // Đất phèn tiềm tàng sâu
            put("Đất phèn tiềm tàng sâu dưới rừng ngập mặn", "#C8DCFF,#B4C8F0");
            put("Đất phèn tiềm tàng sâu, mặn nhiều", "#F0B4DC,#E6BEE6");
            put("Đất phèn tiềm tàng sâu, mặn trung bình", "#E6BEE6,#DCC8EB");
            put("Đất phèn tiềm tàng sâu, mặn ít", "#DCC8EB,#D2D2F0");
            // Đất phèn hoạt động nông - Hồng đậm/Magenta
            put("Đất phèn hoạt động nông, mặn nhiều", "#FF6496,#E65082");
            put("Đất phèn hoạt động nông, mặn trung bình", "#FF78AA,#FF96BE");
            put("Đất phèn hoạt động nông, mặn ít", "#FF96BE,#FFA0C8");
            // Đất phèn hoạt động sâu - Đỏ tím
            put("Đất phèn hoạt động sâu, mặn nhiều", "#DC5078,#C86496");
            put("Đất phèn hoạt động sâu, mặn trung bình", "#C86496,#B478AA");
            put("Đất phèn hoạt động sâu, mặn ít", "#B478AA,#A08CBE");
            // Đất than bùn - Tím đậm
            put("Đất than bùn phèn mặn", "#643282,#50286E,#4B0082");
            // Đất vàng đỏ - Cam
            put("Đất vàng đỏ trên đá Macma axit", "#FFA082,#FF8C6E,#FF7F50");
            // Sông suối - Cyan
            put("Sông, suối, ao hồ", "#00C8C8,#64C8DC,#87CEEB");
            // Bãi bồi - Xanh ngọc nhạt
            put("Bãi bồi ven sông, ven biển", "#B4E6E6,#C8F0F0,#40E0D0");
            // Đất phù sa
            put("Đất phù sa ngọt", "#90EE90,#98FB98");
            put("Đất phù sa", "#B4FFB4,#C8FFC8");
            // Đất xám
            put("Đất xám", "#A9A9A9,#C0C0C0,#969696");
        }
    };

    // Planning zone types
    private static final Map<String, String> PLANNING_ZONE_COLORS = new LinkedHashMap<>() {
        {
            put("Đất nông nghiệp", "#90EE90,#98FB98,#00FF00"); // Green
            put("Đất lâm nghiệp", "#006400,#228B22,#2E8B57"); // Dark green
            put("Đất ở đô thị", "#FF69B4,#FF1493,#C71585"); // Pink
            put("Đất ở nông thôn", "#FFB6C1,#FFC0CB,#FFE4E1"); // Light pink
            put("Đất công nghiệp", "#4169E1,#0000CD,#000080"); // Blue
            put("Đất thương mại", "#FF8C00,#FFA500,#FF7F50"); // Orange
            put("Đất giao thông", "#808080,#A9A9A9,#C0C0C0"); // Gray
            put("Đất thủy lợi", "#00CED1,#20B2AA,#48D1CC"); // Cyan
            put("Đất di tích", "#8B4513,#A0522D,#D2691E"); // Brown
            put("Đất quốc phòng", "#800000,#8B0000,#A52A2A"); // Maroon
        }
    };

    /**
     * Phân tích bản đồ thổ nhưỡng sử dụng AI Vision
     * 
     * @param imageFile File ảnh bản đồ
     * @param mapType   Loại bản đồ: "soil" hoặc "planning"
     * @return JSON kết quả phân tích các vùng
     */
    public Map<String, Object> analyzeMapImage(File imageFile, String mapType) {
        logger.info("Starting AI analysis for map: {} (type: {})", imageFile.getName(), mapType);

        try {
            // Convert image to base64
            byte[] imageBytes = Files.readAllBytes(imageFile.toPath());
            String base64Image = Base64.getEncoder().encodeToString(imageBytes);
            String mimeType = getMimeType(imageFile.getName());

            // Try GitHub Models first
            if (isConfigured(githubToken)) {
                try {
                    Map<String, Object> result = analyzeWithGitHub(base64Image, mimeType, mapType);
                    if (result != null && !result.isEmpty()) {
                        logger.info("GitHub Models analysis successful");
                        return result;
                    }
                } catch (Exception e) {
                    logger.warn("GitHub Models failed: {}, trying Gemini backup", e.getMessage());
                }
            }

            // Fallback to Gemini
            if (isConfigured(geminiApiKey)) {
                try {
                    Map<String, Object> result = analyzeWithGemini(base64Image, mimeType, mapType);
                    if (result != null && !result.isEmpty()) {
                        logger.info("Gemini analysis successful");
                        return result;
                    }
                } catch (Exception e) {
                    logger.error("Gemini also failed: {}", e.getMessage());
                }
            }

            logger.warn("All AI providers failed, returning empty result");
            return Collections.emptyMap();

        } catch (IOException e) {
            logger.error("Failed to read image file: {}", e.getMessage());
            return Collections.emptyMap();
        }
    }

    /**
     * Phân tích với GitHub Models (GPT-4o Vision)
     */
    private Map<String, Object> analyzeWithGitHub(String base64Image, String mimeType, String mapType) {
        logger.debug("Calling GitHub Models API with model: {}", githubModel);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(githubToken);

        String systemPrompt = buildSystemPrompt(mapType);
        String userPrompt = buildUserPrompt(mapType);

        // Build request body with vision
        ObjectNode requestBody = objectMapper.createObjectNode();
        requestBody.put("model", githubModel);
        requestBody.put("max_tokens", 4096);
        requestBody.put("temperature", 0.2); // Low temperature for consistent analysis

        ArrayNode messages = requestBody.putArray("messages");

        // System message
        ObjectNode systemMsg = messages.addObject();
        systemMsg.put("role", "system");
        systemMsg.put("content", systemPrompt);

        // User message with image
        ObjectNode userMsg = messages.addObject();
        userMsg.put("role", "user");
        ArrayNode content = userMsg.putArray("content");

        // Text part
        ObjectNode textPart = content.addObject();
        textPart.put("type", "text");
        textPart.put("text", userPrompt);

        // Image part
        ObjectNode imagePart = content.addObject();
        imagePart.put("type", "image_url");
        ObjectNode imageUrl = imagePart.putObject("image_url");
        imageUrl.put("url", "data:" + mimeType + ";base64," + base64Image);
        imageUrl.put("detail", "high"); // High detail for map analysis

        HttpEntity<String> entity = new HttpEntity<>(requestBody.toString(), headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    GITHUB_API_URL,
                    HttpMethod.POST,
                    entity,
                    String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return parseAIResponse(response.getBody(), "github");
            }
        } catch (Exception e) {
            logger.error("GitHub API error: {}", e.getMessage());
            throw e;
        }

        return null;
    }

    /**
     * Phân tích với Google Gemini (Backup)
     */
    private Map<String, Object> analyzeWithGemini(String base64Image, String mimeType, String mapType) {
        logger.debug("Calling Gemini API with model: {}", geminiModel);

        String url = String.format(GEMINI_API_URL, geminiModel, geminiApiKey);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        String prompt = buildSystemPrompt(mapType) + "\n\n" + buildUserPrompt(mapType);

        // Build Gemini request
        ObjectNode requestBody = objectMapper.createObjectNode();
        ArrayNode contents = requestBody.putArray("contents");
        ObjectNode content = contents.addObject();
        ArrayNode parts = content.putArray("parts");

        // Text part
        ObjectNode textPart = parts.addObject();
        textPart.put("text", prompt);

        // Image part
        ObjectNode imagePart = parts.addObject();
        ObjectNode inlineData = imagePart.putObject("inline_data");
        inlineData.put("mime_type", mimeType);
        inlineData.put("data", base64Image);

        // Generation config
        ObjectNode generationConfig = requestBody.putObject("generationConfig");
        generationConfig.put("temperature", 0.2);
        generationConfig.put("maxOutputTokens", 4096);

        HttpEntity<String> entity = new HttpEntity<>(requestBody.toString(), headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return parseAIResponse(response.getBody(), "gemini");
            }
        } catch (Exception e) {
            logger.error("Gemini API error: {}", e.getMessage());
            throw e;
        }

        return null;
    }

    /**
     * Build system prompt for map analysis
     */
    private String buildSystemPrompt(String mapType) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("Bạn là chuyên gia phân tích bản đồ địa lý Việt Nam. ");

        if ("soil".equalsIgnoreCase(mapType)) {
            prompt.append("Nhiệm vụ: Phân tích bản đồ thổ nhưỡng (đất). ");
            prompt.append("Các loại đất phổ biến ở Việt Nam:\n");
            SOIL_TYPE_COLORS.forEach((type, colors) -> prompt.append("- ").append(type).append("\n"));
        } else {
            prompt.append("Nhiệm vụ: Phân tích bản đồ quy hoạch sử dụng đất. ");
            prompt.append("Các loại đất quy hoạch:\n");
            PLANNING_ZONE_COLORS.forEach((type, colors) -> prompt.append("- ").append(type).append("\n"));
        }

        prompt.append("\nQuy tắc phân tích:\n");
        prompt.append("1. Xác định từng vùng màu khác nhau trên bản đồ\n");
        prompt.append("2. Ước tính tọa độ tương đối (0-100%) của từng vùng\n");
        prompt.append("3. Phân loại loại đất/quy hoạch dựa trên màu sắc và chú thích\n");
        prompt.append("4. Ước tính diện tích phần trăm của từng vùng\n");

        return prompt.toString();
    }

    /**
     * Build user prompt for map analysis
     */
    private String buildUserPrompt(String mapType) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("Phân tích hình ảnh bản đồ này và trả về kết quả dạng JSON.\n\n");
        prompt.append("Yêu cầu định dạng JSON:\n");
        prompt.append("```json\n");
        prompt.append("{\n");
        prompt.append("  \"zones\": [\n");
        prompt.append("    {\n");
        prompt.append("      \"id\": 1,\n");
        prompt.append("      \"type\": \"Tên loại đất/quy hoạch\",\n");
        prompt.append("      \"color\": \"#HEX màu chính\",\n");
        prompt.append("      \"areaPercent\": 25.5,\n");
        prompt.append("      \"bounds\": {\n");
        prompt.append("        \"minX\": 10,\n");
        prompt.append("        \"minY\": 20,\n");
        prompt.append("        \"maxX\": 50,\n");
        prompt.append("        \"maxY\": 60\n");
        prompt.append("      },\n");
        prompt.append("      \"description\": \"Mô tả ngắn về vùng này\"\n");
        prompt.append("    }\n");
        prompt.append("  ],\n");
        prompt.append("  \"summary\": \"Tổng quan về bản đồ\",\n");
        prompt.append("  \"totalZones\": 5,\n");
        prompt.append("  \"dominantType\": \"Loại đất/quy hoạch chiếm diện tích lớn nhất\"\n");
        prompt.append("}\n");
        prompt.append("```\n\n");
        prompt.append("CHỈ trả về JSON, không có text khác. Tọa độ bounds là phần trăm (0-100).");

        return prompt.toString();
    }

    /**
     * Parse AI response to structured Map
     */
    private Map<String, Object> parseAIResponse(String responseBody, String provider) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            String content;

            if ("github".equals(provider)) {
                content = root.path("choices").get(0).path("message").path("content").asText();
            } else { // gemini
                content = root.path("candidates").get(0).path("content").path("parts").get(0).path("text").asText();
            }

            // Extract JSON from response (may be wrapped in markdown code block)
            content = extractJsonFromResponse(content);

            if (content != null && !content.isEmpty()) {
                JsonNode resultJson = objectMapper.readTree(content);
                return objectMapper.convertValue(resultJson, Map.class);
            }
        } catch (Exception e) {
            logger.error("Failed to parse AI response: {}", e.getMessage());
        }

        return Collections.emptyMap();
    }

    /**
     * Extract JSON from markdown code block if present
     */
    private String extractJsonFromResponse(String response) {
        if (response == null)
            return null;

        // Remove markdown code blocks
        response = response.trim();
        if (response.startsWith("```json")) {
            response = response.substring(7);
        } else if (response.startsWith("```")) {
            response = response.substring(3);
        }

        if (response.endsWith("```")) {
            response = response.substring(0, response.length() - 3);
        }

        return response.trim();
    }

    /**
     * Get MIME type from filename
     */
    private String getMimeType(String filename) {
        String lower = filename.toLowerCase();
        if (lower.endsWith(".png"))
            return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg"))
            return "image/jpeg";
        if (lower.endsWith(".gif"))
            return "image/gif";
        if (lower.endsWith(".webp"))
            return "image/webp";
        return "image/png"; // default
    }

    /**
     * Check if a config value is set
     */
    private boolean isConfigured(String value) {
        return value != null && !value.isEmpty() && !value.equals("null");
    }

    /**
     * Test AI connection
     */
    public Map<String, Object> testConnection() {
        Map<String, Object> result = new HashMap<>();

        result.put("github", Map.of(
                "configured", isConfigured(githubToken),
                "model", githubModel));

        result.put("gemini", Map.of(
                "configured", isConfigured(geminiApiKey),
                "model", geminiModel));

        return result;
    }

    /**
     * Kết hợp kết quả OpenCV và AI để cải thiện độ chính xác
     * 
     * @param opencvZones Kết quả từ OpenCV (Python script)
     * @param aiZones     Kết quả từ AI Vision
     * @return Kết quả đã merge và validate
     */
    public List<Map<String, Object>> mergeAnalysisResults(
            List<Map<String, Object>> opencvZones,
            Map<String, Object> aiZones) {

        List<Map<String, Object>> mergedZones = new ArrayList<>();

        // If AI zones available, use as primary with OpenCV for validation
        if (aiZones != null && aiZones.containsKey("zones")) {
            List<Map<String, Object>> aiZoneList = (List<Map<String, Object>>) aiZones.get("zones");

            for (Map<String, Object> aiZone : aiZoneList) {
                Map<String, Object> merged = new HashMap<>(aiZone);

                // Try to match with OpenCV zone by position
                Map<String, Object> matchingOpencvZone = findMatchingZone(aiZone, opencvZones);
                if (matchingOpencvZone != null) {
                    // Use OpenCV's precise polygon coordinates if available
                    if (matchingOpencvZone.containsKey("coordinates")) {
                        merged.put("coordinates", matchingOpencvZone.get("coordinates"));
                    }
                    merged.put("validated", true);
                } else {
                    merged.put("validated", false);
                }

                mergedZones.add(merged);
            }
        } else if (opencvZones != null) {
            // Fallback to OpenCV only
            mergedZones.addAll(opencvZones);
        }

        return mergedZones;
    }

    /**
     * Find matching zone from OpenCV results based on position overlap
     */
    private Map<String, Object> findMatchingZone(Map<String, Object> aiZone, List<Map<String, Object>> opencvZones) {
        if (opencvZones == null || opencvZones.isEmpty())
            return null;

        Map<String, Object> aiBounds = (Map<String, Object>) aiZone.get("bounds");
        if (aiBounds == null)
            return null;

        double aiCenterX = (getDouble(aiBounds, "minX") + getDouble(aiBounds, "maxX")) / 2;
        double aiCenterY = (getDouble(aiBounds, "minY") + getDouble(aiBounds, "maxY")) / 2;

        for (Map<String, Object> cvZone : opencvZones) {
            Map<String, Object> cvBounds = (Map<String, Object>) cvZone.get("bounds");
            if (cvBounds != null) {
                double cvMinX = getDouble(cvBounds, "minX");
                double cvMaxX = getDouble(cvBounds, "maxX");
                double cvMinY = getDouble(cvBounds, "minY");
                double cvMaxY = getDouble(cvBounds, "maxY");

                // Check if AI zone center is within OpenCV zone bounds
                if (aiCenterX >= cvMinX && aiCenterX <= cvMaxX &&
                        aiCenterY >= cvMinY && aiCenterY <= cvMaxY) {
                    return cvZone;
                }
            }
        }

        return null;
    }

    private double getDouble(Map<String, Object> map, String key) {
        Object val = map.get(key);
        if (val instanceof Number) {
            return ((Number) val).doubleValue();
        }
        return 0.0;
    }

    /**
     * Analyze multiple images and merge results
     * Optimizes token usage by analyzing images in batches
     */
    public Map<String, Object> analyzeMultipleImages(List<File> imageFiles, String mapType) {
        logger.info("Analyzing {} images for map type: {}", imageFiles.size(), mapType);

        Map<String, Object> mergedResult = new HashMap<>();
        List<Map<String, Object>> allZones = new ArrayList<>();
        Map<String, Map<String, Object>> colorMapping = new LinkedHashMap<>();

        // Analyze each image
        for (int i = 0; i < imageFiles.size(); i++) {
            File imageFile = imageFiles.get(i);
            logger.info("Analyzing image {}/{}: {}", i + 1, imageFiles.size(), imageFile.getName());

            try {
                Map<String, Object> result = analyzeMapImage(imageFile, mapType);

                if (result != null && !result.isEmpty()) {
                    // Extract zones
                    @SuppressWarnings("rawtypes")
                    List<Map<String, Object>> zones = (List) result.get("zones");
                    if (zones != null) {
                        // Add source image info to each zone
                        for (Map<String, Object> zone : zones) {
                            zone.put("sourceImage", imageFile.getName());
                            zone.put("imageIndex", i);
                        }
                        allZones.addAll(zones);
                    }

                    // Merge color mapping
                    @SuppressWarnings("rawtypes")
                    Map<String, Map<String, Object>> colors = (Map) result.get("colorMapping");
                    if (colors != null) {
                        colors.forEach((color, info) -> {
                            if (colorMapping.containsKey(color)) {
                                // Merge counts
                                Map<String, Object> existing = colorMapping.get(color);
                                int existingCount = (int) existing.getOrDefault("count", 0);
                                int newCount = (int) info.getOrDefault("count", 0);
                                existing.put("count", existingCount + newCount);
                            } else {
                                colorMapping.put(color, info);
                            }
                        });
                    }
                }
            } catch (Exception e) {
                logger.error("Error analyzing image {}: {}", imageFile.getName(), e.getMessage());
                // Continue with other images
            }
        }

        // Build merged result
        mergedResult.put("zones", allZones);
        mergedResult.put("totalZones", allZones.size());
        mergedResult.put("colorMapping", colorMapping);
        mergedResult.put("imagesAnalyzed", imageFiles.size());

        // Calculate dominant type
        Map<String, Integer> typeCount = new HashMap<>();
        for (Map<String, Object> zone : allZones) {
            String type = (String) zone.getOrDefault("soilType", zone.getOrDefault("zoneType", "Unknown"));
            typeCount.put(type, typeCount.getOrDefault(type, 0) + 1);
        }

        String dominantType = typeCount.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("Unknown");

        mergedResult.put("dominantType", dominantType);
        mergedResult.put("summary", String.format(
                "Đã phân tích %d ảnh, tìm thấy %d vùng, loại phổ biến nhất: %s",
                imageFiles.size(), allZones.size(), dominantType));

        logger.info("Multi-image analysis complete: {} zones from {} images", allZones.size(), imageFiles.size());

        return mergedResult;
    }
}
