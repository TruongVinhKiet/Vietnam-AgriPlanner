package com.agriplanner.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "shop_items")
@JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
public class ShopItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(nullable = false, length = 50)
    private String category;

    @Column(name = "sub_category", length = 50)
    private String subCategory;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 30)
    private String unit = "kg";

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal price;

    @Column(name = "original_price", precision = 15, scale = 2)
    private BigDecimal originalPrice;

    @Column(name = "discount_percent")
    private Integer discountPercent = 0;

    @Column(name = "image_url", columnDefinition = "TEXT")
    private String imageUrl;

    @Column(name = "icon_name", length = 50)
    private String iconName;

    @Column(name = "stock_quantity")
    private Integer stockQuantity = -1;

    @Column(name = "min_purchase")
    private Integer minPurchase = 1;

    @Column(name = "max_purchase")
    private Integer maxPurchase = 9999;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "is_featured")
    private Boolean isFeatured = false;

    @Column(precision = 3, scale = 2)
    private BigDecimal rating = new BigDecimal("5.0");

    @Column(name = "sold_count")
    private Integer soldCount = 0;

    @Column(name = "crop_definition_id")
    private Long cropDefinitionId;

    @Column(name = "feed_definition_id")
    private Long feedDefinitionId;

    @Column(name = "weight_kg", precision = 10, scale = 2)
    private BigDecimal weightKg = BigDecimal.ONE;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();

    // Constructors
    public ShopItem() {
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getSubCategory() {
        return subCategory;
    }

    public void setSubCategory(String subCategory) {
        this.subCategory = subCategory;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
    }

    public BigDecimal getOriginalPrice() {
        return originalPrice;
    }

    public void setOriginalPrice(BigDecimal originalPrice) {
        this.originalPrice = originalPrice;
    }

    public Integer getDiscountPercent() {
        return discountPercent;
    }

    public void setDiscountPercent(Integer discountPercent) {
        this.discountPercent = discountPercent;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public String getIconName() {
        return iconName;
    }

    public void setIconName(String iconName) {
        this.iconName = iconName;
    }

    public Integer getStockQuantity() {
        return stockQuantity;
    }

    public void setStockQuantity(Integer stockQuantity) {
        this.stockQuantity = stockQuantity;
    }

    public Integer getMinPurchase() {
        return minPurchase;
    }

    public void setMinPurchase(Integer minPurchase) {
        this.minPurchase = minPurchase;
    }

    public Integer getMaxPurchase() {
        return maxPurchase;
    }

    public void setMaxPurchase(Integer maxPurchase) {
        this.maxPurchase = maxPurchase;
    }

    public Boolean getIsActive() {
        return isActive;
    }

    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }

    public Boolean getIsFeatured() {
        return isFeatured;
    }

    public void setIsFeatured(Boolean isFeatured) {
        this.isFeatured = isFeatured;
    }

    public BigDecimal getRating() {
        return rating;
    }

    public void setRating(BigDecimal rating) {
        this.rating = rating;
    }

    public Integer getSoldCount() {
        return soldCount;
    }

    public void setSoldCount(Integer soldCount) {
        this.soldCount = soldCount;
    }

    public Long getCropDefinitionId() {
        return cropDefinitionId;
    }

    public void setCropDefinitionId(Long cropDefinitionId) {
        this.cropDefinitionId = cropDefinitionId;
    }

    public Long getFeedDefinitionId() {
        return feedDefinitionId;
    }

    public void setFeedDefinitionId(Long feedDefinitionId) {
        this.feedDefinitionId = feedDefinitionId;
    }

    public BigDecimal getWeightKg() {
        return weightKg;
    }

    public void setWeightKg(BigDecimal weightKg) {
        this.weightKg = weightKg;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    // Helper method for stock status
    public String getStockStatus() {
        if (stockQuantity == null || stockQuantity == -1)
            return "unlimited";
        if (stockQuantity > 100)
            return "in_stock";
        if (stockQuantity > 0)
            return "low_stock";
        return "out_of_stock";
    }

    // Calculate final price with discount
    public BigDecimal getFinalPrice() {
        if (discountPercent != null && discountPercent > 0) {
            return price.multiply(BigDecimal.valueOf(100 - discountPercent))
                    .divide(BigDecimal.valueOf(100));
        }
        return price;
    }
}
