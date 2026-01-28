package com.agriplanner.controller;

import com.agriplanner.model.*;
import com.agriplanner.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;

/**
 * REST Controller for Livestock Management
 * Handles pens (cages/ponds) and animal definitions
 */
@RestController
@RequestMapping("/api/livestock")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
@SuppressWarnings({ "null", "unused" })
public class LivestockController {

    private final AnimalDefinitionRepository animalRepository;
    private final PenRepository penRepository;
    private final FarmRepository farmRepository;
    private final UserRepository userRepository;
    private final AssetTransactionRepository assetTransactionRepository;
    private final VaccinationScheduleRepository vaccinationScheduleRepository;
    private final HealthRecordRepository healthRecordRepository;
    private final ObjectMapper objectMapper;

    // ==================== ANIMAL DEFINITIONS ====================

    /**
     * Get all animal definitions
     */
    @GetMapping("/animals")
    public ResponseEntity<List<AnimalDefinition>> getAllAnimals() {
        return ResponseEntity.ok(animalRepository.findAll());
    }

    /**
     * Get animals filtered by farming type
     */
    @GetMapping("/animals/farming-type/{type}")
    public ResponseEntity<List<AnimalDefinition>> getAnimalsByFarmingType(@PathVariable String type) {
        return ResponseEntity.ok(animalRepository.findByFarmingTypesContaining(type));
    }

    /**
     * Get animals filtered by water type (for POND farming)
     */
    @GetMapping("/animals/water-type/{waterType}")
    public ResponseEntity<List<AnimalDefinition>> getAnimalsByWaterType(@PathVariable String waterType) {
        return ResponseEntity.ok(animalRepository.findByWaterType(waterType));
    }

    /**
     * Get animals by farming type and water type
     */
    @GetMapping("/animals/filter")
    public ResponseEntity<List<AnimalDefinition>> getAnimalsFiltered(
            @RequestParam(required = false) String farmingType,
            @RequestParam(required = false) String waterType,
            @RequestParam(required = false) String category) {

        if (farmingType != null && waterType != null) {
            return ResponseEntity.ok(animalRepository.findByFarmingTypeAndWaterType(farmingType, waterType));
        } else if (farmingType != null && category != null) {
            return ResponseEntity.ok(animalRepository.findByFarmingTypeAndCategory(farmingType, category));
        } else if (farmingType != null) {
            return ResponseEntity.ok(animalRepository.findByFarmingTypesContaining(farmingType));
        } else if (waterType != null) {
            return ResponseEntity.ok(animalRepository.findByWaterType(waterType));
        } else if (category != null) {
            return ResponseEntity.ok(animalRepository.findByCategory(category));
        }
        return ResponseEntity.ok(animalRepository.findAll());
    }

