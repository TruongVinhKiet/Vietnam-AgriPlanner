package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.ZonedDateTime;

@Entity
@Table(name = "loyalty_transactions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoyaltyTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "order_id")
    private Long orderId;

    @Column(nullable = false)
    private Integer points;

    @Column(nullable = false)
    private String type; // EARN, SPEND, REFUND

    private String description;

    @Column(name = "balance_after", nullable = false)
    private Integer balanceAfter;

    @Column(name = "created_at")
    @Builder.Default
    private ZonedDateTime createdAt = ZonedDateTime.now();
}
