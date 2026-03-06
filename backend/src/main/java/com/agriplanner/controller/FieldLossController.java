package com.agriplanner.controller;

import com.agriplanner.model.*;
import com.agriplanner.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/field-losses")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@SuppressWarnings("null")
public class FieldLossController {

    private final FieldLossRepository fieldLossRepository;
    private final FieldRepository fieldRepository;
    private final CropDefinitionRepository cropDefinitionRepository;

    /**
     * Record a new field loss (crop damage)
     */
    @PostMapping
    public ResponseEntity<?> recordFieldLoss(@RequestBody Map<String, Object> request) {
        try {
            Long fieldId = Long.valueOf(request.get("fieldId").toString());
            Field field = fieldRepository.findById(fieldId).orElse(null);
            if (field == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Không tìm thấy mảnh ruộng"));
            }

            // Only allow loss reporting for planted fields
            String stage = field.getWorkflowStage();
            if (stage == null || (!stage.equals("SEEDED") && !stage.equals("GROWING") && !stage.equals("READY_HARVEST"))) {
                return ResponseEntity.badRequest().body(Map.of("error", "Chỉ ghi nhận hao hụt cho ruộng đã gieo trồng"));
            }

            String lossPolygon = request.get("lossPolygon") != null ? request.get("lossPolygon").toString() : null;
            BigDecimal lossAreaSqm = request.get("lossAreaSqm") != null
                    ? new BigDecimal(request.get("lossAreaSqm").toString())
                    : BigDecimal.ZERO;

            String cause = request.get("cause") != null ? request.get("cause").toString() : "OTHER";
            String causeDetail = request.get("causeDetail") != null ? request.get("causeDetail").toString() : null;
            String notes = request.get("notes") != null ? request.get("notes").toString() : null;

            // Calculate loss percentage
            BigDecimal lossPercentage = BigDecimal.ZERO;
            if (field.getAreaSqm() != null && field.getAreaSqm().compareTo(BigDecimal.ZERO) > 0) {
                lossPercentage = lossAreaSqm.multiply(new BigDecimal("100"))
                        .divide(field.getAreaSqm(), 2, RoundingMode.HALF_UP);
            }

            // Calculate estimated monetary loss based on crop yield and price
            BigDecimal estimatedLossValue = BigDecimal.ZERO;
            if (field.getCurrentCropId() != null) {
                CropDefinition crop = cropDefinitionRepository.findById(field.getCurrentCropId()).orElse(null);
                if (crop != null && crop.getExpectedYieldPerSqm() != null && crop.getMarketPricePerKg() != null) {
                    estimatedLossValue = lossAreaSqm
                            .multiply(crop.getExpectedYieldPerSqm())
                            .multiply(crop.getMarketPricePerKg());
                }
            }

            // Override with manual estimate if provided
            if (request.get("estimatedLossValue") != null) {
                BigDecimal manual = new BigDecimal(request.get("estimatedLossValue").toString());
                if (manual.compareTo(BigDecimal.ZERO) > 0) {
                    estimatedLossValue = manual;
                }
            }

            Long taskId = request.get("taskId") != null ? Long.valueOf(request.get("taskId").toString()) : null;
            Long reportedBy = request.get("reportedBy") != null ? Long.valueOf(request.get("reportedBy").toString()) : null;
            String reportImageUrl = request.get("reportImageUrl") != null ? request.get("reportImageUrl").toString() : null;
            String reportVideoUrl = request.get("reportVideoUrl") != null ? request.get("reportVideoUrl").toString() : null;

            FieldLoss loss = FieldLoss.builder()
                    .fieldId(fieldId)
                    .taskId(taskId)
                    .lossAreaSqm(lossAreaSqm)
                    .lossPolygon(lossPolygon)
                    .cause(cause)
                    .causeDetail(causeDetail)
                    .estimatedLossValue(estimatedLossValue)
                    .lossPercentage(lossPercentage)
                    .reportDate(LocalDate.now())
                    .notes(notes)
                    .reportImageUrl(reportImageUrl)
                    .reportVideoUrl(reportVideoUrl)
                    .reportedBy(reportedBy)
                    .build();

            FieldLoss saved = fieldLossRepository.save(loss);
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Get all losses for a specific field
     */
    @GetMapping("/field/{fieldId}")
    public ResponseEntity<?> getLossesByField(@PathVariable Long fieldId) {
        List<FieldLoss> losses = fieldLossRepository.findByFieldIdOrderByReportDateDesc(fieldId);
        return ResponseEntity.ok(losses);
    }

    /**
     * Get all losses for a farm
     */
    @GetMapping("/farm/{farmId}")
    public ResponseEntity<?> getLossesByFarm(@PathVariable Long farmId) {
        List<FieldLoss> losses = fieldLossRepository.findByFarmId(farmId);
        return ResponseEntity.ok(losses);
    }

    /**
     * Get loss statistics for a field
     */
    @GetMapping("/field/{fieldId}/stats")
    public ResponseEntity<?> getFieldLossStats(@PathVariable Long fieldId) {
        Field field = fieldRepository.findById(fieldId).orElse(null);
        if (field == null) {
            return ResponseEntity.notFound().build();
        }

        List<FieldLoss> losses = fieldLossRepository.findByFieldIdOrderByReportDateDesc(fieldId);
        BigDecimal totalLossArea = fieldLossRepository.sumLossAreaByFieldId(fieldId);
        BigDecimal totalLossValue = fieldLossRepository.sumLossValueByFieldId(fieldId);

        BigDecimal totalLossPercentage = BigDecimal.ZERO;
        if (field.getAreaSqm() != null && field.getAreaSqm().compareTo(BigDecimal.ZERO) > 0) {
            totalLossPercentage = totalLossArea.multiply(new BigDecimal("100"))
                    .divide(field.getAreaSqm(), 2, RoundingMode.HALF_UP);
        }

        // Cause distribution
        Map<String, Long> causeDistribution = losses.stream()
                .filter(l -> l.getCause() != null)
                .collect(Collectors.groupingBy(FieldLoss::getCause, Collectors.counting()));

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalRecords", losses.size());
        stats.put("totalLossAreaSqm", totalLossArea);
        stats.put("totalLossValue", totalLossValue);
        stats.put("totalLossPercentage", totalLossPercentage);
        stats.put("fieldAreaSqm", field.getAreaSqm());
        stats.put("causeDistribution", causeDistribution);
        stats.put("recentLosses", losses.stream().limit(10).collect(Collectors.toList()));

        return ResponseEntity.ok(stats);
    }

    /**
     * Get loss statistics for entire farm
     */
    @GetMapping("/farm/{farmId}/stats")
    public ResponseEntity<?> getFarmLossStats(@PathVariable Long farmId) {
        List<FieldLoss> allLosses = fieldLossRepository.findByFarmId(farmId);
        BigDecimal totalLossValue = fieldLossRepository.sumLossValueByFarmId(farmId);
        BigDecimal totalLossArea = fieldLossRepository.sumLossAreaByFarmId(farmId);

        // Group by field
        Map<Long, List<FieldLoss>> lossesByField = allLosses.stream()
                .collect(Collectors.groupingBy(FieldLoss::getFieldId));

        List<Map<String, Object>> fieldSummaries = new ArrayList<>();
        for (Map.Entry<Long, List<FieldLoss>> entry : lossesByField.entrySet()) {
            Field field = fieldRepository.findById(entry.getKey()).orElse(null);
            if (field == null) continue;

            BigDecimal fieldLossArea = entry.getValue().stream()
                    .map(FieldLoss::getLossAreaSqm)
                    .filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal fieldLossValue = entry.getValue().stream()
                    .map(FieldLoss::getEstimatedLossValue)
                    .filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            Map<String, Object> summary = new HashMap<>();
            summary.put("fieldId", field.getId());
            summary.put("fieldName", field.getName());
            summary.put("recordCount", entry.getValue().size());
            summary.put("lossAreaSqm", fieldLossArea);
            summary.put("lossValue", fieldLossValue);
            if (field.getAreaSqm() != null && field.getAreaSqm().compareTo(BigDecimal.ZERO) > 0) {
                summary.put("lossPercentage", fieldLossArea.multiply(new BigDecimal("100"))
                        .divide(field.getAreaSqm(), 2, RoundingMode.HALF_UP));
            }
            fieldSummaries.add(summary);
        }

        // Cause distribution across farm
        Map<String, Long> causeDistribution = allLosses.stream()
                .filter(l -> l.getCause() != null)
                .collect(Collectors.groupingBy(FieldLoss::getCause, Collectors.counting()));

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalRecords", allLosses.size());
        stats.put("totalLossAreaSqm", totalLossArea);
        stats.put("totalLossValue", totalLossValue);
        stats.put("causeDistribution", causeDistribution);
        stats.put("fieldSummaries", fieldSummaries);
        stats.put("recentLosses", allLosses.stream().limit(10).collect(Collectors.toList()));

        return ResponseEntity.ok(stats);
    }

    /**
     * Delete a field loss record
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteFieldLoss(@PathVariable Long id) {
        if (!fieldLossRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        fieldLossRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Đã xóa bản ghi hao hụt"));
    }
}
