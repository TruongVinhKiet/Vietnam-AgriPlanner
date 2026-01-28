package com.agriplanner.controller;

import com.agriplanner.model.*;
import com.agriplanner.repository.UserRepository;
import com.agriplanner.service.ShopService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.*;

@RestController
@RequestMapping("/api/shop")
@CrossOrigin(origins = "*")
public class ShopController {
    private static final Logger log = LoggerFactory.getLogger(ShopController.class);

    @Autowired
    private ShopService shopService;

    @Autowired
    private UserRepository userRepository;

    // ==================== SHOP ITEMS ====================

    /**
     * Get all active shop items
     */
    @GetMapping("/items")
    public ResponseEntity<List<ShopItem>> getAllItems() {
        return ResponseEntity.ok(shopService.getAllActiveItems());
    }

    /**
     * Get items by category
     */
    @GetMapping("/items/category/{category}")
    public ResponseEntity<List<ShopItem>> getItemsByCategory(@PathVariable String category) {
        return ResponseEntity.ok(shopService.getItemsByCategory(category));
    }

    /**
     * Get featured items
     */
    @GetMapping("/items/featured")
    public ResponseEntity<List<ShopItem>> getFeaturedItems() {
        return ResponseEntity.ok(shopService.getFeaturedItems());
    }

    /**
     * Search items
     */
    @GetMapping("/items/search")
    public ResponseEntity<List<ShopItem>> searchItems(@RequestParam String q) {
        return ResponseEntity.ok(shopService.searchItems(q));
    }

    /**
     * Get all categories
     */
    @GetMapping("/categories")
    public ResponseEntity<List<String>> getCategories() {
        return ResponseEntity.ok(shopService.getAllCategories());
    }

    /**
     * Get single item
     */
    @GetMapping("/items/{id}")
    public ResponseEntity<?> getItem(@PathVariable Long id) {
        Optional<ShopItem> item = shopService.getItemById(id);
        if (item.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(item.get());
    }

    // ==================== PURCHASE ====================

    /**
     * Purchase item
     */
    @PostMapping("/purchase")
    public ResponseEntity<Map<String, Object>> purchaseItem(@RequestBody Map<String, Object> request) {
        try {
            Long shopItemId = Long.valueOf(request.get("shopItemId").toString());
            BigDecimal quantity = new BigDecimal(request.get("quantity").toString());
            
            // Get user - try from userEmail first
            Long userId = null;
            if (request.containsKey("userEmail")) {
                String email = request.get("userEmail").toString();
                Optional<User> user = userRepository.findByEmail(email);
                if (user.isPresent()) {
                    userId = user.get().getId();
                }
            }
            
            if (userId == null && request.containsKey("userId")) {
                userId = Long.valueOf(request.get("userId").toString());
            }

            if (userId == null) {
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("error", "Không xác định được người dùng");
                return ResponseEntity.badRequest().body(error);
            }

            Map<String, Object> result = shopService.purchaseItem(userId, shopItemId, quantity);
            
            if ((Boolean) result.get("success")) {
                return ResponseEntity.ok(result);
            } else {
                return ResponseEntity.badRequest().body(result);
            }
        } catch (Exception e) {
            log.error("Purchase error", e);
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", "Lỗi: " + e.getMessage());
            return ResponseEntity.internalServerError().body(error);
        }
    }

    // ==================== USER INVENTORY ====================

    /**
     * Get user's inventory
     */
    @GetMapping("/inventory")
    public ResponseEntity<?> getUserInventory(@RequestParam(required = false) String userEmail,
                                               @RequestParam(required = false) Long userId) {
        try {
            Long uid = resolveUserId(userEmail, userId);
            if (uid == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "User not found"));
            }
            
            return ResponseEntity.ok(shopService.getInventorySummary(uid));
        } catch (Exception e) {
            log.error("Get inventory error", e);
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Get inventory by category
     */
    @GetMapping("/inventory/category/{category}")
    public ResponseEntity<?> getInventoryByCategory(
            @PathVariable String category,
            @RequestParam(required = false) String userEmail,
            @RequestParam(required = false) Long userId) {
        try {
            Long uid = resolveUserId(userEmail, userId);
            if (uid == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "User not found"));
            }
            
            return ResponseEntity.ok(shopService.getUserInventoryByCategory(uid, category));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Check stock availability
     */
    @GetMapping("/inventory/check")
    public ResponseEntity<?> checkStock(
            @RequestParam Long shopItemId,
            @RequestParam(required = false) String userEmail,
            @RequestParam(required = false) Long userId) {
        try {
            Long uid = resolveUserId(userEmail, userId);
            if (uid == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "User not found"));
            }
            
            BigDecimal stock = shopService.checkInventoryStock(uid, shopItemId);
            return ResponseEntity.ok(Map.of("shopItemId", shopItemId, "stock", stock));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Check feed stock by feed definition ID
     */
    @GetMapping("/inventory/feed/{feedDefinitionId}")
    public ResponseEntity<?> checkFeedStock(
            @PathVariable Long feedDefinitionId,
            @RequestParam(required = false) String userEmail,
            @RequestParam(required = false) Long userId) {
        try {
            Long uid = resolveUserId(userEmail, userId);
            if (uid == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "User not found"));
            }
            
            BigDecimal stock = shopService.checkFeedStock(uid, feedDefinitionId);
            return ResponseEntity.ok(Map.of("feedDefinitionId", feedDefinitionId, "stock", stock));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== TRANSACTIONS ====================

    /**
     * Get inventory transaction history
     */
    @GetMapping("/inventory/transactions")
    public ResponseEntity<?> getTransactions(
            @RequestParam(required = false) String userEmail,
            @RequestParam(required = false) Long userId,
            @RequestParam(defaultValue = "30") int days) {
        try {
            Long uid = resolveUserId(userEmail, userId);
            if (uid == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "User not found"));
            }
            
            return ResponseEntity.ok(shopService.getRecentTransactions(uid, days));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== HELPER ====================

    private Long resolveUserId(String email, Long userId) {
        if (email != null && !email.isEmpty()) {
            Optional<User> user = userRepository.findByEmail(email);
            if (user.isPresent()) {
                return user.get().getId();
            }
        }
        return userId;
    }
}
