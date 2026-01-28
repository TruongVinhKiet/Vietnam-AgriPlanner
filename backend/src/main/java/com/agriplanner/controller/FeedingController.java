package com.agriplanner.controller;

import com.agriplanner.model.*;
import com.agriplanner.repository.*;
import com.agriplanner.service.AssetService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/feeding")
@RequiredArgsConstructor
@SuppressWarnings({ "null", "unused" })
public class FeedingController {

    private final FeedingLogRepository feedingLogRepository;
    private final AnimalGrowthRepository animalGrowthRepository;
    private final InventoryRepository inventoryRepository;
    private final FeedDefinitionRepository feedDefinitionRepository;
    private final AnimalFeedCompatibilityRepository animalFeedCompatibilityRepository;
    private final PenRepository penRepository;
    private final AssetService assetService;
    private final UserRepository userRepository;

    // ==========================================
    // FEED DEFINITIONS ENDPOINTS
    // ==========================================

    @GetMapping("/definitions")
    public ResponseEntity<List<FeedDefinition>> getAllFeedDefinitions() {
        return ResponseEntity.ok(feedDefinitionRepository.findAllByOrderByNameAsc());
    }

    @GetMapping("/definitions/category/{category}")
    public ResponseEntity<List<FeedDefinition>> getFeedsByCategory(@PathVariable String category) {
        return ResponseEntity.ok(feedDefinitionRepository.findByCategory(category.toUpperCase()));
    }

