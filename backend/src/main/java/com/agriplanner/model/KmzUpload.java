package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

/**
 * Entity for tracking KMZ file uploads
 * Lưu lịch sử upload file KMZ quy hoạch
 */
@Entity
@Table(name = "kmz_uploads")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class KmzUpload {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String filename;

    @Column(name = "original_name")
    private String originalName;

    private String province;

    private String district;

    @Column(name = "zones_count")
    private Integer zonesCount = 0;

    @Column(name = "file_size_bytes")
    private Long fileSizeBytes;

    @Column(name = "uploaded_by")
    private Long uploadedBy;

    @Column(name = "uploaded_at")
    private LocalDateTime uploadedAt = LocalDateTime.now();

    @Column(name = "processed_at")
    private LocalDateTime processedAt;

    @Column(length = 50)
    private String status = "PROCESSING";

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(columnDefinition = "TEXT")
    private String notes;

    // Map type: 'planning' for land use planning, 'soil' for soil type map
    @Column(name = "map_type", length = 20)
    private String mapType = "planning";

    // Status constants
    public static final String STATUS_PROCESSING = "PROCESSING";
    public static final String STATUS_COMPLETED = "COMPLETED";
    public static final String STATUS_FAILED = "FAILED";

    @PrePersist
    protected void onCreate() {
        uploadedAt = LocalDateTime.now();
    }
}
