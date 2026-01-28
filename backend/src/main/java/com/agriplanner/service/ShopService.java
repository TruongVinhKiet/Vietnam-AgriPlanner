package com.agriplanner.service;

import com.agriplanner.model.*;
import com.agriplanner.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

@Service
@SuppressWarnings("null")
public class ShopService {
    private static final Logger log = LoggerFactory.getLogger(ShopService.class);

    @Autowired
    private ShopItemRepository shopItemRepository;

    @Autowired
    private UserInventoryRepository userInventoryRepository;

    @Autowired
    private InventoryTransactionRepository inventoryTransactionRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AssetTransactionRepository assetTransactionRepository;

    @Autowired
    private PurchaseHistoryRepository purchaseHistoryRepository;

    // ==================== SHOP ITEMS ====================

    public List<ShopItem> getAllActiveItems() {
        return shopItemRepository.findByIsActiveTrueOrderByIsFeaturedDescSoldCountDesc();
    }

    public List<ShopItem> getItemsByCategory(String category) {
        return shopItemRepository.findByCategoryOrderByPopularity(category);
    }

    public List<ShopItem> getFeaturedItems() {
        return shopItemRepository.findByIsFeaturedTrueAndIsActiveTrue();
    }

    public List<ShopItem> searchItems(String keyword) {
        return shopItemRepository.searchByKeyword(keyword);
    }

    public List<String> getAllCategories() {
        return shopItemRepository.findAllActiveCategories();
    }

    public Optional<ShopItem> getItemById(Long id) {
        if (id == null) return Optional.empty();
        return shopItemRepository.findById(id);
    }

    // ==================== PURCHASE ====================

    @Transactional
    public Map<String, Object> purchaseItem(Long userId, Long shopItemId, BigDecimal quantity) {
        Map<String, Object> result = new HashMap<>();

        // Validate inputs
        if (userId == null || shopItemId == null || quantity == null) {
            result.put("success", false);
            result.put("error", "Thông tin không hợp lệ");
            return result;
        }

        // Validate user
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            result.put("success", false);
            result.put("error", "Không tìm thấy người dùng");
            return result;
        }
        User user = userOpt.get();

        // Validate shop item
        Optional<ShopItem> itemOpt = shopItemRepository.findById(shopItemId);
        if (itemOpt.isEmpty()) {
            result.put("success", false);
            result.put("error", "Không tìm thấy sản phẩm");
            return result;
        }
        ShopItem item = itemOpt.get();

        if (!item.getIsActive()) {
            result.put("success", false);
            result.put("error", "Sản phẩm không còn bán");
            return result;
        }

        // Check stock
        if (item.getStockQuantity() != null && item.getStockQuantity() != -1) {
            if (item.getStockQuantity() < quantity.intValue()) {
                result.put("success", false);
                result.put("error", "Không đủ hàng trong kho. Còn lại: " + item.getStockQuantity());
                return result;
            }
        }

        // Calculate total cost
        BigDecimal totalCost = item.getFinalPrice().multiply(quantity);

        // Check user balance
        BigDecimal currentBalance = user.getBalance() != null ? user.getBalance() : BigDecimal.ZERO;
        if (currentBalance.compareTo(totalCost) < 0) {
            result.put("success", false);
            result.put("error", "Số dư không đủ. Cần: " + totalCost + ", Hiện có: " + currentBalance);
            return result;
        }

        // Deduct balance
        user.setBalance(currentBalance.subtract(totalCost));
        userRepository.save(user);

        // Update stock (if limited)
        if (item.getStockQuantity() != null && item.getStockQuantity() != -1) {
            item.setStockQuantity(item.getStockQuantity() - quantity.intValue());
        }
        item.setSoldCount(item.getSoldCount() + quantity.intValue());
        item.setUpdatedAt(LocalDateTime.now());
        shopItemRepository.save(item);

        // Add to user inventory
        Optional<UserInventory> existingInv = userInventoryRepository.findByUserIdAndShopItemId(userId, shopItemId);
        UserInventory inventory;
        if (existingInv.isPresent()) {
            inventory = existingInv.get();
            inventory.addQuantity(quantity);
        } else {
            inventory = new UserInventory(userId, item, quantity);
        }
        userInventoryRepository.save(inventory);

        // Log inventory transaction
        Long inventoryId = inventory.getId();
        if (inventoryId != null) {
            InventoryTransaction invTx = InventoryTransaction.createPurchase(
                userId, inventoryId, quantity, item.getFinalPrice(),
                "Mua " + item.getName() + " x" + quantity
            );
            inventoryTransactionRepository.save(invTx);
        }

        // Log asset transaction
        AssetTransaction assetTx = new AssetTransaction();
        assetTx.setUserId(userId);
        assetTx.setAmount(totalCost.negate());
        assetTx.setTransactionType("EXPENSE");
        assetTx.setCategory("SHOP_PURCHASE");
        assetTx.setDescription("Mua " + item.getName() + " (" + quantity + " " + item.getUnit() + ")");
        // createdAt is set automatically by @PrePersist
        assetTransactionRepository.save(assetTx);

