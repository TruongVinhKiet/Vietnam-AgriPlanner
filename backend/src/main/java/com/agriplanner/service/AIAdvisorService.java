package com.agriplanner.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

/**
 * AI Advisor Service - Tích hợp nhiều AI providers
 * 
 * Hỗ trợ:
 * 1. GitHub Models (Khuyên dùng - Miễn phí cho developers)
 * 2. Groq Cloud (Nhanh, rẻ)
 * 3. Cohere (Chuyên RAG/search)
 * 
 * @author AgriPlanner Team
 */
@Service
@SuppressWarnings({ "null", "unchecked" })
public class AIAdvisorService {

    private static final Logger logger = LoggerFactory.getLogger(AIAdvisorService.class);
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    // ============ API Keys (từ application.properties hoặc .env) ============
    @Value("${ai.github.token:}")
    private String githubToken;

    @Value("${ai.groq.api-key:}")
    private String groqApiKey;

    @Value("${ai.cohere.api-key:}")
    private String cohereApiKey;

    // ============ API Endpoints ============
    private static final String GITHUB_MODELS_URL = "https://models.inference.ai.azure.com/chat/completions";
    private static final String GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
    private static final String COHERE_API_URL = "https://api.cohere.ai/v2/chat";

    // ============ Default Models ============
    @Value("${ai.github.model:gpt-4o-mini}")
    private String githubModel; // gpt-4o, gpt-4o-mini, Llama-3.1-70B, etc.

    @Value("${ai.groq.model:llama-3.3-70b-versatile}")
    private String groqModel; // llama-3.3-70b-versatile, llama-3.1-8b-instant

    @Value("${ai.cohere.model:command-a-03-2025}")
    private String cohereModel; // command-a-03-2025, command-r-plus-08-2024

    /**
     * Đề xuất nông vụ dựa trên thông tin đất và thời tiết
     * Tự động chọn provider khả dụng
     */
    public Map<String, Object> getAgricultureAdvice(
            String soilType,
            String location,
            String currentSeason,
            Double temperature,
            Double humidity,
            Double rainfall,
            String existingCrops,
            String farmSize) {
        // Build prompt
        String prompt = buildAgriculturePrompt(soilType, location, currentSeason,
                temperature, humidity, rainfall, existingCrops, farmSize);

        String systemPrompt = """
                Bạn là chuyên gia nông nghiệp Việt Nam với 20 năm kinh nghiệm.
                Hãy đưa ra lời khuyên chi tiết, thực tế và phù hợp với điều kiện địa phương.

                Trả lời bằng tiếng Việt với format JSON:
                {
                    "recommended_crops": [
                        {
                            "name": "Tên cây trồng",
                            "reason": "Lý do phù hợp",
                            "planting_time": "Thời điểm trồng",
                            "harvest_time": "Thời điểm thu hoạch",
                            "expected_yield": "Năng suất dự kiến",
                            "care_tips": ["Mẹo chăm sóc 1", "Mẹo 2"]
                        }
                    ],
                    "soil_preparation": ["Bước chuẩn bị đất 1", "Bước 2"],
                    "fertilizer_schedule": [
                        {"stage": "Giai đoạn", "fertilizer": "Loại phân", "amount": "Liều lượng"}
                    ],
                    "pest_warnings": ["Cảnh báo sâu bệnh 1", "Cảnh báo 2"],
                    "weather_tips": "Lời khuyên theo thời tiết",
                    "additional_notes": "Ghi chú bổ sung"
                }
                """;

        // Try providers in order of preference
        Map<String, Object> result = null;

        // 1. Try GitHub Models first (best quality)
        if (isConfigured(githubToken)) {
            result = callGitHubModels(systemPrompt, prompt);
            if (result != null) {
                result.put("provider", "GitHub Models");
                return result;
            }
        }

        // 2. Try Groq (fastest)
        if (isConfigured(groqApiKey)) {
            result = callGroq(systemPrompt, prompt);
            if (result != null) {
                result.put("provider", "Groq");
                return result;
            }
        }

        // 3. Try Cohere
        if (isConfigured(cohereApiKey)) {
            result = callCohere(systemPrompt, prompt);
            if (result != null) {
                result.put("provider", "Cohere");
                return result;
            }
        }

        // No provider available
        logger.error("No AI provider configured or all failed");
        return Map.of(
                "error", true,
                "message", "Không có AI provider nào được cấu hình. Vui lòng thêm API key vào .env");
    }

    /**
     * ============ GITHUB MODELS ============
     * Docs: https://github.com/marketplace/models
     * Free for GitHub users!
     */
    private Map<String, Object> callGitHubModels(String systemPrompt, String userPrompt) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(githubToken);

            Map<String, Object> requestBody = Map.of(
                    "model", githubModel,
                    "messages", List.of(
                            Map.of("role", "system", "content", systemPrompt),
                            Map.of("role", "user", "content", userPrompt)),
                    "temperature", 0.7,
                    "max_tokens", 2000);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
            ResponseEntity<String> response = restTemplate.exchange(
                    GITHUB_MODELS_URL, HttpMethod.POST, entity, String.class);

