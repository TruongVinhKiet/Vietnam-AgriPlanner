package com.agriplanner.controller;

import com.agriplanner.model.*;
import com.agriplanner.service.FieldService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * REST Controller for Field management
 */
@RestController
@RequestMapping("/api/fields")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class FieldController {

    private final FieldService fieldService;
    private final com.agriplanner.repository.InventoryRepository inventoryRepository;

    /**
     * Get all fields for a farm
     */
    @GetMapping
    public ResponseEntity<?> getFieldsByFarm(@RequestParam Long farmId) {
        try {
            List<Field> fields = fieldService.getFieldsByFarm(farmId);
            return ResponseEntity.ok(fields);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Get field by ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getFieldById(@PathVariable Long id) {
        return fieldService.getFieldById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Create a new field
     */
    @PostMapping
    public ResponseEntity<?> createField(@RequestBody Map<String, Object> request) {
        try {
            Long farmId = Long.valueOf(request.get("farmId").toString());
            String name = (String) request.get("name");
            String boundaryCoordinates = (String) request.get("boundaryCoordinates");
            java.math.BigDecimal areaSqm = new java.math.BigDecimal(request.get("areaSqm").toString());

            Field field = fieldService.createField(farmId, name, boundaryCoordinates, areaSqm);
            return ResponseEntity.ok(field);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Delete a field
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteField(@PathVariable Long id) {
        try {
            fieldService.deleteField(id);
            return ResponseEntity.ok(Map.of("message", "Field deleted successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Upload land certificate
     */
    @PostMapping("/{id}/certificate")
    public ResponseEntity<?> uploadCertificate(@PathVariable Long id, @RequestBody Map<String, String> request) {
        try {
            String base64Image = request.get("image");
            fieldService.uploadCertificate(id, base64Image);
            return ResponseEntity.ok(Map.of("message", "Certificate uploaded successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Log farming activity with Inventory Deduction
     */
    @PostMapping("/{id}/activities")
    public ResponseEntity<?> logActivity(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        try {
            String activityType = (String) request.get("activityType");
            String description = (String) request.get("description");
            BigDecimal quantity = request.get("quantity") != null ? new BigDecimal(request.get("quantity").toString())
                    : null;
            String unit = (String) request.get("unit");
            BigDecimal cost = request.get("cost") != null ? new BigDecimal(request.get("cost").toString()) : null;
            Long userId = request.get("userId") != null ? Long.valueOf(request.get("userId").toString()) : null;

            // 1. Inventory Deduction Logic
            // If quantity is provided and description likely references an item
            String warningMsg = null;

            if (quantity != null && quantity.compareTo(BigDecimal.ZERO) > 0 && description != null) {
                // Simplistic matching: Find item where name is contained in description
                // e.g Description: "Bón phân NPK" -> Find Item with name "NPK" or "Phân NPK"
                List<InventoryItem> items = inventoryRepository.findAll();
                InventoryItem matchedItem = items.stream()
                        .filter(item -> description.toLowerCase().contains(item.getName().toLowerCase()))
                        .findFirst()
                        .orElse(null);

                if (matchedItem != null) {
                    if (matchedItem.getQuantity().compareTo(quantity) < 0) {
                        return ResponseEntity.badRequest().body(Map.of("error",
                                "Không đủ hàng trong kho! " + matchedItem.getName() + " chỉ còn "
                                        + matchedItem.getQuantity() + " " + matchedItem.getUnit()));
                    }

                    // Deduct
                    matchedItem.setQuantity(matchedItem.getQuantity().subtract(quantity));
                    inventoryRepository.save(matchedItem);

                    // Check threshold
                    if (matchedItem.getMinThreshold() != null
                            && matchedItem.getQuantity().compareTo(matchedItem.getMinThreshold()) < 0) {
                        warningMsg = "Cảnh báo: " + matchedItem.getName() + " sắp hết (Còn " + matchedItem.getQuantity()
                                + matchedItem.getUnit() + ")";
                    }

                    // Auto-calculate cost if not provided
                    if (cost == null && matchedItem.getCostPerUnit() != null) {
                        cost = matchedItem.getCostPerUnit().multiply(quantity);
                    }
                }
            }

            FarmingActivity activity = fieldService.logActivity(id, activityType, description, quantity, unit, cost,
                    userId);

            // Return activity with optional warning
            if (warningMsg != null) {
                return ResponseEntity.ok(Map.of("activity", activity, "warning", warningMsg));
            }

            return ResponseEntity.ok(activity);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Get activities for field
     */
    @GetMapping("/{id}/activities")
    public ResponseEntity<List<FarmingActivity>> getActivities(@PathVariable Long id) {
        return ResponseEntity.ok(fieldService.getActivities(id));
    }

    /**
     * Fertilize field - Step 2 in workflow
     */
    @PostMapping("/{id}/fertilize")
    public ResponseEntity<?> fertilizeField(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        try {
            Long fertilizerId = Long.valueOf(request.get("fertilizerId").toString());
            BigDecimal cost = new BigDecimal(request.get("cost").toString());
            Field field = fieldService.fertilizeField(id, fertilizerId, cost);
            return ResponseEntity.ok(field);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Seed field - Step 3 in workflow
     */
    @PostMapping("/{id}/seed")
    public ResponseEntity<?> seedField(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        try {
            BigDecimal quantity = new BigDecimal(request.get("quantity").toString());
            BigDecimal cost = new BigDecimal(request.get("cost").toString());
            Field field = fieldService.seedField(id, quantity, cost);
            return ResponseEntity.ok(field);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Water field
     */
    @PostMapping("/{id}/water")
    public ResponseEntity<?> waterField(@PathVariable Long id) {
        try {
            Field field = fieldService.waterField(id);
            return ResponseEntity.ok(field);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Apply pesticide
     */
    @PostMapping("/{id}/pesticide")
    public ResponseEntity<?> applyPesticide(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        try {
            String pesticideName = (String) request.get("pesticideName");
            BigDecimal cost = new BigDecimal(request.get("cost").toString());
            Field field = fieldService.applyPesticide(id, pesticideName, cost);
            return ResponseEntity.ok(field);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Start harvest - initiates harvest with calculated duration
     */
    @PostMapping("/{id}/start-harvest")
    public ResponseEntity<?> startHarvest(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        try {
            Long machineryId = Long.valueOf(request.get("machineryId").toString());
            BigDecimal machineCost = new BigDecimal(request.get("machineCost").toString());
            Map<String, Object> result = fieldService.startHarvest(id, machineryId, machineCost);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Harvest field with machinery and revenue calculation - completes harvest
     */
    @PostMapping("/{id}/harvest-complete")
    public ResponseEntity<?> harvestComplete(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        try {
            Long machineryId = Long.valueOf(request.get("machineryId").toString());
            BigDecimal machineCost = new BigDecimal(request.get("machineCost").toString());
            Map<String, Object> result = fieldService.harvestComplete(id, machineryId, machineCost);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/condition")
    public ResponseEntity<?> updateFieldCondition(@PathVariable Long id, @RequestBody Map<String, String> request) {
        try {
            String condition = request.get("condition");
            Field field = fieldService.updateFieldCondition(id, condition);
            return ResponseEntity.ok(field);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Get field status with countdown timers
     */
    @GetMapping("/{id}/status")
    public ResponseEntity<?> getFieldStatus(@PathVariable Long id) {
        try {
            Map<String, Object> status = fieldService.getFieldStatus(id);
            return ResponseEntity.ok(status);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