        // Save purchase history (for review system)
        PurchaseHistory purchaseHistory = PurchaseHistory.builder()
                .user(user)
                .shopItem(item)
                .quantity(quantity.intValue())
                .unitPrice(item.getFinalPrice())
                .totalPrice(totalCost)
                .build();
        purchaseHistoryRepository.save(purchaseHistory);

        log.info("[SHOP] User {} purchased {} x{} for {} VND. New balance: {}",
                user.getEmail(), item.getName(), quantity, totalCost, user.getBalance());

        result.put("success", true);
        result.put("message", "Mua hàng thành công!");
        result.put("totalCost", totalCost);
        result.put("newBalance", user.getBalance());
        result.put("item", item);
        result.put("quantityPurchased", quantity);
        return result;
    }

    // ==================== USER INVENTORY ====================

    public List<UserInventory> getUserInventory(Long userId) {
        return userInventoryRepository.findByUserIdWithStock(userId);
    }

    public List<UserInventory> getUserInventoryByCategory(Long userId, String category) {
        return userInventoryRepository.findByUserIdAndCategory(userId, category);
    }

    public Map<String, Object> getInventorySummary(Long userId) {
        Map<String, Object> summary = new HashMap<>();
        
        List<UserInventory> items = getUserInventory(userId);
        BigDecimal totalValue = userInventoryRepository.calculateTotalInventoryValue(userId);
        int totalItems = userInventoryRepository.countItemsByUserId(userId);
        int totalCategories = userInventoryRepository.countCategoriesByUserId(userId);

        // Group by category
        Map<String, List<UserInventory>> byCategory = new LinkedHashMap<>();
        for (UserInventory inv : items) {
            String cat = inv.getEffectiveCategory();
            byCategory.computeIfAbsent(cat, k -> new ArrayList<>()).add(inv);
        }

        summary.put("items", items);
        summary.put("byCategory", byCategory);
        summary.put("totalValue", totalValue != null ? totalValue : BigDecimal.ZERO);
        summary.put("totalItems", totalItems);
        summary.put("totalCategories", totalCategories);

        return summary;
    }

    // ==================== USE FROM INVENTORY ====================

    /**
     * Use item from inventory. Returns amount actually used from inventory.
     * If inventory is insufficient, returns what's available (can be 0).
     */
    @Transactional
    public BigDecimal useFromInventory(Long userId, Long shopItemId, BigDecimal amountNeeded, 
                                       String referenceType, Long referenceId, String notes) {
        Optional<UserInventory> invOpt = userInventoryRepository.findByUserIdAndShopItemId(userId, shopItemId);
        
        if (invOpt.isEmpty() || invOpt.get().getQuantity().compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }

        UserInventory inventory = invOpt.get();
        BigDecimal available = inventory.getQuantity();
        BigDecimal toUse = available.min(amountNeeded);

        inventory.subtractQuantity(toUse);
        userInventoryRepository.save(inventory);

        // Log transaction
        Long inventoryId = inventory.getId();
        if (inventoryId != null) {
            InventoryTransaction tx = InventoryTransaction.createUsage(
                userId, inventoryId, toUse, referenceType, referenceId, notes
            );
            inventoryTransactionRepository.save(tx);
        }

        log.info("[INVENTORY] User {} used {} {} from inventory for {}",
                userId, toUse, inventory.getEffectiveUnit(), referenceType);

        return toUse;
    }

    /**
     * Use feed from inventory by feed definition ID
     */
    @Transactional
    public BigDecimal useFeedFromInventory(Long userId, Long feedDefinitionId, BigDecimal amountNeeded,
                                           Long penId, String notes) {
        // Find shop item by feed definition
        Optional<ShopItem> shopItemOpt = shopItemRepository.findByFeedDefinitionId(feedDefinitionId);
        if (shopItemOpt.isEmpty()) {
            return BigDecimal.ZERO;
        }

        return useFromInventory(userId, shopItemOpt.get().getId(), amountNeeded, "FEEDING", penId, notes);
    }

    /**
     * Check inventory availability
     */
    public BigDecimal checkInventoryStock(Long userId, Long shopItemId) {
        Optional<UserInventory> invOpt = userInventoryRepository.findByUserIdAndShopItemId(userId, shopItemId);
        if (invOpt.isEmpty()) {
            return BigDecimal.ZERO;
        }
        return invOpt.get().getQuantity();
    }

    /**
     * Check feed stock by feed definition
     */
    public BigDecimal checkFeedStock(Long userId, Long feedDefinitionId) {
        Optional<UserInventory> invOpt = userInventoryRepository.findByUserIdAndFeedDefinitionId(userId, feedDefinitionId);
        if (invOpt.isEmpty()) {
            return BigDecimal.ZERO;
        }
        return invOpt.get().getQuantity();
    }

    // ==================== TRANSACTIONS HISTORY ====================

    public List<InventoryTransaction> getInventoryTransactions(Long userId) {
        return inventoryTransactionRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public List<InventoryTransaction> getRecentTransactions(Long userId, int days) {
        LocalDateTime since = LocalDateTime.now().minusDays(days);
        return inventoryTransactionRepository.findRecentByUserId(userId, since);
    }
}