            return parseOpenAIResponse(response.getBody());

        } catch (Exception e) {
            logger.error("GitHub Models error: {}", e.getMessage());
            return null;
        }
    }

    /**
     * ============ GROQ CLOUD ============
     * Docs: https://console.groq.com/docs/quickstart
     * Extremely fast inference!
     */
    private Map<String, Object> callGroq(String systemPrompt, String userPrompt) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(groqApiKey);

            Map<String, Object> requestBody = Map.of(
                    "model", groqModel,
                    "messages", List.of(
                            Map.of("role", "system", "content", systemPrompt),
                            Map.of("role", "user", "content", userPrompt)),
                    "temperature", 0.7,
                    "max_tokens", 2000);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
            ResponseEntity<String> response = restTemplate.exchange(
                    GROQ_API_URL, HttpMethod.POST, entity, String.class);

            return parseOpenAIResponse(response.getBody());

        } catch (Exception e) {
            logger.error("Groq error: {}", e.getMessage());
            return null;
        }
    }

    /**
     * ============ COHERE ============
     * Docs: https://docs.cohere.com/reference/chat
     * Best for RAG and document search
     */
    private Map<String, Object> callCohere(String systemPrompt, String userPrompt) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(cohereApiKey);

            Map<String, Object> requestBody = Map.of(
                    "model", cohereModel,
                    "preamble", systemPrompt,
                    "message", userPrompt,
                    "temperature", 0.7);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
            ResponseEntity<String> response = restTemplate.exchange(
                    COHERE_API_URL, HttpMethod.POST, entity, String.class);

            return parseCohereResponse(response.getBody());

        } catch (Exception e) {
            logger.error("Cohere error: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Parse OpenAI-compatible response (GitHub Models, Groq)
     */
    private Map<String, Object> parseOpenAIResponse(String responseBody) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            String content = root.path("choices").get(0).path("message").path("content").asText();

            // Try to parse as JSON
            try {
                // Extract JSON from markdown code block if present
                if (content.contains("```json")) {
                    content = content.substring(content.indexOf("```json") + 7);
                    content = content.substring(0, content.indexOf("```"));
                } else if (content.contains("```")) {
                    content = content.substring(content.indexOf("```") + 3);
                    content = content.substring(0, content.indexOf("```"));
                }

                return objectMapper.readValue(content.trim(), Map.class);
            } catch (Exception e) {
                // Return as plain text
                return Map.of("response", content, "parsed", false);
            }
        } catch (Exception e) {
            logger.error("Error parsing response: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Parse Cohere response
     */
    private Map<String, Object> parseCohereResponse(String responseBody) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            String content = root.path("text").asText();

            try {
                if (content.contains("```json")) {
                    content = content.substring(content.indexOf("```json") + 7);
                    content = content.substring(0, content.indexOf("```"));
                }
                return objectMapper.readValue(content.trim(), Map.class);
            } catch (Exception e) {
                return Map.of("response", content, "parsed", false);
            }
        } catch (Exception e) {
            logger.error("Error parsing Cohere response: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Build agriculture advice prompt
     */
    private String buildAgriculturePrompt(String soilType, String location, String currentSeason,
            Double temperature, Double humidity, Double rainfall, String existingCrops, String farmSize) {

        StringBuilder prompt = new StringBuilder();
        prompt.append("Hãy đề xuất nông vụ phù hợp với điều kiện sau:\n\n");

        if (soilType != null)
            prompt.append("- Loại đất: ").append(soilType).append("\n");
        if (location != null)
            prompt.append("- Địa điểm: ").append(location).append("\n");
        if (currentSeason != null)
            prompt.append("- Mùa vụ: ").append(currentSeason).append("\n");
        if (temperature != null)
            prompt.append("- Nhiệt độ: ").append(temperature).append("°C\n");
        if (humidity != null)
            prompt.append("- Độ ẩm: ").append(humidity).append("%\n");
        if (rainfall != null)
            prompt.append("- Lượng mưa: ").append(rainfall).append("mm\n");
        if (existingCrops != null)
            prompt.append("- Cây trồng hiện tại: ").append(existingCrops).append("\n");
        if (farmSize != null)
            prompt.append("- Diện tích: ").append(farmSize).append("\n");

        prompt.append("\nĐề xuất 3-5 loại cây trồng phù hợp nhất, kèm lịch chăm sóc chi tiết.");

        return prompt.toString();
    }

    private boolean isConfigured(String value) {
        return value != null && !value.isEmpty() && !value.equals("your-api-key-here");
    }

    /**
     * Check which providers are available
     */
    public Map<String, Boolean> getAvailableProviders() {
        return Map.of(
                "github_models", isConfigured(githubToken),
                "groq", isConfigured(groqApiKey),
                "cohere", isConfigured(cohereApiKey));
    }
}
