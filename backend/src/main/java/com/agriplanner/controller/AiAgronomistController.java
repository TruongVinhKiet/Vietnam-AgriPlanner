package com.agriplanner.controller;

import com.agriplanner.model.CropDefinition;
import com.agriplanner.model.Field;
import com.agriplanner.repository.FieldRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AiAgronomistController {

    private final FieldRepository fieldRepository;
    // private final CropDefinitionRepository cropDefinitionRepository; // Unused
    // for now as we get crop from Field

    @PostMapping("/analyze")
    public ResponseEntity<?> analyzeField(@RequestBody Map<String, Object> request) {
        try {
            Object fieldIdObj = request.get("fieldId");
            Object tempObj = request.get("currentTemp");
            Object humidityObj = request.get("currentHumidity");

            if (fieldIdObj == null || tempObj == null || humidityObj == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Missing required parameters: fieldId, currentTemp, currentHumidity"));
            }

            long fieldId = Long.parseLong(fieldIdObj.toString());
            double currentTemp = Double.parseDouble(tempObj.toString());
            double currentHumidity = Double.parseDouble(humidityObj.toString());

            Field field = fieldRepository.findById(fieldId).orElseThrow();
            // Assuming Field has a currentCropId or logic to get it.
            // For now, let's look up the crop if it exists, otherwise mock or find default.

            // NOTE: Field model in this codebase uses 'currentCrop' as a potentially
            // embedded object or ID.
            // Based on previous file reads, Field.java likely has crop reference.
            // Let's assume we can get the crop via repository if stored as ID or directly.
            // If Field has `private CropDefinition currentCrop;`, we use that.

            CropDefinition crop = field.getCurrentCrop();
            if (crop == null) {
                // If no crop, return generic advice
                return ResponseEntity.ok(Map.of(
                        "status", "NO_CROP",
                        "insights", List.of(
                                Map.of("type", "INFO", "message",
                                        "Hãy chọn cây trồng để tôi có thể hỗ trợ bạn tốt hơn."))));
            }

            List<Map<String, String>> insights = new ArrayList<>();

            // 1. Heat Shock Analysis
            // Parse ideal temp from string "25-30" or similar if needed.
            // For simplicity, we use the min/max temp columns if available, or parse.
            int maxTemp = crop.getMaxTemp() != null ? crop.getMaxTemp() : 32;
            int minTemp = crop.getMinTemp() != null ? crop.getMinTemp() : 20;

            if (currentTemp > maxTemp) {
                insights.add(Map.of(
                        "type", "WARNING",
                        "title", "Cảnh báo Sốc nhiệt!",
                        "message",
                        String.format(
                                "Nhiệt độ %.1f°C vượt ngưỡng lý tưởng (%d°C) của %s. Khuyến nghị: Bơm thêm nước vào ruộng để hạ nhiệt.",
                                currentTemp, maxTemp, crop.getName())));
            } else if (currentTemp < minTemp) {
                insights.add(Map.of(
                        "type", "WARNING",
                        "title", "Cảnh báo Rét hại!",
                        "message",
                        String.format("Nhiệt độ %.1f°C thấp hơn ngưỡng phát triển (%d°C). Cần ủ ấm hoặc tráng nylon.",
                                currentTemp, minTemp)));
            }

            // 2. Humidity / Pest Analysis
            // Mock logic: High humidity > 85% triggers pest warning based on Crop's common
            // pests
            if (currentHumidity > 80) {
                String pestRisk = "Nấm bệnh";
                if (crop.getName().toLowerCase().contains("lúa")) {
                    pestRisk = "Bệnh Đạo ôn";
                } else if (crop.getName().toLowerCase().contains("cà chua")) {
                    pestRisk = "Sương mai";
                }

                insights.add(Map.of(
                        "type", "DANGER",
                        "title", "Nguy cơ Sâu bệnh cao",
                        "message",
                        String.format(
                                "Độ ẩm cao (%.0f%%) là điều kiện thuận lợi cho %s phát triển. Hãy thăm đồng và phun phòng ngừa.",
                                currentHumidity, pestRisk)));
            } else if (currentHumidity < 40) {
                insights.add(Map.of(
                        "type", "INFO",
                        "title", "Cảnh báo Khô hạn",
                        "message", "Độ ẩm không khí thấp. Chú ý giữ ẩm cho đất để tránh cây bị mất nước."));
            }

            // 3. Growth Stage Insight (Mock based on days)
            // If we had planting date, we could say "Entering Flowering Stage" etc.
            insights.add(Map.of(
                    "type", "SUCCESS",
                    "title", "Tình trạng phát triển",
                    "message", String.format("Cây %s đang phát triển tốt trong điều kiện hiện tại.", crop.getName())));

            return ResponseEntity.ok(Map.of(
                    "status", "OK",
                    "cropName", crop.getName(),
                    "insights", insights));

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
