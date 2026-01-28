package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "feeding_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FeedingLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "pen_id", nullable = false)
    private Long penId;

    @Column(name = "feed_item_id")
    private Long feedItemId;

    @Column(name = "feed_definition_id")
    private Long feedDefinitionId;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "feed_definition_id", insertable = false, updatable = false)
    private FeedDefinition feedDefinition;

    @Column(name = "amount_kg", nullable = false)
    private BigDecimal amountKg;

    @Column(name = "cost")
    private BigDecimal cost;

    @Column(name = "fed_at")
    private LocalDateTime fedAt;

    @Column(columnDefinition = "TEXT")
    private String notes;
}
