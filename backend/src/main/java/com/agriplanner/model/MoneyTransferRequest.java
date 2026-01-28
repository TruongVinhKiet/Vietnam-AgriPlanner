package com.agriplanner.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Money Transfer Request - Yêu cầu chuyển tiền qua chat
 */
@Entity
@Table(name = "money_transfer_requests")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MoneyTransferRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_id", nullable = false)
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler", "passwordHash" })
    private User sender;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "receiver_id", nullable = false)
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler", "passwordHash" })
    private User receiver;

    @Column(nullable = false)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private TransferStatus status = TransferStatus.PENDING;

    @Column(name = "requires_admin_verification")
    @Builder.Default
    private Boolean requiresAdminVerification = false;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @Column(name = "chat_room_id")
    private Long chatRoomId;

    @Column(name = "chat_message_id")
    private Long chatMessageId;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "processed_at")
    private LocalDateTime processedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "processed_by")
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler", "passwordHash" })
    private User processedBy;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public enum TransferStatus {
        PENDING, // Chờ người gửi xác nhận
        AWAITING_ADMIN, // Chờ admin duyệt
        APPROVED, // Admin đã duyệt, tiền đã chuyển
        REJECTED, // Admin từ chối
        COMPLETED, // Hoàn thành (chuyển trực tiếp)
        CANCELLED // Đã hủy
    }
}
