package com.agriplanner.controller;

import com.agriplanner.model.WeatherLog;
import com.agriplanner.repository.WeatherLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.NonNull;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/weather")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class WeatherController {

    private final WeatherLogRepository weatherLogRepository;

    /**
     * Log weather data for a farm (typically called daily by frontend or scheduler)
     */
    @PostMapping("/log")
    public ResponseEntity<?> logWeather(@RequestBody Map<String, Object> request) {
        try {
            long farmId = Long.parseLong(request.get("farmId").toString());
            LocalDate date = request.get("date") != null
                    ? LocalDate.parse(request.get("date").toString())
                    : LocalDate.now();

            // Check if already logged today
            Optional<WeatherLog> existing = weatherLogRepository.findByFarmIdAndDate(farmId, date);

            WeatherLog log;
            if (existing.isPresent()) {
                log = existing.get();
            } else {
                log = new WeatherLog();
                log.setFarmId(farmId);
                log.setDate(date);
            }

            if (request.get("tempMin") != null)
                log.setTempMin(new BigDecimal(request.get("tempMin").toString()));
            if (request.get("tempMax") != null)
                log.setTempMax(new BigDecimal(request.get("tempMax").toString()));
            if (request.get("humidity") != null)
                log.setHumidity(new BigDecimal(request.get("humidity").toString()));
            if (request.get("windSpeed") != null)
                log.setWindSpeed(new BigDecimal(request.get("windSpeed").toString()));
            if (request.get("rainfall") != null)
                log.setRainfall(new BigDecimal(request.get("rainfall").toString()));
            if (request.get("condition") != null)
                log.setCondition(request.get("condition").toString());

            weatherLogRepository.save(Objects.requireNonNull(log));
            return ResponseEntity.ok(Map.of("message", "Weather logged successfully", "log", log));

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Get weather history for a farm
     */
    @GetMapping("/history/{farmId}")
    public ResponseEntity<?> getWeatherHistory(
            @PathVariable @NonNull Long farmId,
            @RequestParam(defaultValue = "30") int days) {

        LocalDate endDate = LocalDate.now();
        LocalDate startDate = endDate.minusDays(days);

        List<WeatherLog> logs = weatherLogRepository.findByFarmIdAndDateBetweenOrderByDateDesc(farmId, startDate,
                endDate);
        return ResponseEntity.ok(logs);
    }

    /**
     * Get spray advice based on current weather conditions
     */
    @GetMapping("/spray-advice")
    public ResponseEntity<?> getSprayAdvice(
            @RequestParam double windSpeed,
            @RequestParam double rainProbability,
            @RequestParam(required = false) Double temperature) {

        List<Map<String, String>> warnings = new ArrayList<>();
        boolean canSpray = true;
        String overallStatus = "OK";

        // Wind speed check (>15 km/h is too windy)
        if (windSpeed > 15) {
            canSpray = false;
            overallStatus = "NOT_RECOMMENDED";
            warnings.add(Map.of(
                    "type", "WIND",
                    "severity", "HIGH",
                    "message",
                    String.format("Tốc độ gió %.0f km/h quá mạnh. Thuốc sẽ bay xa, lãng phí và ô nhiễm.", windSpeed)));
        } else if (windSpeed > 10) {
            warnings.add(Map.of(
                    "type", "WIND",
                    "severity", "MEDIUM",
                    "message", String.format("Gió %.0f km/h - Nên phun vào sáng sớm khi gió nhẹ hơn.", windSpeed)));
        }

        // Rain probability check (>50% is risky)
        if (rainProbability > 50) {
            canSpray = false;
            overallStatus = "NOT_RECOMMENDED";
            warnings.add(Map.of(
                    "type", "RAIN",
                    "severity", "HIGH",
                    "message",
                    String.format("Xác suất mưa %.0f%%. Thuốc sẽ bị rửa trôi, không hiệu quả.", rainProbability)));
        } else if (rainProbability > 30) {
            warnings.add(Map.of(
                    "type", "RAIN",
                    "severity", "MEDIUM",
                    "message", "Có thể mưa chiều nay. Hoàn thành phun trước 11h sáng."));
        }

        // Temperature check (if provided)
        if (temperature != null && temperature > 35) {
            warnings.add(Map.of(
                    "type", "HEAT",
                    "severity", "HIGH",
                    "message",
                    String.format("Nhiệt độ %.0f°C quá cao. Thuốc bay hơi nhanh, hiệu quả giảm.", temperature)));
        }

        // Build response
        Map<String, Object> response = new HashMap<>();
        response.put("canSpray", canSpray);
        response.put("status", overallStatus);
        response.put("warnings", warnings);

        if (canSpray && warnings.isEmpty()) {
            response.put("recommendation", "Điều kiện thời tiết phù hợp để phun thuốc.");
        } else if (canSpray) {
            response.put("recommendation", "Có thể phun nhưng cần lưu ý các cảnh báo.");
        } else {
            response.put("recommendation", "Không nên phun thuốc trong điều kiện hiện tại.");
        }

        return ResponseEntity.ok(response);
    }
}
