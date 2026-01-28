package com.agriplanner.controller;

import com.agriplanner.model.*;
import com.agriplanner.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.*;

/**
 * REST Controller for Analytics
 */
@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AnalyticsController {

    private final HarvestRecordRepository harvestRecordRepository;
    private final FarmingActivityRepository farmingActivityRepository;
    private final FieldRepository fieldRepository;

    @GetMapping("/costs/field/{fieldId}")
    public ResponseEntity<Map<String, Object>> getCostsByField(@PathVariable Long fieldId) {
        List<FarmingActivity> activities = farmingActivityRepository.findByFieldIdOrderByPerformedAtDesc(fieldId);

        Map<String, BigDecimal> costByType = new HashMap<>();
        BigDecimal totalCost = BigDecimal.ZERO;

        for (FarmingActivity activity : activities) {
            if (activity.getCost() != null && activity.getCost().compareTo(BigDecimal.ZERO) > 0) {
                String type = activity.getActivityType();
                costByType.merge(type, activity.getCost(), BigDecimal::add);
                totalCost = totalCost.add(activity.getCost());
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("totalCost", totalCost);
        result.put("costByType", costByType);
        result.put("activityCount", activities.size());

        return ResponseEntity.ok(result);
    }

    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getSummary() {
        List<HarvestRecord> harvests = harvestRecordRepository.findTop10ByOrderByHarvestDateDesc();

        BigDecimal totalRevenue = BigDecimal.ZERO;
        BigDecimal totalCost = BigDecimal.ZERO;
        BigDecimal totalProfit = BigDecimal.ZERO;
        BigDecimal totalYield = BigDecimal.ZERO;

        for (HarvestRecord record : harvests) {
            if (record.getRevenue() != null)
                totalRevenue = totalRevenue.add(record.getRevenue());
            if (record.getTotalCost() != null)
                totalCost = totalCost.add(record.getTotalCost());
            if (record.getProfit() != null)
                totalProfit = totalProfit.add(record.getProfit());
            if (record.getYieldKg() != null)
                totalYield = totalYield.add(record.getYieldKg());
        }

        Map<String, Object> result = new HashMap<>();
        result.put("harvestCount", harvests.size());
        result.put("totalRevenue", totalRevenue);
        result.put("totalCost", totalCost);
        result.put("totalProfit", totalProfit);
        result.put("totalYieldKg", totalYield);
        result.put("avgProfitPerHarvest", harvests.isEmpty() ? BigDecimal.ZERO
                : totalProfit.divide(BigDecimal.valueOf(harvests.size()), 2, java.math.RoundingMode.HALF_UP));

        return ResponseEntity.ok(result);
    }

    @GetMapping("/fields/financial-summary")
    public ResponseEntity<List<Map<String, Object>>> getFinancialSummaryForAllFields(@RequestParam Long farmId) {
        // Fetch all fields (custom logic, assuming findAll for now as we don't have
        // farmId filter)
        List<Field> fields = fieldRepository.findAll();

        List<Map<String, Object>> summaries = new ArrayList<>();

        for (Field field : fields) {
            // 1. Calculate Total Cost (Investment)
            List<FarmingActivity> activities = farmingActivityRepository
                    .findByFieldIdOrderByPerformedAtDesc(field.getId());
            BigDecimal totalCost = BigDecimal.ZERO;
            for (FarmingActivity activity : activities) {
                if (activity.getCost() != null) {
                    totalCost = totalCost.add(activity.getCost());
                }
            }

            // 2. Calculate Estimated Revenue
            BigDecimal estimatedRevenue = BigDecimal.ZERO;
            if (field.getCurrentCrop() != null) {
                CropDefinition crop = field.getCurrentCrop();
                BigDecimal area = field.getAreaSqm();
                BigDecimal expectedYieldPerSqm = crop.getExpectedYieldPerSqm() != null ? crop.getExpectedYieldPerSqm()
                        : BigDecimal.ZERO;
                BigDecimal marketPrice = crop.getMarketPricePerKg() != null ? crop.getMarketPricePerKg()
                        : BigDecimal.ZERO;

                estimatedRevenue = area.multiply(expectedYieldPerSqm).multiply(marketPrice);
            }

            // 3. Calculate Profit & Status
            BigDecimal profit = estimatedRevenue.subtract(totalCost);
            String status = "NEUTRAL";

            // Logic for status
            if (estimatedRevenue.compareTo(BigDecimal.ZERO) == 0 && totalCost.compareTo(BigDecimal.ZERO) == 0) {
                status = "NEUTRAL";
            } else if (profit.compareTo(BigDecimal.ZERO) > 0) {
                if (totalCost.compareTo(BigDecimal.ZERO) > 0) {
                    BigDecimal margin = profit.divide(totalCost, 2, java.math.RoundingMode.HALF_UP);
                    status = margin.compareTo(new BigDecimal("0.3")) > 0 ? "PROFIT_HIGH" : "PROFIT_LOW";
                } else {
                    status = "PROFIT_HIGH";
                }
            } else {
                status = "LOSS";
            }

            Map<String, Object> summary = new HashMap<>();
            summary.put("fieldId", field.getId());
            summary.put("fieldName", field.getName());
            summary.put("totalCost", totalCost);
            summary.put("estimatedRevenue", estimatedRevenue);
            summary.put("projectedProfit", profit);
            summary.put("status", status);

            summaries.add(summary);
        }

        return ResponseEntity.ok(summaries);
    }

    @GetMapping("/harvest-history")
    public ResponseEntity<List<HarvestRecord>> getHarvestHistory() {
        return ResponseEntity.ok(harvestRecordRepository.findTop10ByOrderByHarvestDateDesc());
    }
}
