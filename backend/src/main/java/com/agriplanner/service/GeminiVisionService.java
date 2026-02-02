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
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.io.File;
import java.nio.file.Files;
import java.util.*;

/**
 * Google Gemini Vision Service
 * Chuyên xử lý tác vụ Vision (đọc tọa độ, text nhỏ trên bản đồ)
 * 
 * Gemini 1.5 Pro có khả năng OCR/Vision tốt hơn cho:
 * - Đọc số tọa độ nhỏ trên góc bản đồ
 * - Nhận diện text tiếng Việt có dấu
 * - Xử lý hình ảnh lớn với context window lớn
 */
@Service
public class GeminiVisionService {

    // private static final Logger logger =
    // LoggerFactory.getLogger(GeminiVisionService.class); // Unused
    private static final Logger geminiLogger = LoggerFactory.getLogger("AI.Gemini");

    @Value("${ai.gemini.api-key:}")
    private String geminiApiKey;

    @Value("${ai.gemini.model:gemini-1.5-pro}")
    private String geminiModel;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    // Gemini API endpoint
    private static final String GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models/";

    /**
     * Error types for detailed error handling
     */
    public enum GeminiErrorType {
        SUCCESS,
        QUOTA_EXCEEDED, // 429 - Rate limit/quota exceeded
        INVALID_API_KEY, // 401/403 - Invalid or missing API key
        MODEL_NOT_FOUND, // 404 - Model doesn't exist
        CONTENT_FILTERED, // Content was blocked by safety filters
        TIMEOUT, // Request timed out
        NETWORK_ERROR, // Connection issues
        PARSE_ERROR, // Failed to parse response
        UNKNOWN_ERROR // Other errors
    }

    /**
     * Result wrapper with error details
     */
    public static class GeminiResult {
        private final boolean success;
        private final Map<String, Object> data;
        private final GeminiErrorType errorType;
        private final String errorMessage;
        private final String errorDetails;

        private GeminiResult(boolean success, Map<String, Object> data,
                GeminiErrorType errorType, String errorMessage, String errorDetails) {
            this.success = success;
            this.data = data;
            this.errorType = errorType;
            this.errorMessage = errorMessage;
            this.errorDetails = errorDetails;
        }

        public static GeminiResult success(Map<String, Object> data) {
            return new GeminiResult(true, data, GeminiErrorType.SUCCESS, null, null);
        }

        public static GeminiResult error(GeminiErrorType type, String message, String details) {
            return new GeminiResult(false, null, type, message, details);
        }

        public boolean isSuccess() {
            return success;
        }

        public Map<String, Object> getData() {
            return data;
        }

        public GeminiErrorType getErrorType() {
            return errorType;
        }

        public String getErrorMessage() {
            return errorMessage;
        }

        public String getErrorDetails() {
            return errorDetails;
        }

        public boolean shouldFallback() {
            // Should use fallback for these error types
            return errorType == GeminiErrorType.QUOTA_EXCEEDED ||
                    errorType == GeminiErrorType.INVALID_API_KEY ||
                    errorType == GeminiErrorType.MODEL_NOT_FOUND ||
                    errorType == GeminiErrorType.NETWORK_ERROR ||
                    errorType == GeminiErrorType.TIMEOUT;
        }
    }

    /**
     * Check if Gemini service is configured
     */
    public boolean isConfigured() {
        return geminiApiKey != null && !geminiApiKey.isEmpty();
    }

