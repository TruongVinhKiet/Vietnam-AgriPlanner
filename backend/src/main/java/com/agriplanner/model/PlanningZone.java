package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Entity representing a planning zone (vùng quy hoạch đất đai)
 */
@Entity
@Table(name = "planning_zones")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PlanningZone {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(name = "boundary_coordinates", columnDefinition = "TEXT")
    private String boundaryCoordinates;

    @Column(name = "area_sqm", precision = 15, scale = 2)
    private BigDecimal areaSqm;

    @Column(name = "center_lat", precision = 10, scale = 7)
    private BigDecimal centerLat;

    @Column(name = "center_lng", precision = 10, scale = 7)
    private BigDecimal centerLng;

    @Column(name = "zone_type", nullable = false)
    private String zoneType;

    @Column(name = "zone_code", length = 20)
    private String zoneCode;

    @Column(name = "land_use_purpose")
    private String landUsePurpose;

    @Column(name = "planning_period", length = 50)
    private String planningPeriod;

    private String province;
    private String district;
    private String commune;

    private String source;

    @Column(name = "source_url", columnDefinition = "TEXT")
    private String sourceUrl;

    private Boolean verified = false;

    @Column(name = "verified_date")
    private LocalDateTime verifiedDate;

    @Column(name = "fill_color", length = 7)
    private String fillColor = "#ff6b6b";

    @Column(name = "stroke_color", length = 7)
    private String strokeColor = "#c92a2a";

    @Column(name = "fill_opacity", precision = 3, scale = 2)
    private BigDecimal fillOpacity = new BigDecimal("0.4");

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "kmz_upload_id")
    private Long kmzUploadId;

    // Store GeoJSON representation for frontend
    @Column(name = "geojson", columnDefinition = "TEXT")
    private String geojson;

    // Image overlay URL for GroundOverlay KMZ files
    @Column(name = "image_url", columnDefinition = "TEXT")
    private String imageUrl;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
