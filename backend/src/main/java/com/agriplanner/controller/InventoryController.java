package com.agriplanner.controller;

import com.agriplanner.model.InventoryItem;
import com.agriplanner.repository.InventoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.NonNull;
import java.util.List;

@RestController
@RequestMapping("/api/inventory")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class InventoryController {
    private final InventoryRepository inventoryRepository;

    @GetMapping
    public List<InventoryItem> getAllItems() {
        return inventoryRepository.findAll();
    }

    @PostMapping
    public InventoryItem createItem(@RequestBody @NonNull InventoryItem item) {
        return inventoryRepository.save(item);
    }

    @PutMapping("/{id}")
    public ResponseEntity<InventoryItem> updateItem(@PathVariable @NonNull Long id,
            @RequestBody InventoryItem itemDetails) {
        InventoryItem item = inventoryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Item not found"));

        item.setName(itemDetails.getName());
        item.setType(itemDetails.getType());
        item.setQuantity(itemDetails.getQuantity());
        item.setUnit(itemDetails.getUnit());
        item.setMinThreshold(itemDetails.getMinThreshold());
        item.setCostPerUnit(itemDetails.getCostPerUnit());

        return ResponseEntity.ok(inventoryRepository.save(item));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteItem(@PathVariable @NonNull Long id) {
        inventoryRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }

    /**
     * Add quantity to existing inventory item
     */
    @PostMapping("/{id}/add")
    public ResponseEntity<?> addQuantity(@PathVariable @NonNull Long id,
            @RequestBody java.util.Map<String, Object> request) {
        try {
            InventoryItem item = inventoryRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Item not found"));

            java.math.BigDecimal quantityToAdd = new java.math.BigDecimal(request.get("quantity").toString());
            item.setQuantity(item.getQuantity().add(quantityToAdd));

            return ResponseEntity.ok(inventoryRepository.save(item));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", e.getMessage()));
        }
    }

    /**
     * Deduct quantity from inventory item (used during farming actions)
     * Returns true if enough stock, false otherwise
     */
    @PostMapping("/{id}/deduct")
    public ResponseEntity<?> deductQuantity(@PathVariable @NonNull Long id,
            @RequestBody java.util.Map<String, Object> request) {
        try {
            InventoryItem item = inventoryRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Item not found"));

            java.math.BigDecimal quantityToDeduct = new java.math.BigDecimal(request.get("quantity").toString());

            if (item.getQuantity().compareTo(quantityToDeduct) < 0) {
                return ResponseEntity.badRequest().body(java.util.Map.of(
                        "error", "Không đủ hàng trong kho",
                        "available", item.getQuantity(),
                        "required", quantityToDeduct));
            }

            item.setQuantity(item.getQuantity().subtract(quantityToDeduct));
            inventoryRepository.save(item);

            return ResponseEntity.ok(java.util.Map.of("success", true, "remaining", item.getQuantity()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", e.getMessage()));
        }
    }

    /**
     * Check if inventory has enough of a specific type
     */
    @GetMapping("/check/{type}")
    public ResponseEntity<?> checkInventoryByType(@PathVariable String type,
            @RequestParam java.math.BigDecimal required) {
        List<InventoryItem> items = inventoryRepository.findByType(type);

        java.math.BigDecimal totalAvailable = items.stream()
                .map(InventoryItem::getQuantity)
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);

        return ResponseEntity.ok(java.util.Map.of(
                "hasEnough", totalAvailable.compareTo(required) >= 0,
                "available", totalAvailable,
                "required", required,
                "items", items));
    }
}
