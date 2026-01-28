package com.agriplanner.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "inventory_transactions")
public class InventoryTransaction {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "inventory_id")
    private Long inventoryId;

    @Column(name = "transaction_type", nullable = false, length = 20)
    private String transactionType; // PURCHASE, USE, SELL, TRANSFER, EXPIRE, ADJUSTMENT

    @Column(nullable = false, precision = 15, scale = 3)
    private BigDecimal quantity;

    @Column(name = "unit_price", precision = 15, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "total_amount", precision = 15, scale = 2)
    private BigDecimal totalAmount;

    @Column(name = "reference_type", length = 50)
    private String referenceType; // FEEDING, CULTIVATION, HARVEST, etc.

    @Column(name = "reference_id")
    private Long referenceId;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    // Constructors
    public InventoryTransaction() {}

    public InventoryTransaction(Long userId, String transactionType, BigDecimal quantity) {
        this.userId = userId;
        this.transactionType = transactionType;
        this.quantity = quantity;
    }

    // Static factory methods
    public static InventoryTransaction createPurchase(Long userId, Long inventoryId, BigDecimal quantity, BigDecimal unitPrice, String notes) {
        InventoryTransaction tx = new InventoryTransaction();
        tx.setUserId(userId);
        tx.setInventoryId(inventoryId);
        tx.setTransactionType("PURCHASE");
        tx.setQuantity(quantity);
        tx.setUnitPrice(unitPrice);
        tx.setTotalAmount(quantity.multiply(unitPrice));
        tx.setNotes(notes);
        return tx;
    }

    public static InventoryTransaction createUsage(Long userId, Long inventoryId, BigDecimal quantity, String referenceType, Long referenceId, String notes) {
        InventoryTransaction tx = new InventoryTransaction();
        tx.setUserId(userId);
        tx.setInventoryId(inventoryId);
        tx.setTransactionType("USE");
        tx.setQuantity(quantity.negate()); // Negative for usage
        tx.setReferenceType(referenceType);
        tx.setReferenceId(referenceId);
        tx.setNotes(notes);
        return tx;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public Long getInventoryId() { return inventoryId; }
    public void setInventoryId(Long inventoryId) { this.inventoryId = inventoryId; }

    public String getTransactionType() { return transactionType; }
    public void setTransactionType(String transactionType) { this.transactionType = transactionType; }

    public BigDecimal getQuantity() { return quantity; }
    public void setQuantity(BigDecimal quantity) { this.quantity = quantity; }

    public BigDecimal getUnitPrice() { return unitPrice; }
    public void setUnitPrice(BigDecimal unitPrice) { this.unitPrice = unitPrice; }

    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }

    public String getReferenceType() { return referenceType; }
    public void setReferenceType(String referenceType) { this.referenceType = referenceType; }

    public Long getReferenceId() { return referenceId; }
    public void setReferenceId(Long referenceId) { this.referenceId = referenceId; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
