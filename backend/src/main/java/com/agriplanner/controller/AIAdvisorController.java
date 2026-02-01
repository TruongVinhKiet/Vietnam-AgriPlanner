package com.agriplanner.controller;

import com.agriplanner.service.AIAdvisorService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST Controller cho AI Advisor - Đề xuất nông vụ thông minh
 */
@RestController
@RequestMapping("/api/ai-advisor")
@CrossOrigin(origins = "*")
public class AIAdvisorController {

    private final AIAdvisorService aiAdvisorService;

    public AIAdvisorController(AIAdvisorService aiAdvisorService) {
        this.aiAdvisorService = aiAdvisorService;
    }

    /**
     * Lấy đề xuất nông vụ
     * 
     * POST /api/ai-advisor/recommend
     * Body: {
     *   "soilType": "Đất phù sa",
     *   "location": "Cần Thơ, Việt Nam",
     *   "currentSeason": "Đông Xuân",
     *   "temperature": 28.5,
     *   "humidity": 75,
     *   "rainfall": 120,
     *   "existingCrops": "Lúa",
     *   "farmSize": "2 hecta"
     * }
     */
    @PostMapping("/recommend")
    public ResponseEntity<?> getRecommendation(@RequestBody Map<String, Object> request) {
        try {
            String soilType = (String) request.get("soilType");
            String location = (String) request.get("location");
            String currentSeason = (String) request.get("currentSeason");
            Double temperature = request.get("temperature") != null 
                ? ((Number) request.get("temperature")).doubleValue() : null;
            Double humidity = request.get("humidity") != null 
                ? ((Number) request.get("humidity")).doubleValue() : null;
            Double rainfall = request.get("rainfall") != null 
                ? ((Number) request.get("rainfall")).doubleValue() : null;
            String existingCrops = (String) request.get("existingCrops");
            String farmSize = (String) request.get("farmSize");

            Map<String, Object> advice = aiAdvisorService.getAgricultureAdvice(
                soilType, location, currentSeason, temperature, humidity, rainfall, existingCrops, farmSize
            );

            return ResponseEntity.ok(Map.of(
                "success", !advice.containsKey("error"),
                "data", advice
            ));

        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                "success", false,
                "error", e.getMessage()
            ));
        }
    }

    /**
     * Kiểm tra các AI providers đã cấu hình
     */
    @GetMapping("/providers")
    public ResponseEntity<?> getProviders() {
        return ResponseEntity.ok(Map.of(
            "success", true,
            "providers", aiAdvisorService.getAvailableProviders()
        ));
    }

    /**
     * Test AI connection
     */
    @GetMapping("/test")
    public ResponseEntity<?> testConnection() {
        Map<String, Boolean> providers = aiAdvisorService.getAvailableProviders();
        
        boolean anyConfigured = providers.values().stream().anyMatch(v -> v);
        
        if (!anyConfigured) {
            return ResponseEntity.ok(Map.of(
                "success", false,
                "message", "Chưa cấu hình AI provider nào. Vui lòng thêm API key vào .env",
                "providers", providers
            ));
        }

        // Quick test
        Map<String, Object> testResult = aiAdvisorService.getAgricultureAdvice(
            "Đất phù sa", "Cần Thơ", "Đông Xuân", 28.0, 75.0, 100.0, null, "1 hecta"
        );

        return ResponseEntity.ok(Map.of(
            "success", !testResult.containsKey("error"),
            "provider", testResult.getOrDefault("provider", "unknown"),
            "message", testResult.containsKey("error") 
                ? "Lỗi kết nối AI" 
                : "AI đang hoạt động tốt!"
        ));
    }
}