    /**
     * Analyze map image to extract coordinates using Gemini 1.5 Pro
     * 
     * @param imageFile The map image file
     * @return GeminiResult with coordinates or error details
     */
    public GeminiResult analyzeCoordinates(File imageFile) {
        geminiLogger.info("=== GEMINI COORDINATE ANALYSIS START ===");
        geminiLogger.info("Image: {}, Size: {} KB", imageFile.getName(), imageFile.length() / 1024);

        if (!isConfigured()) {
            geminiLogger.warn("Gemini API key not configured");
            return GeminiResult.error(GeminiErrorType.INVALID_API_KEY,
                    "Gemini API key not configured",
                    "Please set GEMINI_API_KEY in environment variables");
        }

        try {
            // Read and encode image
            byte[] imageBytes = Files.readAllBytes(imageFile.toPath());
            String base64Image = Base64.getEncoder().encodeToString(imageBytes);
            String mimeType = getMimeType(imageFile);

            geminiLogger.debug("Image encoded: {} bytes, MIME: {}", imageBytes.length, mimeType);

            // Build Gemini API URL
            String apiUrl = GEMINI_API_BASE + geminiModel + ":generateContent?key=" + geminiApiKey;

            // Build request body
            ObjectNode requestBody = objectMapper.createObjectNode();

            // Contents array
            ArrayNode contents = requestBody.putArray("contents");
            ObjectNode content = contents.addObject();
            ArrayNode parts = content.putArray("parts");

            // Text prompt (GIS expert instruction)
            ObjectNode textPart = parts.addObject();
            textPart.put("text", """
                    You are a GIS expert specializing in Vietnamese maps. Analyze this map image carefully.

                    TASK: Find geographic coordinates (latitude/longitude) for the map boundaries.

                    LOOK FOR:
                    1. Coordinate numbers printed on map edges/corners (format: 10°15'30" or 105.7890)
                    2. Scale bar and scale ratio (e.g., 1:25000, 1:50000)
                    3. Province name (Tỉnh) and District name (Huyện/Quận)
                    4. Map title containing location information

                    RETURN JSON ONLY (no markdown, no explanation):
                    {
                      "sw": {"lat": <southwest_latitude>, "lng": <southwest_longitude>},
                      "ne": {"lat": <northeast_latitude>, "lng": <northeast_longitude>},
                      "center": {"lat": <center_latitude>, "lng": <center_longitude>},
                      "scale": "<scale_ratio>",
                      "province": "<province_name>",
                      "district": "<district_name>",
                      "confidence": "<high|medium|low>",
                      "source": "<where_coordinates_found>"
                    }

                    If exact coordinates are not visible, estimate based on province/district location in Vietnam.
                    Vietnam coordinates are roughly: Lat 8-23°N, Lng 102-110°E
                    """);

            // Image part
            ObjectNode imagePart = parts.addObject();
            ObjectNode inlineData = imagePart.putObject("inlineData");
            inlineData.put("mimeType", mimeType);
            inlineData.put("data", base64Image);

            // Generation config
            ObjectNode generationConfig = requestBody.putObject("generationConfig");
            generationConfig.put("temperature", 0.1);
            generationConfig.put("maxOutputTokens", 1024);
            generationConfig.put("topP", 0.8);

            // Safety settings (allow all for map analysis)
            ArrayNode safetySettings = requestBody.putArray("safetySettings");
            String[] categories = { "HARM_CATEGORY_HARASSMENT", "HARM_CATEGORY_HATE_SPEECH",
                    "HARM_CATEGORY_SEXUALLY_EXPLICIT", "HARM_CATEGORY_DANGEROUS_CONTENT" };
            for (String category : categories) {
                ObjectNode setting = safetySettings.addObject();
                setting.put("category", category);
                setting.put("threshold", "BLOCK_NONE");
            }

            // Make HTTP request
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<String> entity = new HttpEntity<>(requestBody.toString(), headers);

            geminiLogger.info("Calling Gemini {} API...", geminiModel);
            long startTime = System.currentTimeMillis();

            @SuppressWarnings("null")
            ResponseEntity<String> response = restTemplate.exchange(
                    apiUrl, HttpMethod.POST, entity, String.class);

            long duration = System.currentTimeMillis() - startTime;
            geminiLogger.info("Gemini response received in {}ms, status: {}", duration, response.getStatusCode());

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                return parseGeminiResponse(response.getBody());
            } else {
                geminiLogger.warn("Unexpected response status: {}", response.getStatusCode());
                return GeminiResult.error(GeminiErrorType.UNKNOWN_ERROR,
                        "Unexpected response status: " + response.getStatusCode(),
                        response.getBody());
            }

        } catch (HttpClientErrorException e) {
            return handleHttpError(e);
        } catch (Exception e) {
            geminiLogger.error("Gemini analysis failed: {}", e.getMessage(), e);
            return GeminiResult.error(GeminiErrorType.UNKNOWN_ERROR,
                    "Analysis failed: " + e.getMessage(),
                    e.getClass().getSimpleName());
        }
    }

    /**
     * Parse Gemini API response
     */
    private GeminiResult parseGeminiResponse(String responseBody) {
        try {
            JsonNode responseJson = objectMapper.readTree(responseBody);

            // Check for error in response
            if (responseJson.has("error")) {
                JsonNode error = responseJson.get("error");
                String code = error.path("code").asText();
                String message = error.path("message").asText();

                geminiLogger.error("Gemini API error: {} - {}", code, message);

                GeminiErrorType errorType = switch (code) {
                    case "429" -> GeminiErrorType.QUOTA_EXCEEDED;
                    case "401", "403" -> GeminiErrorType.INVALID_API_KEY;
                    case "404" -> GeminiErrorType.MODEL_NOT_FOUND;
                    default -> GeminiErrorType.UNKNOWN_ERROR;
                };

                return GeminiResult.error(errorType, message, code);
            }

            // Extract text from response
            JsonNode candidates = responseJson.path("candidates");
            if (candidates.isEmpty() || !candidates.isArray()) {
                geminiLogger.warn("No candidates in response");
                return GeminiResult.error(GeminiErrorType.CONTENT_FILTERED,
                        "No response generated", "Response may have been filtered");
            }

            JsonNode firstCandidate = candidates.get(0);

            // Check finish reason
            String finishReason = firstCandidate.path("finishReason").asText();
            if ("SAFETY".equals(finishReason)) {
                geminiLogger.warn("Response blocked by safety filter");
                return GeminiResult.error(GeminiErrorType.CONTENT_FILTERED,
                        "Content blocked by safety filter", finishReason);
            }

            // Extract text content
            String text = firstCandidate.path("content").path("parts").get(0).path("text").asText();
            geminiLogger.debug("Gemini response text: {}", text);

            // Parse JSON from response
            String jsonStr = extractJsonFromText(text);
            if (jsonStr != null) {
                @SuppressWarnings("unchecked")
                Map<String, Object> coords = objectMapper.readValue(jsonStr, Map.class);

                // Validate coordinates are reasonable for Vietnam
                if (validateVietnameseCoordinates(coords)) {
                    geminiLogger.info("Successfully extracted coordinates: center={}", coords.get("center"));
                    return GeminiResult.success(coords);
                } else {
                    geminiLogger.warn("Coordinates outside Vietnam bounds, may be inaccurate");
                    coords.put("warning", "Coordinates may be inaccurate");
                    return GeminiResult.success(coords);
                }
            }

            geminiLogger.warn("Could not parse JSON from response");
            return GeminiResult.error(GeminiErrorType.PARSE_ERROR,
                    "Could not parse coordinates from response", text);

        } catch (Exception e) {
            geminiLogger.error("Failed to parse Gemini response: {}", e.getMessage());
            return GeminiResult.error(GeminiErrorType.PARSE_ERROR,
                    "Failed to parse response: " + e.getMessage(),
                    e.getClass().getSimpleName());
        }
    }

    /**
     * Handle HTTP errors with detailed error types
     */
    private GeminiResult handleHttpError(HttpClientErrorException e) {
        int statusCode = e.getStatusCode().value();
        String responseBody = e.getResponseBodyAsString();

        geminiLogger.error("Gemini HTTP error {}: {}", statusCode, responseBody);

        GeminiErrorType errorType;
        String message;

        switch (statusCode) {
            case 429 -> {
                errorType = GeminiErrorType.QUOTA_EXCEEDED;
                message = "API quota exceeded. Please wait or upgrade plan.";
                geminiLogger.warn("⚠️ QUOTA EXCEEDED - Will fallback to GPT-4o");
            }
            case 401, 403 -> {
                errorType = GeminiErrorType.INVALID_API_KEY;
                message = "Invalid or unauthorized API key";
            }
            case 404 -> {
                errorType = GeminiErrorType.MODEL_NOT_FOUND;
                message = "Model " + geminiModel + " not found";
            }
            case 408, 504 -> {
                errorType = GeminiErrorType.TIMEOUT;
                message = "Request timed out";
            }
            default -> {
                errorType = GeminiErrorType.UNKNOWN_ERROR;
                message = "HTTP error: " + statusCode;
            }
        }

        return GeminiResult.error(errorType, message, responseBody);
    }

    /**
     * Validate coordinates are within Vietnam bounds
     */
    private boolean validateVietnameseCoordinates(Map<String, Object> coords) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Number> center = (Map<String, Number>) coords.get("center");
            if (center == null)
                return false;

            double lat = center.get("lat").doubleValue();
            double lng = center.get("lng").doubleValue();

            // Vietnam bounds: Lat 8-24°N, Lng 102-110°E
            boolean validLat = lat >= 8.0 && lat <= 24.0;
            boolean validLng = lng >= 102.0 && lng <= 110.0;

            if (!validLat || !validLng) {
                geminiLogger.warn("Coordinates outside Vietnam: lat={}, lng={}", lat, lng);
            }

            return validLat && validLng;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Extract JSON from text that may contain markdown or other content
     */
    private String extractJsonFromText(String text) {
        if (text == null || text.isEmpty())
            return null;

        // Try to find JSON block
        int start = text.indexOf("{");
        int end = text.lastIndexOf("}");

        if (start >= 0 && end > start) {
            String jsonStr = text.substring(start, end + 1);
            try {
                objectMapper.readTree(jsonStr);
                return jsonStr;
            } catch (Exception e) {
                geminiLogger.debug("Invalid JSON extracted: {}", e.getMessage());
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
     * Get MIME type from file extension
     */
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

    /**
     * Get current model name for logging
     */
    public String getModelName() {
        return geminiModel;
    }
}
