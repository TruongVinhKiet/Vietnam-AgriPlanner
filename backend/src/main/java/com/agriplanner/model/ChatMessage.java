package com.agriplanner.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import java.time.ZonedDateTime;

@Entity
@Table(name = "chat_messages")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chat_room_id", nullable = false)
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler", "members" })
    private ChatRoom chatRoom;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_id", nullable = false)
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler", "passwordHash" })
    private User sender;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    @Column(name = "message_type", length = 30)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private MessageType messageType = MessageType.TEXT;

    @Column(name = "attachment_url", columnDefinition = "TEXT")
    private String attachmentUrl;

    @Column(name = "metadata", columnDefinition = "TEXT")
    private String metadata; // JSON for transfer requests, balance info etc.

    @Column(name = "like_count")
    @Builder.Default
    private Integer likeCount = 0;

    @Column(name = "is_deleted")
    @Builder.Default
    private Boolean isDeleted = false;

    @Column(name = "created_at")
    @Builder.Default
    private ZonedDateTime createdAt = ZonedDateTime.now();

    public enum MessageType {
        TEXT,
        IMAGE,
        FILE,
        TRANSFER_REQUEST, // @chuyentien message
        BALANCE_CHECK, // @taikhoan message
        SYSTEM // System notification
    }
}
