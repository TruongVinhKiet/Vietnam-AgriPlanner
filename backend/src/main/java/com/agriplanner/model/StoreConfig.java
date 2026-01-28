package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.ZonedDateTime;

@Entity
@Table(name = "store_config")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StoreConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "store_name")
    @Builder.Default
    private String storeName = "AgriPlanner Store";

    @Column(columnDefinition = "TEXT")
    @Builder.Default
    private String address = "165C Linh Trung, Thủ Đức, TP.HCM";

    @Column(precision = 10, scale = 8)
    @Builder.Default
    private BigDecimal latitude = new BigDecimal("10.8700");

    @Column(precision = 11, scale = 8)
    @Builder.Default
    private BigDecimal longitude = new BigDecimal("106.8000");

    private String phone;

    private String email;

    @Column(name = "created_at")
    @Builder.Default
    private ZonedDateTime createdAt = ZonedDateTime.now();

    @Column(name = "updated_at")
    @Builder.Default
    private ZonedDateTime updatedAt = ZonedDateTime.now();
}
