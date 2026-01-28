package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.ZonedDateTime;

@Entity
@Table(name = "user_addresses")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserAddress {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    
    @Column(name = "full_address", nullable = false)
    private String fullAddress;
    
    private BigDecimal latitude;
    
    private BigDecimal longitude;
    
    @Column(name = "is_default")
    @Builder.Default
    private Boolean isDefault = false;
    
    private String label;
    
    @Column(name = "receiver_name")
    private String receiverName;
    
    @Column(name = "receiver_phone")
    private String receiverPhone;
    
    @Column(name = "created_at")
    @Builder.Default
    private ZonedDateTime createdAt = ZonedDateTime.now();
    
    @Column(name = "updated_at")
    @Builder.Default
    private ZonedDateTime updatedAt = ZonedDateTime.now();
}
