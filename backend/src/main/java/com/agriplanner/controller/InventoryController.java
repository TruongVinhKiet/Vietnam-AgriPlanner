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

    private final com.agriplanner.repository.UserInventoryRepository userInventoryRepository;
    private final com.agriplanner.repository.UserRepository userRepository;
    private final com.agriplanner.service.AssetService assetService;
    private final com.agriplanner.repository.InventoryTransactionRepository inventoryTransactionRepository;

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

    // ==================== NEW HARVEST INVENTORY APIs ====================

    @GetMapping("/harvest-items")
    public ResponseEntity<?> getUserHarvestItems(@RequestParam Long userId) {
        try {
            List<com.agriplanner.model.UserInventory> allItems = userInventoryRepository.findByUserId(userId);
            List<com.agriplanner.model.UserInventory> harvestItems = allItems.stream()
                    .filter(item -> "THU_HOACH_CHAN_NUOI".equals(item.getItemCategory()) || 
                                   "THU_HOACH_TRONG_TROT".equals(item.getItemCategory()))
                    .filter(item -> item.getQuantity() != null && item.getQuantity().compareTo(java.math.BigDecimal.ZERO) > 0)
                    .toList();
            return ResponseEntity.ok(harvestItems);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/harvest-items/{id}/sell")
    public ResponseEntity<?> sellHarvestItem(@PathVariable Long id, @RequestBody java.util.Map<String, Object> request) {
        try {
            com.agriplanner.model.UserInventory item = userInventoryRepository.findById(java.util.Objects.requireNonNull(id))
                    .orElseThrow(() -> new RuntimeException("Item not found"));

            java.math.BigDecimal sellQuantity = new java.math.BigDecimal(request.get("quantity").toString());
            java.math.BigDecimal pricePerUnit = new java.math.BigDecimal(request.get("pricePerUnit").toString());
            String partnerName = request.getOrDefault("partnerName", "").toString();
            String notes = request.getOrDefault("notes", "").toString();

            if (item.getQuantity().compareTo(sellQuantity) < 0) {
                return ResponseEntity.badRequest().body(java.util.Map.of("error", "Số lượng bán vượt quá số lượng trong kho"));
            }

            java.math.BigDecimal totalRevenue = sellQuantity.multiply(pricePerUnit);

            // 1. Deduct inventory
            item.setQuantity(item.getQuantity().subtract(sellQuantity));
            if (item.getQuantity().compareTo(java.math.BigDecimal.ZERO) <= 0) {
                userInventoryRepository.delete(item);
            } else {
                userInventoryRepository.save(item);
            }

            // 2. Add revenue to user balance
            com.agriplanner.model.User user = userRepository.findById(java.util.Objects.requireNonNull(item.getUserId()))
                    .orElseThrow(() -> new RuntimeException("User not found"));
            java.math.BigDecimal currentBalance = user.getBalance() != null ? user.getBalance() : java.math.BigDecimal.ZERO;
            user.setBalance(currentBalance.add(totalRevenue));
            userRepository.save(user);

            // 3. Log asset transaction
            String category = "THU_HOACH_CHAN_NUOI".equals(item.getItemCategory()) ? "LIVESTOCK" : "CULTIVATION";
            String txNotes = "Bán sản phẩm: " + item.getItemName() + " (" + sellQuantity + " " + item.getItemUnit() + ")";
            if (partnerName != null && !partnerName.trim().isEmpty()) {
                txNotes += " cho đối tác " + partnerName.trim();
            }
            if (notes != null && !notes.trim().isEmpty()) {
                txNotes += " - Ghi chú: " + notes.trim();
            }
            assetService.addIncome(user.getId(), totalRevenue, category, txNotes, null);

            // 4. Log inventory transaction
            com.agriplanner.model.InventoryTransaction tx = new com.agriplanner.model.InventoryTransaction();
            tx.setUserId(user.getId());
            tx.setInventoryId(item.getId());
            tx.setTransactionType("SELL"); // new transaction type
            tx.setQuantity(sellQuantity.negate()); // OUT transaction
            tx.setUnitPrice(pricePerUnit);
            tx.setTotalAmount(totalRevenue);
            tx.setNotes(txNotes); // Use the same rich notes
            inventoryTransactionRepository.save(tx);

            return ResponseEntity.ok(java.util.Map.of(
                    "success", true,
                    "totalRevenue", totalRevenue,
                    "remainingQuantity", item.getQuantity(),
                    "newBalance", user.getBalance()
            ));

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", e.getMessage()));
        }
    }
}
