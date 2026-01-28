package com.agriplanner.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "salary_settings",
        uniqueConstraints = @UniqueConstraint(columnNames = { "farm_id", "worker_id" })
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SalarySetting {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "farm_id", nullable = false)
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
    private Farm farm;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler", "passwordHash" })
    private User owner;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "worker_id", nullable = false)
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler", "passwordHash" })
    private User worker;

    @Column(name = "salary_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal salaryAmount;

    @Column(name = "pay_day_of_month", nullable = false)
    private Integer payDayOfMonth;

    @Column(name = "is_active")
    private Boolean isActive;

    @Column(name = "last_paid_at")
    private LocalDateTime lastPaidAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (salaryAmount == null) {
            salaryAmount = BigDecimal.ZERO;
        }
        if (payDayOfMonth == null) {
            payDayOfMonth = 1;
        }
        if (isActive == null) {
            isActive = true;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
