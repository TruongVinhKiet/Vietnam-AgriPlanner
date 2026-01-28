package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * Land Certificate Entity - Stores land ownership documents
 */
@Entity
@Table(name = "land_certificates")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LandCertificate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "field_id")
    private Long fieldId;

    @Column(name = "certificate_image", columnDefinition = "TEXT")
    private String certificateImage; // Base64 encoded image

    @Column(name = "upload_date")
    private LocalDateTime uploadDate;

    private Boolean verified;

    @Column(name = "verified_by")
    private Long verifiedBy;

    @Column(name = "verified_at")
    private LocalDateTime verifiedAt;

    private String notes;

    @PrePersist
    protected void onCreate() {
        uploadDate = LocalDateTime.now();
        verified = false;
    }
}
