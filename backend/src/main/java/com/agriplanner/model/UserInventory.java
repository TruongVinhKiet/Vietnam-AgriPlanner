package com.agriplanner.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_inventory")
public class UserInventory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "shop_item_id")
    private ShopItem shopItem;

    @Column(name = "item_name", length = 150)
    private String itemName;

    @Column(name = "item_category", length = 50)
    private String itemCategory;

    @Column(name = "item_unit", length = 30)
    private String itemUnit;

    @Column(nullable = false, precision = 15, scale = 3)
    private BigDecimal quantity = BigDecimal.ZERO;

    @Column(name = "purchase_price", precision = 15, scale = 2)
    private BigDecimal purchasePrice;

    @Column(name = "expiry_date")
    private LocalDate expiryDate;

    @Column(name = "batch_number", length = 50)
    private String batchNumber;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();

    // Constructors
    public UserInventory() {}

    public UserInventory(Long userId, ShopItem shopItem, BigDecimal quantity) {
        this.userId = userId;
        this.shopItem = shopItem;
        this.quantity = quantity;
        this.purchasePrice = shopItem.getPrice();
    }

    // Helper methods
    public String getEffectiveName() {
        if (shopItem != null) return shopItem.getName();
        return itemName;
    }

    public String getEffectiveCategory() {
        if (shopItem != null) return shopItem.getCategory();
        return itemCategory;
    }

    public String getEffectiveUnit() {
        if (shopItem != null) return shopItem.getUnit();
        return itemUnit;
    }

    public BigDecimal getEffectivePrice() {
        if (shopItem != null) return shopItem.getPrice();
        return purchasePrice;
    }

    public String getImageUrl() {
        if (shopItem != null) return shopItem.getImageUrl();
        return null;
    }

    public String getIconName() {
        if (shopItem != null) return shopItem.getIconName();
        return "inventory_2";
    }

    public BigDecimal getTotalValue() {
        BigDecimal price = getEffectivePrice();
        if (price == null) return BigDecimal.ZERO;
        return quantity.multiply(price);
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public ShopItem getShopItem() { return shopItem; }
    public void setShopItem(ShopItem shopItem) { this.shopItem = shopItem; }

    public String getItemName() { return itemName; }
    public void setItemName(String itemName) { this.itemName = itemName; }

    public String getItemCategory() { return itemCategory; }
    public void setItemCategory(String itemCategory) { this.itemCategory = itemCategory; }

    public String getItemUnit() { return itemUnit; }
    public void setItemUnit(String itemUnit) { this.itemUnit = itemUnit; }

    public BigDecimal getQuantity() { return quantity; }
    public void setQuantity(BigDecimal quantity) { 
        this.quantity = quantity; 
        this.updatedAt = LocalDateTime.now();
    }

    public BigDecimal getPurchasePrice() { return purchasePrice; }
    public void setPurchasePrice(BigDecimal purchasePrice) { this.purchasePrice = purchasePrice; }

    public LocalDate getExpiryDate() { return expiryDate; }
    public void setExpiryDate(LocalDate expiryDate) { this.expiryDate = expiryDate; }

    public String getBatchNumber() { return batchNumber; }
    public void setBatchNumber(String batchNumber) { this.batchNumber = batchNumber; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    // Add quantity
    public void addQuantity(BigDecimal amount) {
        this.quantity = this.quantity.add(amount);
        this.updatedAt = LocalDateTime.now();
    }

    // Subtract quantity
    public boolean subtractQuantity(BigDecimal amount) {
        if (this.quantity.compareTo(amount) >= 0) {
            this.quantity = this.quantity.subtract(amount);
            this.updatedAt = LocalDateTime.now();
            return true;
        }
        return false;
    }
}
