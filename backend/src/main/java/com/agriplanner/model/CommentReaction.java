package com.agriplanner.model;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

import java.time.ZonedDateTime;

@Entity
@Table(name = "comment_reactions", uniqueConstraints = {
        @UniqueConstraint(columnNames = { "comment_id", "user_id" })
})
@Data
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class CommentReaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @EqualsAndHashCode.Include
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "comment_id", nullable = false)
    @JsonBackReference
    @ToString.Exclude
    private Comment comment;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "user_id", nullable = false)
    @JsonIgnoreProperties({ "passwordHash", "posts", "cooperative", "roles" })
    private User user;

    @Column(name = "reaction_type", length = 20)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private PostReaction.ReactionType reactionType = PostReaction.ReactionType.LIKE;

    @Column(name = "created_at")
    @Builder.Default
    private ZonedDateTime createdAt = ZonedDateTime.now();
}