    @GetMapping("/definitions/{id}")
    public ResponseEntity<?> getFeedDefinitionById(@PathVariable Long id) {
        return feedDefinitionRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // ==========================================
    // COMPATIBLE FEEDS ENDPOINTS
    // ==========================================

    @GetMapping("/compatible/{animalDefinitionId}")
    public ResponseEntity<List<Map<String, Object>>> getCompatibleFeeds(@PathVariable Long animalDefinitionId) {
        List<AnimalFeedCompatibility> compatList = animalFeedCompatibilityRepository
                .findByAnimalDefinitionIdOrderByIsPrimaryDesc(animalDefinitionId);

        List<Map<String, Object>> result = compatList.stream().map(compat -> {
            Map<String, Object> feedInfo = new HashMap<>();
            feedInfo.put("id", compat.getId());
            feedInfo.put("feedDefinitionId", compat.getFeedDefinitionId());
            feedInfo.put("feedName", compat.getFeedDefinition() != null ? compat.getFeedDefinition().getName() : "N/A");
            feedInfo.put("feedCategory",
                    compat.getFeedDefinition() != null ? compat.getFeedDefinition().getCategory() : "N/A");
            feedInfo.put("pricePerUnit",
                    compat.getFeedDefinition() != null ? compat.getFeedDefinition().getPricePerUnit()
                            : BigDecimal.ZERO);
            feedInfo.put("proteinPercent",
                    compat.getFeedDefinition() != null ? compat.getFeedDefinition().getProteinPercent() : null);
            feedInfo.put("unit", compat.getFeedDefinition() != null ? compat.getFeedDefinition().getUnit() : "kg");
            feedInfo.put("iconName",
                    compat.getFeedDefinition() != null ? compat.getFeedDefinition().getIconName() : "restaurant");
            feedInfo.put("isPrimary", compat.getIsPrimary());
            feedInfo.put("dailyAmountPerUnit", compat.getDailyAmountPerUnit());
            feedInfo.put("feedingFrequency", compat.getFeedingFrequency());
            feedInfo.put("notes", compat.getNotes());
            return feedInfo;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    @GetMapping("/compatible/check")
    public ResponseEntity<Map<String, Object>> checkFeedCompatibility(
            @RequestParam Long animalDefinitionId,
            @RequestParam Long feedDefinitionId) {
        boolean isCompatible = animalFeedCompatibilityRepository
                .existsByAnimalDefinitionIdAndFeedDefinitionId(animalDefinitionId, feedDefinitionId);

        Map<String, Object> result = new HashMap<>();
        result.put("animalDefinitionId", animalDefinitionId);
        result.put("feedDefinitionId", feedDefinitionId);
        result.put("isCompatible", isCompatible);

        return ResponseEntity.ok(result);
    }

    // ==========================================
    // CALCULATE FEED AMOUNT
    // ==========================================

    @GetMapping("/calculate/{penId}")
    public ResponseEntity<Map<String, Object>> calculateFeedAmount(@PathVariable Long penId) {
        Pen pen = penRepository.findById(penId)
                .orElseThrow(() -> new RuntimeException("Pen not found"));

        Map<String, Object> result = new HashMap<>();
        result.put("penId", penId);
        result.put("penCode", pen.getCode());
        result.put("animalCount", pen.getAnimalCount());

        if (pen.getAnimalDefinition() == null) {
            result.put("error", "No animal defined in this pen");
            return ResponseEntity.ok(result);
        }

        Long animalDefId = pen.getAnimalDefinition().getId();
        result.put("animalDefinitionId", animalDefId);
        result.put("animalName", pen.getAnimalDefinition().getName());

        List<AnimalFeedCompatibility> compatList = animalFeedCompatibilityRepository
                .findByAnimalDefinitionIdOrderByIsPrimaryDesc(animalDefId);

        List<Map<String, Object>> feedCalculations = compatList.stream().map(compat -> {
            Map<String, Object> calc = new HashMap<>();
            calc.put("feedName", compat.getFeedDefinition() != null ? compat.getFeedDefinition().getName() : "N/A");
            calc.put("feedDefinitionId", compat.getFeedDefinitionId());
            calc.put("isPrimary", compat.getIsPrimary());
            calc.put("dailyAmountPerUnit", compat.getDailyAmountPerUnit());
            calc.put("feedingFrequency", compat.getFeedingFrequency());

            // Calculate recommended amount based on animal count
            BigDecimal dailyPerUnit = compat.getDailyAmountPerUnit();
            int animalCount = pen.getAnimalCount() != null ? pen.getAnimalCount() : 0;
            BigDecimal totalDailyAmount = dailyPerUnit.multiply(BigDecimal.valueOf(animalCount));
            BigDecimal amountPerFeeding = compat.getFeedingFrequency() > 0
                    ? totalDailyAmount.divide(BigDecimal.valueOf(compat.getFeedingFrequency()), 3,
                            java.math.RoundingMode.HALF_UP)
                    : totalDailyAmount;

            calc.put("totalDailyAmount", totalDailyAmount);
            calc.put("amountPerFeeding", amountPerFeeding);

            // Cost calculation
            if (compat.getFeedDefinition() != null && compat.getFeedDefinition().getPricePerUnit() != null) {
                BigDecimal costPerFeeding = amountPerFeeding.multiply(compat.getFeedDefinition().getPricePerUnit());
                calc.put("costPerFeeding", costPerFeeding);
                calc.put("pricePerUnit", compat.getFeedDefinition().getPricePerUnit());
            }

            return calc;
        }).collect(Collectors.toList());

        result.put("feedRecommendations", feedCalculations);
        return ResponseEntity.ok(result);
    }

    // ==========================================
    // FEEDING OPERATIONS WITH NEW SYSTEM
    // ==========================================

    @PostMapping("/feed")
    @Transactional
    public ResponseEntity<?> recordFeeding(@RequestBody Map<String, Object> payload) {
        Long penId = Long.valueOf(payload.get("penId").toString());
        BigDecimal amountKg = new BigDecimal(payload.get("amountKg").toString());
        String notes = (String) payload.get("notes");
        String userEmail = payload.get("userEmail") != null ? payload.get("userEmail").toString() : null;

        // Support both old (feedItemId from inventory) and new (feedDefinitionId)
        // systems
        Long feedItemId = payload.get("feedItemId") != null
                ? Long.valueOf(payload.get("feedItemId").toString())
                : null;
        Long feedDefinitionId = payload.get("feedDefinitionId") != null
                ? Long.valueOf(payload.get("feedDefinitionId").toString())
                : null;

        BigDecimal cost = BigDecimal.ZERO;

        // Old system: Deduct from inventory
        if (feedItemId != null) {
            InventoryItem item = inventoryRepository.findById(feedItemId)
                    .orElseThrow(() -> new RuntimeException("Feed item not found"));

            if (item.getQuantity().compareTo(amountKg) < 0) {
                return ResponseEntity.badRequest()
                        .body("Not enough feed in inventory. Available: " + item.getQuantity());
            }

            // Deduct stock
            item.setQuantity(item.getQuantity().subtract(amountKg));
            inventoryRepository.save(item);

            cost = item.getCostPerUnit() != null ? item.getCostPerUnit().multiply(amountKg) : BigDecimal.ZERO;
        }

        // New system: Calculate cost from feed definition
        if (feedDefinitionId != null && feedItemId == null) {
            FeedDefinition feedDef = feedDefinitionRepository.findById(feedDefinitionId)
                    .orElseThrow(() -> new RuntimeException("Feed definition not found"));
            cost = feedDef.getPricePerUnit().multiply(amountKg);
        }

        // Record feeding log
        FeedingLog log = FeedingLog.builder()
                .penId(penId)
                .feedItemId(feedItemId)
                .feedDefinitionId(feedDefinitionId)
                .amountKg(amountKg)
                .cost(cost)
                .fedAt(LocalDateTime.now())
                .notes(notes)
                .build();

        feedingLogRepository.save(log);

        // Update pen feeding status
        Pen pen = penRepository.findById(penId).orElse(null);
        if (pen != null) {
            pen.setLastFedAt(LocalDateTime.now());

            // Calculate next feeding time based on feed definition
            int feedingFrequency = 2; // default 2 times per day
            if (feedDefinitionId != null && pen.getAnimalDefinition() != null) {
                List<AnimalFeedCompatibility> compatList = animalFeedCompatibilityRepository
                        .findByAnimalDefinitionIdOrderByIsPrimaryDesc(pen.getAnimalDefinition().getId());
                for (AnimalFeedCompatibility compat : compatList) {
                    if (compat.getFeedDefinitionId().equals(feedDefinitionId)) {
                        feedingFrequency = compat.getFeedingFrequency() != null ? compat.getFeedingFrequency() : 2;
                        break;
                    }
                }
            }

            // Calculate next feeding time: 24 / frequency hours from now
            int hoursUntilNextFeeding = 24 / feedingFrequency;
            pen.setNextFeedingAt(LocalDateTime.now().plusHours(hoursUntilNextFeeding));
            pen.setFeedingStatus("FED");

            penRepository.save(pen);
        }

        // Deduct cost from user balance
        if (cost.compareTo(BigDecimal.ZERO) > 0) {
            User currentUser = null;

            // Try to get user from authentication first
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getPrincipal() instanceof User) {
                currentUser = (User) auth.getPrincipal();
            }

            // Fallback: get user from userEmail in payload
            if (currentUser == null && userEmail != null && !userEmail.isEmpty()) {
                currentUser = userRepository.findByEmail(userEmail).orElse(null);
                System.out.println("[FEEDING DEBUG] Using userEmail from payload: " + userEmail + " -> user: "
                        + (currentUser != null ? currentUser.getId() : "null"));
            }

            if (currentUser != null) {
                // Get feed name for description
                String feedName = "Thức ăn";
                if (feedDefinitionId != null) {
                    FeedDefinition feedDef = feedDefinitionRepository.findById(feedDefinitionId).orElse(null);
                    if (feedDef != null) {
                        feedName = feedDef.getName();
                    }
                } else if (feedItemId != null) {
                    InventoryItem item = inventoryRepository.findById(feedItemId).orElse(null);
                    if (item != null) {
                        feedName = item.getName();
                    }
                }

                String penCode = pen != null ? pen.getCode() : "N/A";
                String description = String.format("Cho ăn %s - Chuồng %s (%.2f kg)",
                        feedName, penCode, amountKg);
                System.out.println("[FEEDING DEBUG] Calling assetService.deductExpense for user " + currentUser.getId()
                        + ", cost=" + cost);
                boolean result = assetService.deductExpense(currentUser.getId(), cost, "LIVESTOCK", description, penId);
                System.out.println("[FEEDING DEBUG] deductExpense result: " + result);
            } else {
                System.out.println("[FEEDING DEBUG] No user found, skipping balance deduction");
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Feeding recorded successfully");
        response.put("feedingLogId", log.getId());
        response.put("cost", cost);
        if (pen != null) {
            response.put("nextFeedingAt", pen.getNextFeedingAt());
        }

        return ResponseEntity.ok(response);
    }

    @GetMapping("/logs/{penId}")
    public ResponseEntity<List<FeedingLog>> getFeedingLogs(@PathVariable Long penId) {
        return ResponseEntity.ok(feedingLogRepository.findByPenIdOrderByFedAtDesc(penId));
    }

    // ==========================================
    // PEN FEEDING STATUS
    // ==========================================

    @GetMapping("/status/{penId}")
    public ResponseEntity<Map<String, Object>> getPenFeedingStatus(@PathVariable Long penId) {
        Pen pen = penRepository.findById(penId)
                .orElseThrow(() -> new RuntimeException("Pen not found"));

        Map<String, Object> status = new HashMap<>();
        status.put("penId", penId);
        status.put("penCode", pen.getCode());
        status.put("lastFedAt", pen.getLastFedAt());
        status.put("nextFeedingAt", pen.getNextFeedingAt());
        status.put("feedingStatus", pen.getFeedingStatus());

        // Calculate if overdue
        if (pen.getNextFeedingAt() != null && LocalDateTime.now().isAfter(pen.getNextFeedingAt())) {
            status.put("isOverdue", true);
            status.put("feedingStatus", "OVERDUE");

            // Update pen status to OVERDUE if not already
            if (!"OVERDUE".equals(pen.getFeedingStatus())) {
                pen.setFeedingStatus("OVERDUE");
                penRepository.save(pen);
            }
        } else {
            status.put("isOverdue", false);
        }

        return ResponseEntity.ok(status);
    }

    @GetMapping("/status/all/{farmId}")
    public ResponseEntity<List<Map<String, Object>>> getAllPenFeedingStatus(@PathVariable Long farmId) {
        List<Pen> pens = penRepository.findByFarmId(farmId);

        List<Map<String, Object>> statusList = pens.stream()
                .filter(pen -> pen.getAnimalCount() != null && pen.getAnimalCount() > 0)
                .map(pen -> {
                    Map<String, Object> status = new HashMap<>();
                    status.put("penId", pen.getId());
                    status.put("penCode", pen.getCode());
                    status.put("animalName",
                            pen.getAnimalDefinition() != null ? pen.getAnimalDefinition().getName() : "N/A");
                    status.put("animalCount", pen.getAnimalCount());
                    status.put("lastFedAt", pen.getLastFedAt());
                    status.put("nextFeedingAt", pen.getNextFeedingAt());

                    // Determine feeding status
                    String feedingStatus = pen.getFeedingStatus();
                    if (pen.getNextFeedingAt() != null && LocalDateTime.now().isAfter(pen.getNextFeedingAt())) {
                        feedingStatus = "OVERDUE";
                        if (!"OVERDUE".equals(pen.getFeedingStatus())) {
                            pen.setFeedingStatus("OVERDUE");
                            penRepository.save(pen);
                        }
                    }
                    status.put("feedingStatus", feedingStatus);

                    return status;
                }).collect(Collectors.toList());

        return ResponseEntity.ok(statusList);
    }

    @PostMapping("/reset-status/{penId}")
    @Transactional
    public ResponseEntity<?> resetFeedingStatus(@PathVariable Long penId) {
        Pen pen = penRepository.findById(penId)
                .orElseThrow(() -> new RuntimeException("Pen not found"));

        pen.setFeedingStatus("PENDING");
        pen.setLastFedAt(null);
        pen.setNextFeedingAt(null);
        penRepository.save(pen);

        return ResponseEntity.ok(Map.of("success", true, "message", "Feeding status reset"));
    }

    @PostMapping("/growth")
    public ResponseEntity<?> recordGrowth(@RequestBody Map<String, Object> payload) {
        Long penId = Long.valueOf(payload.get("penId").toString());
        BigDecimal weight = new BigDecimal(payload.get("weight").toString());
        String dateStr = (String) payload.get("date"); // YYYY-MM-DD
        LocalDate date = dateStr != null ? LocalDate.parse(dateStr) : LocalDate.now();

        AnimalGrowth growth = AnimalGrowth.builder()
                .penId(penId)
                .avgWeightKg(weight)
                .recordedDate(date)
                .createdAt(LocalDateTime.now())
                .build();

        animalGrowthRepository.save(growth);

        // Update Pen current animal size/weight?
        // Pen usually just tracks count. We might want to update Pen later but for now
        // just log.

        return ResponseEntity.ok(growth);
    }

    @GetMapping("/growth/{penId}")
    public ResponseEntity<List<AnimalGrowth>> getGrowthHistory(@PathVariable Long penId) {
        return ResponseEntity.ok(animalGrowthRepository.findByPenIdOrderByRecordedDateAsc(penId));
    }

    @GetMapping("/items")
    public ResponseEntity<List<InventoryItem>> getFeedItems() {
        return ResponseEntity.ok(inventoryRepository.findByType("FEED"));
    }
}
