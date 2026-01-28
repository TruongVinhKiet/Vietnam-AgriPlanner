package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.ZonedDateTime;

/**
 * Entity for cooperative dissolution requests submitted by leaders
 */
@Entity
@Table(name = "dissolution_requests")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DissolutionRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cooperative_id", nullable = false)
    private Cooperative cooperative;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by", nullable = false)
    private User requestedBy;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String reason;

    @Column(name = "contact_phone", length = 20)
    private String contactPhone;

    @Column(name = "contact_email", length = 150)
    private String contactEmail;

    @Enumerated(EnumType.STRING)
    @Column(length = 20, nullable = false)
    @Builder.Default
    private DissolutionStatus status = DissolutionStatus.PENDING;

    @Column(name = "created_at")
    @Builder.Default
    private ZonedDateTime createdAt = ZonedDateTime.now();

    @Column(name = "processed_at")
    private ZonedDateTime processedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "processed_by")
    private User processedBy;

    @Column(name = "admin_notes", columnDefinition = "TEXT")
    private String adminNotes;

    public enum DissolutionStatus {
        PENDING, // Waiting for admin review
        APPROVED, // Approved and cooperative dissolved
        REJECTED // Request rejected
    }
}
