package com.agriplanner.controller;

import com.agriplanner.model.CropDefinition;
import com.agriplanner.model.FarmingActivity;
import com.agriplanner.model.Field;
import com.agriplanner.model.Farm;
import com.agriplanner.repository.FarmingActivityRepository;
import com.agriplanner.repository.FieldRepository;
import com.agriplanner.repository.FarmRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

import lombok.NonNull;
// ... imports

@RestController
@RequestMapping("/api/traceability")
@RequiredArgsConstructor
@CrossOrigin(origins = "*") // Public access for QR scanning
public class TraceabilityController {

    private final FieldRepository fieldRepository;
    private final FarmingActivityRepository activityRepository;
    private final FarmRepository farmRepository;

    @GetMapping("/{fieldId}")
    public ResponseEntity<?> getTraceabilityInfo(@PathVariable @NonNull Long fieldId) {
        try {
            Field field = fieldRepository.findById(fieldId)
                    .orElseThrow(() -> new RuntimeException("Field not found"));

            // Fetch Farm Data
            String farmName = "Nông trại AgriPlanner";
            String farmLocation = "Việt Nam";
            java.math.BigDecimal totalArea = field.getAreaSqm();
            java.time.LocalDateTime firstFieldDate = field.getCreatedAt();

            if (field.getFarmId() != null) {
                long farmId = field.getFarmId();
                Optional<Farm> farmOpt = farmRepository.findById(farmId);
                if (farmOpt.isPresent()) {
                    farmName = farmOpt.get().getName();
                    farmLocation = farmOpt.get().getAddress() != null ? farmOpt.get().getAddress() : "Việt Nam";
                }

                // Calculate total area of all fields
                java.math.BigDecimal sumArea = fieldRepository.sumAreaByFarmId(farmId);
                if (sumArea != null) {
                    totalArea = sumArea;
                }

                // Find oldest field date
                Field oldestField = fieldRepository.findFirstByFarmIdOrderByCreatedAtAsc(farmId);
                if (oldestField != null) {
                    firstFieldDate = oldestField.getCreatedAt();
                }
            }

            CropDefinition crop = field.getCurrentCrop();
            String cropName = crop != null ? crop.getName() : "Nông sản";

            List<FarmingActivity> activities = activityRepository.findByFieldIdOrderByPerformedAtDesc(fieldId);

            Map<String, Object> result = new HashMap<>();
            // Flat structure for frontend
            result.put("fieldName", farmName); // Traceability header uses this as subtitle
            result.put("areaSqm", totalArea); // Total Farm Area
            result.put("location", farmLocation);

            result.put("cropName", cropName);
            // Use oldest field creation date as "Start Date" for the farm profile view
            result.put("plantingDate",
                    firstFieldDate != null ? firstFieldDate.toLocalDate() : java.time.LocalDate.now());
            result.put("expectedHarvestDate", field.getExpectedHarvestDate());

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
                // Add explicit field name
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
