package com.agriplanner.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "posts")
@Data
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class Post {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @EqualsAndHashCode.Include
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id", nullable = false)
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler", "passwordHash" })
    private User author;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    @Column(columnDefinition = "TEXT")
    private String images; // JSON array of image URLs stored as string

    @Column(columnDefinition = "TEXT")
    private String videos; // JSON array of video URLs stored as string

    @Column(name = "is_approved")
    @Builder.Default
    private Boolean isApproved = true;

    @Column(name = "is_hidden")
    @Builder.Default
    private Boolean isHidden = false;

    @Column(name = "like_count")
    @Builder.Default
    private Integer likeCount = 0;

    @Column(name = "comment_count")
    @Builder.Default
    private Integer commentCount = 0;

    @Column(name = "share_count")
    @Builder.Default
    private Integer shareCount = 0;

    @Column(name = "created_at")
    @Builder.Default
    private ZonedDateTime createdAt = ZonedDateTime.now();

    @Column(name = "updated_at")
    @Builder.Default
    private ZonedDateTime updatedAt = ZonedDateTime.now();

    @OneToMany(mappedBy = "post", cascade = CascadeType.REMOVE)
    @com.fasterxml.jackson.annotation.JsonIgnore
    @Builder.Default
    @ToString.Exclude
    private List<PostReaction> reactions = new ArrayList<>();

    @Transient
    @com.fasterxml.jackson.annotation.JsonProperty("userReaction")
    private String userReaction; // "LIKE", "HAHA", etc. or null

    @OneToMany(mappedBy = "post", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnoreProperties({ "post" })
    @Builder.Default
    @ToString.Exclude
    private List<Comment> comments = new ArrayList<>();

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = ZonedDateTime.now();
    }

    // Helper to increment counts
    public void incrementLikeCount() {
        this.likeCount++;
    }

    public void decrementLikeCount() {
        if (this.likeCount > 0)
            this.likeCount--;
    }

    public void incrementCommentCount() {
        this.commentCount++;
    }

    public void decrementCommentCount() {
        if (this.commentCount > 0)
            this.commentCount--;
    }
}
