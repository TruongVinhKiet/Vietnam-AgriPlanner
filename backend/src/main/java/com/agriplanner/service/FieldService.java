package com.agriplanner.service;

import com.agriplanner.model.*;
import com.agriplanner.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Service for Field management
 */
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class FieldService {

    private final FieldRepository fieldRepository;
    private final CropDefinitionRepository cropDefinitionRepository;
    private final LandCertificateRepository landCertificateRepository;
    private final FarmingActivityRepository farmingActivityRepository;
    private final HarvestRecordRepository harvestRecordRepository;
    private final FarmRepository farmRepository;
    private final AssetService assetService;

    /**
     * Get all fields for a farm
     */
    public List<Field> getFieldsByFarm(Long farmId) {
        return fieldRepository.findByFarmId(farmId);
    }

    /**
     * Get field by ID
     */
    public Optional<Field> getFieldById(Long id) {
        return fieldRepository.findById(id);
    }

    @Transactional
    public Field updateFieldCondition(Long fieldId, String condition) {
        if (condition == null || condition.isBlank()) {
            throw new IllegalArgumentException("Condition is required");
        }

        Field field = fieldRepository.findById(fieldId)
                .orElseThrow(() -> new RuntimeException("Field not found"));

        FieldCondition fieldCondition;
        try {
            fieldCondition = FieldCondition.valueOf(condition.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid condition: " + condition);
        }

        field.setCondition(fieldCondition);
        return fieldRepository.save(field);
    }

    /**
     * Create a new field
     */
    @Transactional
    public Field createField(Long farmId, String name, String boundaryCoordinates, BigDecimal areaSqm) {
        Field field = Field.builder()
                .farmId(farmId)
                .name(name)
                .boundaryCoordinates(boundaryCoordinates)
                .areaSqm(areaSqm)
                .status("PREPARING")
                .workflowStage("EMPTY")
                .totalInvestment(BigDecimal.ZERO)
                .build();
        return fieldRepository.save(field);
    }

    /**
     * Update field with crop info
     */
    @Transactional
    public Field plantCrop(Long fieldId, Long cropId) {
        Field field = fieldRepository.findById(fieldId)
                .orElseThrow(() -> new RuntimeException("Field not found"));
        cropDefinitionRepository.findById(cropId)
                .orElseThrow(() -> new RuntimeException("Crop not found"));

        field.setCurrentCropId(cropId);
        field.setWorkflowStage("CROP_SELECTED");
        // Note: planting date and harvest date will be set after seeding

        return fieldRepository.save(field);
    }

    /**
     * Mark field as harvested
     */
    @Transactional
    public Field harvestField(Long fieldId) {
        Field field = fieldRepository.findById(fieldId)
                .orElseThrow(() -> new RuntimeException("Field not found"));
        field.setActualHarvestDate(LocalDate.now());
        field.setStatus("FALLOW");
        return fieldRepository.save(field);
    }

    /**
     * Delete a field
     */
    @Transactional
    public void deleteField(Long fieldId) {
        fieldRepository.deleteById(fieldId);
    }

    /**
     * Upload land certificate
     */
    @Transactional
    public LandCertificate uploadCertificate(Long fieldId, String base64Image) {
        LandCertificate cert = LandCertificate.builder()
                .fieldId(fieldId)
                .certificateImage(base64Image)
                .build();
        return landCertificateRepository.save(cert);
    }

    /**
     * Get certificate for field
     */
    public Optional<LandCertificate> getCertificate(Long fieldId) {
        return landCertificateRepository.findByFieldId(fieldId);
    }

    /**
     * Log farming activity
     */
    @Transactional
    public FarmingActivity logActivity(Long fieldId, String activityType, String description,
            BigDecimal quantity, String unit, BigDecimal cost, Long userId) {
        FarmingActivity activity = FarmingActivity.builder()
                .fieldId(fieldId)
                .activityType(activityType)
                .description(description)
                .quantity(quantity)
                .unit(unit)
                .cost(cost)
                .performedBy(userId)
                .build();

        // Update total investment in field
        if (cost != null && cost.compareTo(BigDecimal.ZERO) > 0) {
            Field field = fieldRepository.findById(fieldId).orElse(null);
            if (field != null) {
                BigDecimal currentInvestment = field.getTotalInvestment() != null ? field.getTotalInvestment()
                        : BigDecimal.ZERO;
                field.setTotalInvestment(currentInvestment.add(cost));
                fieldRepository.save(field);
            }
        }

        return farmingActivityRepository.save(activity);
    }

    /**
     * Get activities for field
     */
    public List<FarmingActivity> getActivities(Long fieldId) {
        return farmingActivityRepository.findByFieldIdOrderByPerformedAtDesc(fieldId);
    }

    // ==================== CROP METHODS ====================

    /**
     * Get all crops
     */
    public List<CropDefinition> getAllCrops() {
        return cropDefinitionRepository.findAll();
    }

    /**
     * Get crops by category
     */
    public List<CropDefinition> getCropsByCategory(String category) {
        return cropDefinitionRepository.findByCategory(category);
    }

    /**
     * Get crops suitable for current temperature
     */
    public List<CropDefinition> getSuitableCrops(Integer currentTemp) {
        return cropDefinitionRepository.findByMinTempLessThanEqualAndMaxTempGreaterThanEqual(currentTemp, currentTemp);
    }

    /**
     * Get crop by ID
     */
    public Optional<CropDefinition> getCropById(Long id) {
        return cropDefinitionRepository.findById(id);
    }

    // ==================== WORKFLOW METHODS ====================

    /**
     * Fertilize field - Step 2 in workflow
     */
    @Transactional
    public Field fertilizeField(Long fieldId, Long fertilizerId, BigDecimal cost) {
        Field field = fieldRepository.findById(fieldId)
                .orElseThrow(() -> new RuntimeException("Field not found"));

        // Validate workflow stage
        String stage = field.getWorkflowStage();
        if (!"CROP_SELECTED".equals(stage) && !"FERTILIZED".equals(stage)) {
            throw new IllegalStateException("Phải chọn cây trồng trước khi bón phân. Giai đoạn hiện tại: " + stage);
        }

        field.setFertilizerId(fertilizerId);
        field.setLastFertilizedAt(java.time.LocalDateTime.now());
        field.setWorkflowStage("FERTILIZED");

        // Update investment
        BigDecimal currentInvestment = field.getTotalInvestment() != null ? field.getTotalInvestment()
                : BigDecimal.ZERO;
        field.setTotalInvestment(currentInvestment.add(cost));

        // Log activity
        logActivity(fieldId, "FERTILIZE", "Bón phân cho ruộng", null, null, cost, null);

        // Deduct from user balance
        farmRepository.findById(field.getFarmId()).ifPresent(farm -> {
            assetService.deductExpense(farm.getOwnerId(), cost, "FERTILIZER", "Bón phân cho ruộng: " + field.getName(),
                    fieldId);
        });

        return fieldRepository.save(field);
    }

    /**
     * Seed field - Step 3 in workflow
     */
    @Transactional
    public Field seedField(Long fieldId, BigDecimal quantity, BigDecimal cost) {
        Field field = fieldRepository.findById(fieldId)
                .orElseThrow(() -> new RuntimeException("Field not found"));

        // Validate workflow stage
        if (!"FERTILIZED".equals(field.getWorkflowStage())) {
            throw new IllegalStateException(
                    "Phải bón phân trước khi gieo hạt. Giai đoạn hiện tại: " + field.getWorkflowStage());
        }

        field.setSeedingDate(LocalDate.now());
        field.setSeedingQuantity(quantity);
        field.setSeedingCost(cost);
        field.setWorkflowStage("SEEDED");

        // Set planting date and calculate expected harvest
        field.setPlantingDate(LocalDate.now());
        if (field.getCurrentCropId() != null) {
            cropDefinitionRepository.findById(field.getCurrentCropId()).ifPresent(crop -> {
                field.setExpectedHarvestDate(LocalDate.now().plusDays(crop.getGrowthDurationDays()));
            });
        }
        field.setStatus("ACTIVE");

        // Update investment
        BigDecimal currentInvestment = field.getTotalInvestment() != null ? field.getTotalInvestment()
                : BigDecimal.ZERO;
        field.setTotalInvestment(currentInvestment.add(cost));

        // Log activity
        logActivity(fieldId, "SEEDING", "Gieo hạt: " + quantity + " kg", quantity, "kg", cost, null);

        // Deduct from user balance
        farmRepository.findById(field.getFarmId()).ifPresent(farm -> {
            assetService.deductExpense(farm.getOwnerId(), cost, "SEED", "Gieo hạt cho ruộng: " + field.getName(),
                    fieldId);
        });

        return fieldRepository.save(field);
    }

    /**
     * Water field
     */
    @Transactional
    public Field waterField(Long fieldId) {
        Field field = fieldRepository.findById(fieldId)
                .orElseThrow(() -> new RuntimeException("Field not found"));

        // Validate workflow stage - must be seeded or growing
        String stage = field.getWorkflowStage();
        if (!"SEEDED".equals(stage) && !"GROWING".equals(stage) && !"READY_HARVEST".equals(stage)) {
            throw new IllegalStateException("Chỉ có thể tưới nước sau khi đã gieo hạt. Giai đoạn hiện tại: " + stage);
        }

        field.setLastWateredAt(java.time.LocalDateTime.now());
        // Update stage to GROWING if currently SEEDED
        if ("SEEDED".equals(stage)) {
            field.setWorkflowStage("GROWING");
        }

        // Log activity
        logActivity(fieldId, "WATERING", "Tưới nước cho ruộng", null, null, BigDecimal.ZERO, null);

        return fieldRepository.save(field);
    }

    /**
     * Apply pesticide
     */
    @Transactional
    public Field applyPesticide(Long fieldId, String pesticideName, BigDecimal cost) {
        Field field = fieldRepository.findById(fieldId)
                .orElseThrow(() -> new RuntimeException("Field not found"));

        // Validate workflow stage
        String stage = field.getWorkflowStage();
        if (!"SEEDED".equals(stage) && !"GROWING".equals(stage) && !"READY_HARVEST".equals(stage)) {
            throw new IllegalStateException("Chỉ có thể phun thuốc sau khi đã gieo hạt. Giai đoạn hiện tại: " + stage);
        }

        field.setLastPesticideAt(java.time.LocalDateTime.now());

        // Update investment
        BigDecimal currentInvestment = field.getTotalInvestment() != null ? field.getTotalInvestment()
                : BigDecimal.ZERO;
        field.setTotalInvestment(currentInvestment.add(cost));

        // Log activity
        logActivity(fieldId, "PESTICIDE", "Phun thuốc: " + pesticideName, null, null, cost, null);

        // Deduct from user balance
        farmRepository.findById(field.getFarmId()).ifPresent(farm -> {
            assetService.deductExpense(farm.getOwnerId(), cost, "PESTICIDE",
                    "Phun thuốc: " + pesticideName + " cho ruộng: " + field.getName(), fieldId);
        });

        return fieldRepository.save(field);
    }

    /**
     * Start harvest - calculates duration based on crop type and hectare
     * Test crops have 0 duration (instant harvest)
     */
    @Transactional
    public java.util.Map<String, Object> startHarvest(Long fieldId, Long machineryId, BigDecimal machineCost) {
        Field field = fieldRepository.findById(fieldId)
                .orElseThrow(() -> new RuntimeException("Field not found"));

        // Validate workflow stage
        String stage = field.getWorkflowStage();
        if (!"SEEDED".equals(stage) && !"GROWING".equals(stage) && !"READY_HARVEST".equals(stage)) {
            throw new IllegalStateException("Ruộng chưa sẵn sàng thu hoạch. Giai đoạn: " + stage);
        }

        // Calculate harvest duration in minutes
        int durationMinutes = 0;
        Long cropId = field.getCurrentCropId();
        if (cropId != null) {
            CropDefinition crop = cropDefinitionRepository.findById(cropId).orElse(null);
            if (crop != null) {
                // Test crops (name contains "Test" or growthDays = 0) have instant harvest
                boolean isTestCrop = crop.getName().contains("Test") ||
                        (crop.getGrowthDurationDays() != null && crop.getGrowthDurationDays() == 0);
                if (!isTestCrop) {
                    // Base duration: 5 minutes per hectare, plus 1 minute per 10 growth days
                    BigDecimal areaHa = field.getAreaSqm().divide(BigDecimal.valueOf(10000), 2,
                            java.math.RoundingMode.HALF_UP);
                    int baseMinutes = areaHa.multiply(BigDecimal.valueOf(5)).intValue();
                    int growthBonus = crop.getGrowthDurationDays() / 10;
                    durationMinutes = Math.max(1, baseMinutes + growthBonus);
                    // Machine harvesting is faster
                    if (machineryId != null && machineryId <= 4) { // IDs 1-4 are machines
                        durationMinutes = Math.max(1, durationMinutes / 2);
                    }
                }
            }
        }

        // Set harvest timing fields
        field.setHarvestingStartedAt(java.time.LocalDateTime.now());
        field.setHarvestingDurationMinutes(durationMinutes);
        field.setHarvestingMachineryId(machineryId);
        field.setHarvestingCost(machineCost);
        field.setWorkflowStage("HARVESTING");

        fieldRepository.save(field);

        // If duration is 0, complete harvest immediately
        if (durationMinutes == 0) {
            return harvestComplete(fieldId, machineryId, machineCost);
        }

        // Return harvest info
        java.util.Map<String, Object> result = new java.util.HashMap<>();
        result.put("fieldId", fieldId);
        result.put("status", "HARVESTING");
        result.put("durationMinutes", durationMinutes);
        result.put("startedAt", field.getHarvestingStartedAt().toString());
        result.put("estimatedCompletionAt", field.getHarvestingStartedAt().plusMinutes(durationMinutes).toString());

        return result;
    }

    /**
     * Complete harvest with machinery and revenue calculation
     */
    @Transactional
    public java.util.Map<String, Object> harvestComplete(Long fieldId, Long machineryId, BigDecimal machineCost) {
        Field field = fieldRepository.findById(fieldId)
                .orElseThrow(() -> new RuntimeException("Field not found"));

        // Validate workflow stage
        // Check if currently harvesting
        if ("HARVESTING".equals(field.getWorkflowStage())) {
            // Check timing
            if (field.getHarvestingStartedAt() != null && field.getHarvestingDurationMinutes() != null) {
                java.time.LocalDateTime endTime = field.getHarvestingStartedAt()
                        .plusMinutes(field.getHarvestingDurationMinutes());
                // Allow completion if time passed OR if close enough (within 1 min) to avoid
                // sync issues
                // For testing purposes, if duration is small, we assume it's done
                if (java.time.LocalDateTime.now().isBefore(endTime.minusSeconds(30))) {
                    throw new IllegalStateException("Thu hoạch chưa hoàn tất (" +
                            java.time.Duration.between(java.time.LocalDateTime.now(), endTime).toSeconds()
                            + "s còn lại)");
                }
            }

            // Use stored machinery/cost if not provided (should be null in request)
            if (machineryId == 0 || machineryId == null)
                machineryId = field.getHarvestingMachineryId();
            if (machineCost == null || machineCost.compareTo(BigDecimal.ZERO) == 0) {
                machineCost = field.getHarvestingCost();
            }
            if (machineCost == null)
                machineCost = BigDecimal.ZERO;

        } else {
            // Fallback for direct harvest (if ever used) or validation
            if (field.getExpectedHarvestDate() == null || LocalDate.now().isBefore(field.getExpectedHarvestDate())) {
                boolean isReady = "READY_HARVEST".equals(field.getWorkflowStage());
                boolean isGrowing = "GROWING".equals(field.getWorkflowStage());
                boolean isSeeded = "SEEDED".equals(field.getWorkflowStage());

                // Allow early harvest for testing if needed, or enforce strict
                if (!isReady && !isGrowing && !isSeeded) {
                    throw new IllegalStateException(
                            "Ruộng chưa sẵn sàng thu hoạch. Giai đoạn hiện tại: " + field.getWorkflowStage());
                }
            }
        }

        // Calculate yield and revenue
        BigDecimal yieldKg = BigDecimal.ZERO;
        BigDecimal revenue = BigDecimal.ZERO;
        String cropName = "Unknown";
        Long cropId = field.getCurrentCropId();

        if (cropId != null) {
            CropDefinition crop = cropDefinitionRepository.findById(cropId).orElse(null);
            if (crop != null) {
                cropName = crop.getName();
                // Calculate yield: area * yield/sqm with random factor (±15%)
                if (field.getAreaSqm() != null && crop.getExpectedYieldPerSqm() != null) {
                    double randomFactor = 0.85 + Math.random() * 0.30; // 0.85 - 1.15
                    yieldKg = field.getAreaSqm().multiply(crop.getExpectedYieldPerSqm())
                            .multiply(BigDecimal.valueOf(randomFactor));
                    yieldKg = yieldKg.setScale(2, java.math.RoundingMode.HALF_UP);
                }
                // Calculate revenue: yield * market price
                if (crop.getMarketPricePerKg() != null) {
                    revenue = yieldKg.multiply(crop.getMarketPricePerKg());
                }
            }
        }

        // Calculate total costs and profit
        BigDecimal totalCost = field.getTotalInvestment() != null ? field.getTotalInvestment() : BigDecimal.ZERO;
        totalCost = totalCost.add(machineCost);
        BigDecimal profit = revenue.subtract(totalCost);

        // Log activity before reset
        logActivity(fieldId, "HARVEST",
                "Thu hoạch " + cropName + ": " + yieldKg.setScale(0, java.math.RoundingMode.HALF_UP) + " kg", yieldKg,
                "kg", machineCost, null);

        // Update field - RESET for next season
        field.setActualHarvestDate(LocalDate.now());
        field.setWorkflowStage("HARVESTED");
        field.setStatus("FALLOW");

        // Store final investment before reset
        BigDecimal finalInvestment = totalCost;

        // Save harvest record for history
        HarvestRecord record = HarvestRecord.builder()
                .fieldId(fieldId)
                .cropId(cropId)
                .cropName(cropName)
                .plantingDate(field.getPlantingDate())
                .harvestDate(LocalDate.now())
                .yieldKg(yieldKg)
                .revenue(revenue)
                .totalCost(finalInvestment)
                .profit(profit)
                .build();
        harvestRecordRepository.save(record);

        // Update user balance: add income (revenue) and deduct machinery cost
        final BigDecimal finalRevenue = revenue;
        final String finalCropName = cropName;
        final BigDecimal finalYieldKg = yieldKg;
        final BigDecimal finalMachineCost = machineCost; // Create final copy for lambda
        farmRepository.findById(field.getFarmId()).ifPresent(farm -> {
            Long ownerId = farm.getOwnerId();
            // Deduct machinery cost
            assetService.deductExpense(ownerId, finalMachineCost, "MACHINERY",
                    "Chi phí máy thu hoạch ruộng: " + field.getName(), fieldId);
            // Add harvest revenue
            assetService.addIncome(ownerId, finalRevenue, "HARVEST", "Thu hoạch " + finalCropName + " từ ruộng: "
                    + field.getName() + " (" + finalYieldKg.setScale(0, java.math.RoundingMode.HALF_UP) + " kg)",
                    fieldId);
        });

        // Reset for next season
        field.setCurrentCropId(null);
        field.setPlantingDate(null);
        field.setExpectedHarvestDate(null);
        field.setSeedingDate(null);
        field.setSeedingQuantity(null);
        field.setSeedingCost(null);
        field.setFertilizerId(null);
        field.setTotalInvestment(BigDecimal.ZERO);
        field.setLastWateredAt(null);
        field.setLastFertilizedAt(null);
        field.setLastPesticideAt(null);
        field.setWorkflowStage("EMPTY");
        fieldRepository.save(field);

        // Return result
        java.util.Map<String, Object> result = new java.util.HashMap<>();
        result.put("field", field);
        result.put("cropName", cropName);
        result.put("yieldKg", yieldKg);
        result.put("revenue", revenue);
        result.put("totalCost", finalInvestment);
        result.put("profit", profit);
        return result;
    }

    /**
     * Get field status with countdown timers
     */
    public java.util.Map<String, Object> getFieldStatus(Long fieldId) {
        Field field = fieldRepository.findById(fieldId)
                .orElseThrow(() -> new RuntimeException("Field not found"));

        java.util.Map<String, Object> status = new java.util.HashMap<>();
        status.put("field", field);

        // Water countdown (every 12 hours for most crops)
        long hoursUntilWater = 12;
        if (field.getLastWateredAt() != null) {
            long hoursSinceWater = java.time.Duration.between(field.getLastWateredAt(), java.time.LocalDateTime.now())
                    .toHours();
            hoursUntilWater = Math.max(0, 12 - hoursSinceWater);
        }
        status.put("hoursUntilWater", hoursUntilWater);

        // Fertilizer countdown (every 7 days)
        long daysUntilFertilize = 7;
        if (field.getLastFertilizedAt() != null) {
            long daysSinceFertilize = java.time.Duration
                    .between(field.getLastFertilizedAt(), java.time.LocalDateTime.now()).toDays();
            daysUntilFertilize = Math.max(0, 7 - daysSinceFertilize);
        }
        status.put("daysUntilFertilize", daysUntilFertilize);

        // Pesticide countdown (every 14 days)
        long daysUntilPesticide = 14;
        if (field.getLastPesticideAt() != null) {
            long daysSincePesticide = java.time.Duration
                    .between(field.getLastPesticideAt(), java.time.LocalDateTime.now()).toDays();
            daysUntilPesticide = Math.max(0, 14 - daysSincePesticide);
        }
        status.put("daysUntilPesticide", daysUntilPesticide);

        // Days until harvest
        long daysUntilHarvest = 0;
        boolean readyToHarvest = false;

        // Harvest timing info (for currently harvesting fields)
        if ("HARVESTING".equals(field.getWorkflowStage()) && field.getHarvestingStartedAt() != null) {
            status.put("harvestingStartedAt", field.getHarvestingStartedAt().toString());
            status.put("harvestingDurationMinutes", field.getHarvestingDurationMinutes());

            // Calculate remaining minutes
            java.time.LocalDateTime endTime = field.getHarvestingStartedAt()
                    .plusMinutes(field.getHarvestingDurationMinutes());
            long remainingMinutes = java.time.Duration.between(java.time.LocalDateTime.now(), endTime).toMinutes();
            status.put("remainingMinutes", Math.max(0, remainingMinutes)); // Ensure non-negative

            if (java.time.LocalDateTime.now().isAfter(endTime) || remainingMinutes < 0) {
                status.put("isHarvestReady", true);
            }
        }

        if (field.getExpectedHarvestDate() != null) {
            daysUntilHarvest = java.time.temporal.ChronoUnit.DAYS.between(LocalDate.now(),
                    field.getExpectedHarvestDate());
            if (daysUntilHarvest <= 0) {
                readyToHarvest = true;
                daysUntilHarvest = 0;
            }
        }
        status.put("daysUntilHarvest", daysUntilHarvest);
        status.put("readyToHarvest", readyToHarvest);

        // Estimated revenue
        if (field.getCurrentCropId() != null && field.getAreaSqm() != null) {
            cropDefinitionRepository.findById(field.getCurrentCropId()).ifPresent(crop -> {
                if (crop.getExpectedYieldPerSqm() != null && crop.getMarketPricePerKg() != null) {
                    BigDecimal yield = field.getAreaSqm().multiply(crop.getExpectedYieldPerSqm());
                    status.put("estimatedRevenue", yield.multiply(crop.getMarketPricePerKg()));
                }
            });
        }

        return status;
    }
}
