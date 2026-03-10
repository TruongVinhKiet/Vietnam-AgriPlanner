package com.agriplanner.controller;

import com.agriplanner.model.*;
import com.agriplanner.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

import lombok.NonNull;

@RestController
@RequestMapping("/api/traceability")
@RequiredArgsConstructor
@CrossOrigin(origins = "*") // Public access for QR scanning
@SuppressWarnings("null")
public class TraceabilityController {

    private final FieldRepository fieldRepository;
    private final FarmingActivityRepository activityRepository;
    private final FarmRepository farmRepository;
    private final PenRepository penRepository;
    private final UserRepository userRepository;
    private final AssetTransactionRepository assetTransactionRepository;
    private final CooperativeMemberRepository cooperativeMemberRepository;

    @GetMapping("/{fieldId}")
    public ResponseEntity<?> getTraceabilityInfo(@PathVariable @NonNull Long fieldId) {
        try {
            Field field = fieldRepository.findById(fieldId)
                    .orElseThrow(() -> new RuntimeException("Field not found"));

            // Fetch Farm Data
            String farmName = "Nông trại AgriPlanner";
            String farmLocation = "Việt Nam";
            BigDecimal totalArea = field.getAreaSqm();
            LocalDateTime firstFieldDate = field.getCreatedAt();
            Long farmId = field.getFarmId();
            String ownerName = null;
            String ownerAvatar = null;
            LocalDateTime farmCreatedAt = null;
            int totalFields = 0;
            int totalPens = 0;
            int totalWorkers = 0;
            int totalAnimals = 0;

            // Fields info collection
            List<Map<String, Object>> fieldsInfo = new ArrayList<>();
            // Pens info collection
            List<Map<String, Object>> pensInfo = new ArrayList<>();

            if (farmId != null) {
                Optional<Farm> farmOpt = farmRepository.findById(farmId);
                if (farmOpt.isPresent()) {
                    Farm farm = farmOpt.get();
                    farmName = farm.getName();
                    farmLocation = farm.getAddress() != null ? farm.getAddress() : "Việt Nam";
                    farmCreatedAt = farm.getCreatedAt();

                    // Get owner info
                    if (farm.getOwnerId() != null) {
                        Optional<User> ownerOpt = userRepository.findById(farm.getOwnerId());
                        if (ownerOpt.isPresent()) {
                            User owner = ownerOpt.get();
                            ownerName = owner.getFullName();
                            ownerAvatar = owner.getAvatarUrl();
                        }
                    }
                }

                // Calculate total area of all fields
                BigDecimal sumArea = fieldRepository.sumAreaByFarmId(farmId);
                if (sumArea != null) {
                    totalArea = sumArea;
                }

                // Find oldest field date
                Field oldestField = fieldRepository.findFirstByFarmIdOrderByCreatedAtAsc(farmId);
                if (oldestField != null) {
                    firstFieldDate = oldestField.getCreatedAt();
                }

                // Get all fields
                List<Field> allFields = fieldRepository.findByFarmId(farmId);
                totalFields = allFields.size();
                for (Field f : allFields) {
                    Map<String, Object> fInfo = new HashMap<>();
                    fInfo.put("name", f.getName());
                    fInfo.put("areaSqm", f.getAreaSqm());
                    fInfo.put("cropName", f.getCurrentCrop() != null ? f.getCurrentCrop().getName() : null);
                    fInfo.put("status", f.getStatus());
                    fInfo.put("plantingDate", f.getPlantingDate());
                    fInfo.put("condition", f.getCondition() != null ? f.getCondition().name() : null);
                    fieldsInfo.add(fInfo);
                }

                // Get livestock info
                List<Pen> pens = penRepository.findByFarmId(farmId);
                totalPens = pens.size();
                for (Pen pen : pens) {
                    Map<String, Object> pInfo = new HashMap<>();
                    pInfo.put("code", pen.getCode());
                    pInfo.put("farmingType", pen.getFarmingType());
                    pInfo.put("animalName", pen.getAnimalDefinition() != null ? pen.getAnimalDefinition().getName() : null);
                    pInfo.put("animalCount", pen.getAnimalCount());
                    pInfo.put("status", pen.getStatus());
                    pInfo.put("startDate", pen.getStartDate());
                    totalAnimals += (pen.getAnimalCount() != null ? pen.getAnimalCount() : 0);
                    pensInfo.add(pInfo);
                }

                // Get workers count
                List<User> workers = userRepository.findByRoleAndFarmIdAndApprovalStatus(
                        UserRole.WORKER, farmId, User.ApprovalStatus.APPROVED);
                totalWorkers = workers.size();
            }

            CropDefinition crop = field.getCurrentCrop();
            String cropName = crop != null ? crop.getName() : "Nông sản";

            // Get ALL activities for this farm's fields  
            List<FarmingActivity> activities = activityRepository.findByFieldIdOrderByPerformedAtDesc(fieldId);

            // Financial data
            BigDecimal totalIncome = BigDecimal.ZERO;
            BigDecimal totalExpense = BigDecimal.ZERO;
            BigDecimal monthlyExpense = BigDecimal.ZERO;
            Long ownerId = null;

            if (farmId != null) {
                Optional<Farm> farmCheck = farmRepository.findById(farmId);
                if (farmCheck.isPresent()) {
                    ownerId = farmCheck.get().getOwnerId();
                }
            }

            if (ownerId != null) {
                List<AssetTransaction> allTx = assetTransactionRepository.findByUserIdOrderByCreatedAtDesc(ownerId);
                LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);
                for (AssetTransaction tx : allTx) {
                    if ("INCOME".equals(tx.getTransactionType())) {
                        totalIncome = totalIncome.add(tx.getAmount());
                    } else if ("EXPENSE".equals(tx.getTransactionType())) {
                        totalExpense = totalExpense.add(tx.getAmount());
                        if (tx.getCreatedAt() != null && tx.getCreatedAt().isAfter(thirtyDaysAgo)) {
                            monthlyExpense = monthlyExpense.add(tx.getAmount());
                        }
                    }
                }
            }

            // Cooperative data
            List<Map<String, Object>> cooperatives = new ArrayList<>();
            if (ownerId != null) {
                List<CooperativeMember> memberships = cooperativeMemberRepository.findActiveByUserId(ownerId);
                for (CooperativeMember cm : memberships) {
                    Cooperative coop = cm.getCooperative();
                    Map<String, Object> coopInfo = new HashMap<>();
                    coopInfo.put("name", coop.getName());
                    coopInfo.put("code", coop.getCode());
                    coopInfo.put("role", cm.getRole().name());
                    coopInfo.put("memberCount", coop.getMemberCount());
                    coopInfo.put("address", coop.getAddress());
                    coopInfo.put("joinedAt", cm.getJoinedAt());
                    cooperatives.add(coopInfo);
                }
            }

            Map<String, Object> result = new LinkedHashMap<>();

            // Farm overview
            result.put("farmName", farmName);
            result.put("fieldName", farmName); // backward compatibility
            result.put("location", farmLocation);
            result.put("ownerName", ownerName);
            result.put("ownerAvatar", ownerAvatar);
            result.put("farmCreatedAt", farmCreatedAt);
            result.put("areaSqm", totalArea);
            result.put("totalFields", totalFields);
            result.put("totalPens", totalPens);
            result.put("totalWorkers", totalWorkers);
            result.put("totalAnimals", totalAnimals);

            // Current field crop info
            result.put("cropName", cropName);
            result.put("plantingDate",
                    firstFieldDate != null ? firstFieldDate.toLocalDate() : java.time.LocalDate.now());
            result.put("expectedHarvestDate", field.getExpectedHarvestDate());

            // Fields and Pens detail
            result.put("fields", fieldsInfo);
            result.put("pens", pensInfo);

            // Financial data
            result.put("totalIncome", totalIncome);
            result.put("totalExpense", totalExpense);
            result.put("monthlyExpense", monthlyExpense);
            result.put("balance", totalIncome.subtract(totalExpense));

            // Cooperative data
            result.put("cooperatives", cooperatives);

            // Enhance activities
            String currentFieldName = field.getName();
            List<Map<String, Object>> activitiesEnhanced = new ArrayList<>();
            for (FarmingActivity act : activities) {
                Map<String, Object> actMap = new HashMap<>();
                actMap.put("activityType", act.getActivityType());
                actMap.put("description", act.getDescription());
                actMap.put("performedAt", act.getPerformedAt());
                actMap.put("quantity", act.getQuantity());
                actMap.put("unit", act.getUnit());
                actMap.put("cost", act.getCost());
                actMap.put("fieldName", currentFieldName);
                activitiesEnhanced.add(actMap);
            }

            result.put("activities", activitiesEnhanced);
            result.put("verified", true);

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
