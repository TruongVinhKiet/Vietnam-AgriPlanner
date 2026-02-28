package com.agriplanner.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * User entity representing system users
 * (Touched to force IDE re-indexing)
 */
@Entity
@Table(name = "users")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
public class User implements org.springframework.security.core.userdetails.UserDetails {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "full_name", length = 100)
    private String fullName;

    @Column(nullable = false, unique = true, length = 150)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(length = 20)
    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, columnDefinition = "user_role")
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Builder.Default
    private UserRole role = UserRole.OWNER;

    @Column(name = "dark_mode")
    @Builder.Default
    private Boolean darkMode = false;

    @Column(name = "subscription_id")
    private Integer subscriptionId;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    // Security Features
    @Column(name = "two_factor_enabled")
    @Builder.Default
    private Boolean twoFactorEnabled = false;

    @Column(name = "two_factor_secret")
    private String twoFactorSecret;

    @Column(name = "failed_login_attempts")
    @Builder.Default
    private Integer failedLoginAttempts = 0;

    @Column(name = "account_locked_until")
    private LocalDateTime accountLockedUntil;

    @Column(name = "otp_code")
    private String otpCode;

    @Column(name = "otp_expiry")
    private LocalDateTime otpExpiry;

    @Column(name = "avatar_url", columnDefinition = "TEXT")
    private String avatarUrl;

    @Column(name = "google_id")
    private String googleId;

    // Facebook OAuth
    @Column(name = "facebook_id")
    private String facebookId;

    @Column(name = "facebook_name")
    private String facebookName;

    // GitHub OAuth
    @Column(name = "github_id")
    private String githubId;

    @Column(name = "github_username")
    private String githubUsername;

    // Social login provider tracking
    @Column(name = "auth_provider")
    @Builder.Default
    private String authProvider = "LOCAL";

    // Face Authentication
    @Column(name = "face_encoding", columnDefinition = "TEXT")
    private String faceEncoding;

    @Column(name = "face_image_path")
    private String faceImagePath;

    @Column(name = "face_registered_at")
    private LocalDateTime faceRegisteredAt;

    @Column(name = "face_enabled")
    @Builder.Default
    private Boolean faceEnabled = false;

    @Column(name = "map_lat")
    private Double mapLat;

    @Column(name = "map_lng")
    private Double mapLng;

    @Column(name = "map_zoom")
    private Integer mapZoom;

    @Column(name = "balance")
    @Builder.Default
    private java.math.BigDecimal balance = java.math.BigDecimal.ZERO;

    // Address fields
    @Column(name = "default_address", columnDefinition = "TEXT")
    private String defaultAddress;

    @Column(name = "address_lat")
    private java.math.BigDecimal addressLat;

    @Column(name = "address_lng")
    private java.math.BigDecimal addressLng;

    // Worker specific fields
    @Column(name = "farm_id")
    private Long farmId;

    @Column(name = "cv_profile", columnDefinition = "TEXT")
    private String cvProfile;

    @Enumerated(EnumType.STRING)
    @Column(name = "approval_status")
    private ApprovalStatus approvalStatus;

    // Lock metadata fields (admin lock tracking)
    @Column(name = "lock_reason", columnDefinition = "TEXT")
    private String lockReason;

    @Column(name = "locked_at")
    private LocalDateTime lockedAt;

    @Column(name = "locked_by")
    private Long lockedBy;

    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    public enum ApprovalStatus {
        PENDING, APPROVED, REJECTED
    }

    // UserDetails Implementation implementation

    @Override
    public java.util.Collection<? extends org.springframework.security.core.GrantedAuthority> getAuthorities() {
        return java.util.List
                .of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        if (accountLockedUntil == null) {
            return true;
        }
        return accountLockedUntil.isBefore(LocalDateTime.now());
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return isActive;
    }
}
