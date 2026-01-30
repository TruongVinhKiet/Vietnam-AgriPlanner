package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

/**
 * Entity for individual zone items within a snapshot
 */
@Entity
@Table(name = "zone_snapshot_items")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ZoneSnapshotItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "snapshot_id", nullable = false)
    private ZoneSnapshot snapshot;

    @Column(name = "original_zone_id")
    private Long originalZoneId;

    @Column(name = "zone_data", columnDefinition = "TEXT", nullable = false)
    private String zoneData; // JSON string of zone

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
