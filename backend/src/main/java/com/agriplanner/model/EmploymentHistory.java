package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;


import java.time.LocalDateTime;

/**
 * Tracks employment history of workers at farms.
 * Used to identify former workers when they re-apply.
 */
@Entity
@Table(name = "employment_history")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmploymentHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "worker_id")
    private Long workerId;

    @Column(name = "farm_id")
    private Long farmId;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    @Column(length = 100)
    @Builder.Default
    private String reason = "DISMISSED";
}
