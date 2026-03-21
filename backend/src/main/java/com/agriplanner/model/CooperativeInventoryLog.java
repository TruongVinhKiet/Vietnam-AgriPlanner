package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.ZonedDateTime;

@Entity
@Table(name = "cooperative_inventory_logs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CooperativeInventoryLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cooperative_id", nullable = false)
    private Cooperative cooperative;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inventory_id")
    private CooperativeInventory inventory;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LogAction action;

    @Column(name = "product_name")
    private String productName;

    @Column(precision = 15, scale = 2, nullable = false)
    private BigDecimal quantity;

    @Column(length = 30)
    private String unit;

    @Column(columnDefinition = "TEXT")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "performed_by")
    private User performedBy;

    @Column(name = "reference_type", length = 30)
    private String referenceType; // GROUP_BUY, GROUP_SELL, DISTRIBUTION

    @Column(name = "reference_id")
    private Long referenceId;

    @Column(name = "created_at")
    @Builder.Default
    private ZonedDateTime createdAt = ZonedDateTime.now();

    public enum LogAction {
        IMPORT,      // Nhập kho
        EXPORT,      // Xuất kho
        DISTRIBUTE   // Phân bổ cho thành viên
    }
}