    /**
     * Get single animal definition
     */
    @GetMapping("/animals/{id}")
    public ResponseEntity<AnimalDefinition> getAnimalById(@PathVariable long id) {
        return animalRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // ==================== PENS (CAGES/PONDS) ====================

    /**
     * Get all pens for a farm
     */
    @GetMapping("/pens")
    public ResponseEntity<List<Pen>> getPens(@RequestParam long farmId) {
        return ResponseEntity.ok(penRepository.findByFarmId(farmId));
    }

    /**
     * Get single pen by ID
     */
    @GetMapping("/pens/{id}")
    public ResponseEntity<Pen> getPenById(@PathVariable long id) {
        return penRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Create a new pen
     */
    @PostMapping("/pens")
    public ResponseEntity<?> createPen(@RequestBody Map<String, Object> request) {
        try {
            if (request.get("farmId") == null)
                throw new IllegalArgumentException("Farm ID is required");
            Long farmId = Long.valueOf(request.get("farmId").toString());

            String code = (String) request.get("code");
            String farmingType = (String) request.get("farmingType");
            String waterType = (String) request.getOrDefault("waterType", null);

            Object lengthObj = request.get("lengthM");
            Object widthObj = request.get("widthM");
            if (lengthObj == null || widthObj == null)
                throw new IllegalArgumentException("Dimensions are required");

            BigDecimal lengthM = new BigDecimal(lengthObj.toString());
            BigDecimal widthM = new BigDecimal(widthObj.toString());
            BigDecimal areaSqm = lengthM.multiply(widthM);

            Long animalDefId = request.get("animalDefinitionId") != null
                    ? Long.valueOf(request.get("animalDefinitionId").toString())
                    : null;
            Integer animalCount = request.get("animalCount") != null
                    ? Integer.valueOf(request.get("animalCount").toString())
                    : 0;
            String animalSize = (String) request.getOrDefault("animalSize", "MEDIUM");

            // Validate capacity
            AnimalDefinition animal = null;
            if (animalDefId != null) {
                animal = animalRepository.findById(animalDefId).orElse(null);
                if (animal != null && animalCount > 0 && animal.getSpacePerUnitSqm() != null) {
                    BigDecimal requiredSpace = animal.getSpacePerUnitSqm().multiply(BigDecimal.valueOf(animalCount));
                    if (requiredSpace.compareTo(areaSqm) > 0) {
                        Map<String, Object> warning = new HashMap<>();
                        warning.put("warning", true);
                        warning.put("message",
                                "Diện tích không đủ! Cần " + requiredSpace + " m² cho " + animalCount + " con.");
                        warning.put("requiredArea", requiredSpace);
                        warning.put("availableArea", areaSqm);
                        return ResponseEntity.badRequest().body(warning);
                    }
                }
            }

            // Calculate expected harvest date & Investment
            LocalDate startDate = LocalDate.now();
            LocalDate expectedHarvest = startDate;
            BigDecimal totalInvestment = BigDecimal.ZERO;

            if (animal != null) {
                if (animal.getGrowthDurationDays() != null) {
                    expectedHarvest = startDate.plusDays(animal.getGrowthDurationDays());
                }

                // Calculate dynamic price based on size
                BigDecimal unitPrice = BigDecimal.ZERO;
                if (animal.getBuyPricePerUnit() != null) {
                    unitPrice = animal.getBuyPricePerUnit(); // Default
                }

                try {
                    if (animal.getSizes() != null && !animal.getSizes().isEmpty()) {
                        JsonNode sizesNode = objectMapper.readTree(animal.getSizes());
                        String sizeKey = animalSize.toLowerCase(); // SMALL -> small, MEDIUM -> medium
                        if (sizesNode.has(sizeKey)) {
                            JsonNode sizeNode = sizesNode.get(sizeKey);
                            if (sizeNode.has("buyPrice")) {
                                unitPrice = new BigDecimal(sizeNode.get("buyPrice").asText());
                            }
                        }
                    }
                } catch (Exception e) {
                    log.warn("Failed to parse animal sizes: {}", e.getMessage());
                }

                if (animalCount > 0) {
                    totalInvestment = unitPrice.multiply(BigDecimal.valueOf(animalCount));
                }
            }

            // Deduct balance from User
            if (totalInvestment.compareTo(BigDecimal.ZERO) > 0) {
                Farm farm = farmRepository.findById(farmId).orElse(null);
                if (farm != null) {
                    User user = userRepository.findById(farm.getOwnerId()).orElse(null);
                    if (user != null) {
                        BigDecimal currentBalance = user.getBalance() != null ? user.getBalance() : BigDecimal.ZERO;
                        if (currentBalance.compareTo(totalInvestment) < 0) {
                            return ResponseEntity.badRequest()
                                    .body(Map.of("error", "Số dư không đủ! Cần " + totalInvestment + " VNĐ"));
                        }

                        // Deduct and Save
                        user.setBalance(currentBalance.subtract(totalInvestment));
                        userRepository.save(user);

                        // Log transaction
                        try {
                            AssetTransaction transaction = AssetTransaction.builder()
                                    .userId(user.getId())
                                    .amount(totalInvestment)
                                    .transactionType("EXPENSE")
                                    .category("LIVESTOCK")
                                    .description("Mua giống " + (animal != null ? animal.getName() : "Vật nuôi")
                                            + " (" + animalCount + " con, Size: " + animalSize + ")")
                                    .build();
                            assetTransactionRepository.save(transaction);
                        } catch (Exception e) {
                            log.error("Failed to save transaction log", e);
                        }
                    }
                }
            }

            Pen pen = Pen.builder()
                    .farmId(farmId)
                    .code(code)
                    .farmingType(farmingType)
                    .waterType(waterType)
                    .lengthM(lengthM)
                    .widthM(widthM)
                    .areaSqm(areaSqm)
                    .animalDefinition(animal) // animal is already resolved or null
                    .animalCount(animalCount)
                    .animalSize(animalSize)
                    .startDate(startDate)
                    .expectedHarvestDate(expectedHarvest)
                    .status(animalCount > 0 ? "CLEAN" : "EMPTY")
                    .totalInvestment(totalInvestment)
                    .capacity(areaSqm.intValue())
                    .build();

            Pen saved = penRepository.save(pen);

            // Generate Health Records from Schedule
            if (animal != null) {
                try {
                    List<VaccinationSchedule> schedules = vaccinationScheduleRepository
                            .findByAnimalDefinitionId(animal.getId());
                    for (VaccinationSchedule sched : schedules) {
                        healthRecordRepository.save(HealthRecord.builder()
                                .penId(saved.getId())
                                .eventType("VACCINE")
                                .name(sched.getName())
                                .eventDate(startDate.plusDays(sched.getAgeDays()))
                                .status("PLANNED")
                                .notes(sched.getDescription())
                                .build());
                    }
                } catch (Exception e) {
                    log.error("Failed to generate health schedule", e);
                }
            }

            log.info("Created new pen: {} for farm {}", code, farmId);
            return ResponseEntity.ok(saved);

        } catch (Exception e) {
            log.error("Error creating pen: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Update pen status
     */
    @PutMapping("/pens/{id}/status")
    public ResponseEntity<?> updatePenStatus(@PathVariable long id, @RequestBody Map<String, String> request) {
        return penRepository.findById(id)
                .map(pen -> {
                    pen.setStatus(request.get("status"));
                    return ResponseEntity.ok(penRepository.save(pen));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Update pen
     */
    @PutMapping("/pens/{id}")
    public ResponseEntity<?> updatePen(@PathVariable long id, @RequestBody Map<String, Object> request) {
        return penRepository.findById(id)
                .map(pen -> {
                    if (request.containsKey("animalCount")) {
                        pen.setAnimalCount(Integer.valueOf(request.get("animalCount").toString()));
                    }
                    if (request.containsKey("animalSize")) {
                        pen.setAnimalSize((String) request.get("animalSize"));
                    }
                    if (request.containsKey("status")) {
                        pen.setStatus((String) request.get("status"));
                    }
                    return ResponseEntity.ok(penRepository.save(pen));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Delete pen
     */
    @DeleteMapping("/pens/{id}")
    public ResponseEntity<?> deletePen(@PathVariable long id) {
        if (penRepository.existsById(id)) {
            penRepository.deleteById(id);
            return ResponseEntity.ok(Map.of("message", "Đã xóa chuồng thành công"));
        }
        return ResponseEntity.notFound().build();
    }

    /**
     * Calculate capacity for given dimensions and animal
     */
    @PostMapping("/calculate-capacity")
    public ResponseEntity<?> calculateCapacity(@RequestBody Map<String, Object> request) {
        try {
            if (request.get("lengthM") == null || request.get("widthM") == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Dimensions required"));
            }
            BigDecimal lengthM = new BigDecimal(request.get("lengthM").toString());
            BigDecimal widthM = new BigDecimal(request.get("widthM").toString());
            BigDecimal areaSqm = lengthM.multiply(widthM);

            if (request.get("animalDefinitionId") == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Animal ID required"));
            }
            Long animalDefId = Long.valueOf(request.get("animalDefinitionId").toString());

            Integer desiredCount = request.get("animalCount") != null
                    ? Integer.valueOf(request.get("animalCount").toString())
                    : 0;

            AnimalDefinition animal = animalRepository.findById(animalDefId).orElse(null);
            if (animal == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Animal not found"));
            }

            BigDecimal spacePerUnit = animal.getSpacePerUnitSqm();
            if (spacePerUnit == null || spacePerUnit.compareTo(BigDecimal.ZERO) == 0) {
                spacePerUnit = BigDecimal.ONE;
            }

            int maxCapacity = areaSqm.divide(spacePerUnit, 0, java.math.RoundingMode.FLOOR).intValue();
            boolean isOverCapacity = desiredCount > maxCapacity;

            Map<String, Object> result = new HashMap<>();
            result.put("areaSqm", areaSqm);
            result.put("spacePerUnit", spacePerUnit);
            result.put("maxCapacity", maxCapacity);
            result.put("desiredCount", desiredCount);
            result.put("isOverCapacity", isOverCapacity);
            result.put("animalName", animal.getName());

            if (isOverCapacity) {
                result.put("warning", "Số lượng vượt quá sức chứa! Tối đa " + maxCapacity + " " + animal.getUnit());
            }

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    // ==================== HEALTH & EVENTS ====================

    /**
     * Get health records for a pen
     */
    @GetMapping("/pens/{penId}/health")
    public ResponseEntity<List<HealthRecord>> getHealthRecords(@PathVariable long penId) {
        return ResponseEntity.ok(healthRecordRepository.findByPenIdOrderByEventDateAsc(penId));
    }

    /**
     * Create a new health/sickness record manually
     */
    @PostMapping("/pens/{penId}/health")
    public ResponseEntity<?> createHealthRecord(@PathVariable long penId, @RequestBody Map<String, Object> payload) {
        try {
            String name = (String) payload.get("name");
            String type = (String) payload.get("eventType"); // SICKNESS, CHECKUP
            String notes = (String) payload.get("notes");
            String dateStr = (String) payload.get("eventDate");

            HealthRecord record = HealthRecord.builder()
                    .penId(penId)
                    .name(name)
                    .eventType(type)
                    .eventDate(LocalDate.parse(dateStr))
                    .status("PLANNED")
                    .notes(notes)
                    .build();

            return ResponseEntity.ok(healthRecordRepository.save(record));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Update health record status (e.g., mark as COMPLETED)
     */
    @PutMapping("/health/{id}/status")
    public ResponseEntity<?> updateHealthStatus(@PathVariable long id, @RequestBody Map<String, String> payload) {
        return healthRecordRepository.findById(id).map(record -> {
            if (payload.containsKey("status")) {
                record.setStatus(payload.get("status"));
            }
            if (payload.containsKey("notes")) {
                record.setNotes(payload.get("notes"));
            }
            return ResponseEntity.ok(healthRecordRepository.save(record));
        }).orElse(ResponseEntity.notFound().build());
    }

    // ==================== HARVEST / SELL ====================

    /**
     * Harvest/Sell animals from a pen
     * - Deducts animal count from pen
     * - Adds revenue to user balance
     * - Records transaction in asset_transactions
     */
    @PostMapping("/pens/{penId}/harvest")
    public ResponseEntity<?> harvestAnimals(@PathVariable long penId, @RequestBody Map<String, Object> payload) {
        try {
            // Get pen
            Pen pen = penRepository.findById(penId).orElse(null);
            if (pen == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Không tìm thấy chuồng"));
            }

            // Parse payload
            int quantity = Integer.parseInt(payload.get("quantity").toString());
            BigDecimal pricePerUnit = new BigDecimal(payload.get("pricePerUnit").toString());
            String buyer = payload.get("buyer") != null ? payload.get("buyer").toString() : "";
            String notes = payload.get("notes") != null ? payload.get("notes").toString() : "";
            String animalName = payload.get("animalName") != null ? payload.get("animalName").toString() : "Vật nuôi";

            // Validate quantity
            if (quantity <= 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "Số lượng phải lớn hơn 0"));
            }

            if (pen.getAnimalCount() == null || quantity > pen.getAnimalCount()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "Số lượng vượt quá số con hiện có (" + pen.getAnimalCount() + ")"));
            }

            // Calculate total revenue
            BigDecimal totalRevenue = pricePerUnit.multiply(BigDecimal.valueOf(quantity));

            // Get farm and user
            Farm farm = farmRepository.findById(pen.getFarmId()).orElse(null);
            if (farm == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Không tìm thấy trang trại"));
            }

            User user = userRepository.findById(farm.getOwnerId()).orElse(null);
            if (user == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Không tìm thấy người dùng"));
            }

            // Add revenue to user balance
            BigDecimal currentBalance = user.getBalance() != null ? user.getBalance() : BigDecimal.ZERO;
            user.setBalance(currentBalance.add(totalRevenue));
            userRepository.save(user);

            // Update pen animal count
            int newCount = pen.getAnimalCount() - quantity;
            pen.setAnimalCount(newCount);

            // Update pen status if empty
            if (newCount <= 0) {
                pen.setStatus("EMPTY");
                pen.setAnimalCount(0);
            }

            penRepository.save(pen);

            // Log transaction
            String description = "Bán " + animalName + " (" + quantity + " con";
            if (!buyer.isEmpty()) {
                description += " - " + buyer;
            }
            description += ")";

            try {
                AssetTransaction transaction = AssetTransaction.builder()
                        .userId(user.getId())
                        .amount(totalRevenue)
                        .transactionType("INCOME")
                        .category("LIVESTOCK")
                        .description(description)
                        .notes(notes)
                        .build();
                AssetTransaction saved = assetTransactionRepository.save(transaction);
                log.info("[HARVEST] Transaction saved successfully: id={}, userId={}, amount={}",
                        saved.getId(), user.getId(), totalRevenue);
            } catch (Exception e) {
                log.error("[HARVEST] Failed to save harvest transaction log: {}", e.getMessage(), e);
            }

            log.info("[HARVEST] Successful: {} {} sold from pen {} for {} VND. User {} new balance: {}",
                    quantity, animalName, pen.getCode(), totalRevenue, user.getEmail(), user.getBalance());

            // Return success response
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "Bán thành công " + quantity + " " + animalName);
            result.put("revenue", totalRevenue);
            result.put("newBalance", user.getBalance());
            result.put("remainingAnimals", newCount);
            result.put("penStatus", pen.getStatus());

            return ResponseEntity.ok(result);

        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Dữ liệu số không hợp lệ"));
        } catch (Exception e) {
            log.error("Error during harvest: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", "Lỗi hệ thống: " + e.getMessage()));
        }
    }

    /**
     * Get harvest history for a pen
     */
    @GetMapping("/pens/{penId}/harvest-history")
    public ResponseEntity<?> getHarvestHistory(@PathVariable long penId) {
        try {
            Pen pen = penRepository.findById(penId).orElse(null);
            if (pen == null) {
                return ResponseEntity.notFound().build();
            }

            Farm farm = farmRepository.findById(pen.getFarmId()).orElse(null);
            if (farm == null) {
                return ResponseEntity.notFound().build();
            }

            // Get INCOME transactions for LIVESTOCK category for this user
            List<AssetTransaction> transactions = assetTransactionRepository
                    .findByUserIdAndTransactionTypeAndCategoryOrderByCreatedAtDesc(
                            farm.getOwnerId(), "INCOME", "LIVESTOCK");

            return ResponseEntity.ok(transactions);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
