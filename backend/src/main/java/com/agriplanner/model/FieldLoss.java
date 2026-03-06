package com.agriplanner.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "field_losses")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class FieldLoss {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "field_id", nullable = false)
    private Long fieldId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "field_id", insertable = false, updatable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Field field;

    @Column(name = "task_id")
    private Long taskId;

    @Column(name = "loss_area_sqm", precision = 12, scale = 2)
    private BigDecimal lossAreaSqm;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "loss_polygon", columnDefinition = "jsonb")
    private String lossPolygon; // JSON array of [lat, lng] coordinates for the damage zone

    @Column(name = "cause", length = 100)
    private String cause; // DISEASE, WEATHER, PESTS, FLOOD, DROUGHT, OTHER

    @Column(name = "cause_detail")
    private String causeDetail; // Specific cause description

    @Column(name = "estimated_loss_value", precision = 15, scale = 2)
    private BigDecimal estimatedLossValue;

    @Column(name = "loss_percentage", precision = 5, scale = 2)
    private BigDecimal lossPercentage; // % of field area affected

    @Column(name = "report_date")
    private LocalDate reportDate;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "report_image_url", length = 500)
    private String reportImageUrl;

    @Column(name = "report_video_url", length = 500)
    private String reportVideoUrl;

    @Column(name = "reported_by")
    private Long reportedBy; // worker user ID

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
