package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

/**
 * Animal Feed Compatibility Entity - Links animals to compatible feeds
 */
@Entity
@Table(name = "animal_feed_compatibility")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AnimalFeedCompatibility {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "animal_definition_id", nullable = false)
    private Long animalDefinitionId;

    @Column(name = "feed_definition_id", nullable = false)
    private Long feedDefinitionId;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "animal_definition_id", insertable = false, updatable = false)
    private AnimalDefinition animalDefinition;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "feed_definition_id", insertable = false, updatable = false)
    private FeedDefinition feedDefinition;

    @Column(name = "is_primary")
    @Builder.Default
    private Boolean isPrimary = false;

    @Column(name = "daily_amount_per_unit", nullable = false)
    private BigDecimal dailyAmountPerUnit; // kg per animal per day

    @Column(name = "feeding_frequency")
    @Builder.Default
    private Integer feedingFrequency = 2; // times per day

    @Column(columnDefinition = "TEXT")
    private String notes;
}
