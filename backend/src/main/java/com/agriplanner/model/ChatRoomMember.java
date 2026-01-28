package com.agriplanner.model;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import java.time.ZonedDateTime;

@Entity
@Table(name = "chat_room_members", uniqueConstraints = {
        @UniqueConstraint(columnNames = { "chat_room_id", "user_id" })
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatRoomMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chat_room_id", nullable = false)
    @JsonBackReference
    private ChatRoom chatRoom;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler", "passwordHash" })
    private User user;

    @Column(length = 20)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private MemberRole role = MemberRole.MEMBER;

    @Column(name = "joined_at")
    @Builder.Default
    private ZonedDateTime joinedAt = ZonedDateTime.now();

    @Column(name = "last_read_at")
    private ZonedDateTime lastReadAt;

    @Column(name = "is_muted")
    @Builder.Default
    private Boolean isMuted = false;

    public enum MemberRole {
        ADMIN, // Can kick members (for GROUP type only)
        MEMBER // Regular member
    }
}
