package com.agriplanner.controller;

import com.agriplanner.model.AssetTransaction;
import com.agriplanner.model.CropDefinition;
import com.agriplanner.model.Farm;
import com.agriplanner.model.Field;
import com.agriplanner.model.User;
import com.agriplanner.repository.AssetTransactionRepository;
import com.agriplanner.repository.FarmRepository;
import com.agriplanner.repository.FieldRepository;
import com.agriplanner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

/**
 * Dashboard Controller - Provides aggregated stats for the home page
 */
@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@SuppressWarnings("null")
public class DashboardController {

    private final UserRepository userRepository;
    private final FarmRepository farmRepository;
    private final FieldRepository fieldRepository;
    private final AssetTransactionRepository assetTransactionRepository;

    /**
     * Get dashboard statistics for user
     */
    @GetMapping("/stats")
    public ResponseEntity<?> getDashboardStats(@RequestParam String email) {
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        Long userId = user.getId();
        if (userId == null) {
            return ResponseEntity.badRequest().body("Invalid user");
        }

        Map<String, Object> stats = new HashMap<>();

        // 1. Get all farms for this user, then get all fields
        List<Farm> farms = farmRepository.findByOwnerId(userId);
        List<Field> allFields = new ArrayList<>();
        for (Farm farm : farms) {
            Long farmId = farm.getId();
            if (farmId == null) {
                continue;
            }
            List<Field> farmFields = fieldRepository.findByFarmId(farmId);
            if (farmFields != null) {
                allFields.addAll(farmFields);
            }
        }

        // 2. Total Area (sum of all field areas)
        BigDecimal totalAreaSqm = allFields.stream()
                .map(field -> field.getAreaSqm() != null ? field.getAreaSqm() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        double totalAreaHectares = totalAreaSqm.doubleValue() / 10000.0;
        stats.put("totalAreaHectares", Math.round(totalAreaHectares * 100.0) / 100.0);
        stats.put("totalAreaSqm", totalAreaSqm);

        // 3. Balance (from user's balance)
        BigDecimal balance = user.getBalance() != null ? user.getBalance() : BigDecimal.ZERO;
        stats.put("balance", balance);

        // 4. Profit calculation (Income from HARVEST - all EXPENSES)
        List<AssetTransaction> transactions = assetTransactionRepository.findByUserIdOrderByCreatedAtDesc(userId);

        BigDecimal totalIncome = transactions.stream()
                .filter(tx -> "INCOME".equals(tx.getTransactionType()))
                .map(AssetTransaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalExpense = transactions.stream()
                .filter(tx -> "EXPENSE".equals(tx.getTransactionType()))
                .map(AssetTransaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        stats.put("totalIncome", totalIncome);
        stats.put("totalExpense", totalExpense);
        stats.put("profit", totalIncome.subtract(totalExpense));

        // 5. Harvest Forecast - Calculate expected income based on planted crops
        List<Map<String, Object>> forecast = calculateHarvestForecast(allFields, transactions);
        stats.put("harvestForecast", forecast);

        // 6. Field summary
        List<Map<String, Object>> activeFields = new ArrayList<>();
        for (Field field : allFields) {
            CropDefinition crop = field.getCurrentCrop();
            if (crop != null && field.getPlantingDate() != null) {
                Map<String, Object> fieldInfo = new HashMap<>();
                fieldInfo.put("fieldName", field.getName());
                fieldInfo.put("cropName", crop.getName());
                fieldInfo.put("plantingDate", field.getPlantingDate());
                fieldInfo.put("areaSqm", field.getAreaSqm());

                // Calculate expected harvest date
                int growthDays = crop.getGrowthDurationDays() != null
                        ? crop.getGrowthDurationDays()
                        : 90;
                LocalDate expectedHarvest = field.getPlantingDate().plusDays(growthDays);
                fieldInfo.put("expectedHarvestDate", expectedHarvest);

                // Calculate expected revenue
                BigDecimal pricePerKg = crop.getMarketPricePerKg() != null
                        ? crop.getMarketPricePerKg()
                        : BigDecimal.ZERO;
                BigDecimal yieldPerSqm = crop.getExpectedYieldPerSqm() != null
                        ? crop.getExpectedYieldPerSqm()
                        : BigDecimal.ZERO;
                BigDecimal area = field.getAreaSqm() != null ? field.getAreaSqm() : BigDecimal.ZERO;
                BigDecimal expectedRevenue = pricePerKg.multiply(yieldPerSqm).multiply(area);
                fieldInfo.put("expectedRevenue", expectedRevenue);

                activeFields.add(fieldInfo);
            }
        }
        stats.put("activeFields", activeFields);
        stats.put("totalFields", allFields.size());
        stats.put("plantedFields", activeFields.size());

        return ResponseEntity.ok(stats);
    }

    /**
     * Calculate harvest forecast for next 6 months
     */
    private List<Map<String, Object>> calculateHarvestForecast(List<Field> fields,
            List<AssetTransaction> transactions) {
        List<Map<String, Object>> forecast = new ArrayList<>();
        LocalDate now = LocalDate.now();

        // Create forecast for next 6 months
        for (int i = 0; i < 6; i++) {
            LocalDate monthStart = now.plusMonths(i).withDayOfMonth(1);
            LocalDate monthEnd = monthStart.plusMonths(1).minusDays(1);

            Map<String, Object> monthData = new HashMap<>();
            String monthLabel = "T" + monthStart.getMonthValue() + " " + monthStart.getYear();
            monthData.put("month", monthLabel);
            monthData.put("monthIndex", monthStart.getMonthValue());
            monthData.put("year", monthStart.getYear());

            // Calculate expected income from crops harvesting this month
            BigDecimal expectedIncome = BigDecimal.ZERO;
            List<String> harvestingCrops = new ArrayList<>();

            for (Field field : fields) {
                CropDefinition crop = field.getCurrentCrop();
                if (crop != null && field.getPlantingDate() != null) {
                    int growthDays = crop.getGrowthDurationDays() != null
                            ? crop.getGrowthDurationDays()
                            : 90;
                    LocalDate expectedHarvest = field.getPlantingDate().plusDays(growthDays);

                    // Check if harvest falls in this month
                    if (!expectedHarvest.isBefore(monthStart) && !expectedHarvest.isAfter(monthEnd)) {
                        BigDecimal pricePerKg = crop.getMarketPricePerKg() != null
                                ? crop.getMarketPricePerKg()
                                : BigDecimal.ZERO;
                        BigDecimal yieldPerSqm = crop.getExpectedYieldPerSqm() != null
                                ? crop.getExpectedYieldPerSqm()
                                : BigDecimal.ZERO;
                        BigDecimal area = field.getAreaSqm() != null ? field.getAreaSqm() : BigDecimal.ZERO;
                        BigDecimal revenue = pricePerKg.multiply(yieldPerSqm).multiply(area);
                        expectedIncome = expectedIncome.add(revenue);
                        harvestingCrops.add(crop.getName() + " (" + field.getName() + ")");
                    }
                }
            }
            monthData.put("expectedIncome", expectedIncome);
            monthData.put("harvestingCrops", harvestingCrops);

            // Calculate expenses for this month (past months from transactions, future = 0)
            BigDecimal expense = BigDecimal.ZERO;
            if (i == 0) {
                // Current month - sum up expenses from this month
                for (AssetTransaction tx : transactions) {
                    if ("EXPENSE".equals(tx.getTransactionType())) {
                        java.time.LocalDateTime createdAt = tx.getCreatedAt();
                        if (createdAt == null) {
                            continue;
                        }
                        LocalDate txDate = createdAt.toLocalDate();
                        if (!txDate.isBefore(monthStart) && !txDate.isAfter(monthEnd)) {
                            expense = expense.add(tx.getAmount());
                        }
                    }
                }
            }
            monthData.put("expense", expense);

            forecast.add(monthData);
        }

        return forecast;
    }
}
