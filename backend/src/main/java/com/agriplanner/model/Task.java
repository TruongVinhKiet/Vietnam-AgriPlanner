package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "tasks")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "farm_id", nullable = false)
    private Farm farm;

    @ManyToOne
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @ManyToOne
    @JoinColumn(name = "worker_id")
    private User worker;

    @ManyToOne
    @JoinColumn(name = "field_id")
    private Field field;

    @ManyToOne
    @JoinColumn(name = "pen_id")
    private Pen pen;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 50)
    @Builder.Default
    private String status = "PENDING"; // PENDING, IN_PROGRESS, COMPLETED, APPROVED, CANCELLED

    @Column(length = 20)
    @Builder.Default
    private String priority = "NORMAL"; // LOW, NORMAL, HIGH

    // Smart Logic Columns
    @Enumerated(EnumType.STRING)
    @Column(name = "task_type")
    private TaskType taskType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "related_item_id")
    private ShopItem relatedItem;

    @Column(name = "quantity_required")
    private BigDecimal quantityRequired;

    @Column(name = "is_auto_created")
    @Builder.Default
    private Boolean isAutoCreated = false;

    @Column(name = "salary")
    private BigDecimal salary;

    @Column(name = "due_date")
    private LocalDateTime dueDate;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;
}
