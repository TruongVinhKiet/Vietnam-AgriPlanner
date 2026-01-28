package com.agriplanner.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import lombok.*;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "chat_rooms")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 255)
    private String name;

    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private ChatRoomType type;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cooperative_id")
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler", "members" })
    private Cooperative cooperative;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler", "passwordHash" })
    private User owner;

    @Column(name = "avatar_url", columnDefinition = "TEXT")
    private String avatarUrl;

    @Column(name = "last_message_at")
    @Builder.Default
    private ZonedDateTime lastMessageAt = ZonedDateTime.now();

    @Column(name = "created_at")
    @Builder.Default
    private ZonedDateTime createdAt = ZonedDateTime.now();

    @OneToMany(mappedBy = "chatRoom", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    @Builder.Default
    private List<ChatRoomMember> members = new ArrayList<>();

    public enum ChatRoomType {
        PRIVATE, // 1-1 chat
        GROUP, // Group chat created by user
        COOPERATIVE // Auto-created for cooperative
    }

    // Helper method to update last message time
    public void updateLastMessageTime() {
        this.lastMessageAt = ZonedDateTime.now();
    }
}
