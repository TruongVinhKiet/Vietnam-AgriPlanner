package com.agriplanner.model;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import java.time.ZonedDateTime;

@Entity
@Table(name = "post_reactions", uniqueConstraints = {
        @UniqueConstraint(columnNames = { "post_id", "user_id" })
})
@Data
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class PostReaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @EqualsAndHashCode.Include
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "post_id", nullable = false)
    @JsonBackReference
    @ToString.Exclude
    private Post post;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "user_id", nullable = false)
    @JsonIgnoreProperties({ "passwordHash", "posts", "cooperative", "roles" }) // Reduce serialization depth
    private User user;

    @Column(name = "reaction_type", length = 20)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private ReactionType reactionType = ReactionType.LIKE;

    @Column(name = "created_at")
    @Builder.Default
    private ZonedDateTime createdAt = ZonedDateTime.now();

    public enum ReactionType {
        LIKE, // 👍
        LOVE, // ❤️
        HAHA, // 😆
        WOW, // 😮
        SAD, // 😢
        ANGRY // 😠
    }
}
