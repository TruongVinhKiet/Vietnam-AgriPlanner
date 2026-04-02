package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "contracts")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Contract {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_application_id", nullable = false)
    private JobApplication jobApplication;

    @Column(name = "contract_content", columnDefinition = "TEXT")
    private String contractContent;

    @Column(name = "owner_signature", columnDefinition = "TEXT")
    private String ownerSignature;

    @Column(name = "worker_signature", columnDefinition = "TEXT")
    private String workerSignature;

    @Column(name = "owner_signed_at")
    private LocalDateTime ownerSignedAt;

    @Column(name = "worker_signed_at")
    private LocalDateTime workerSignedAt;

    @Column(length = 50)
    @Builder.Default
    private String status = "DRAFT"; // DRAFT, PENDING_WORKER_SIGN, COMPLETED, CANCELED

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
