package com.agriplanner.repository;

import com.agriplanner.model.Post;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Modifying;

@Repository
public interface PostRepository extends JpaRepository<Post, Long> {

    // Public feed - approved and not hidden
    Page<Post> findByIsApprovedTrueAndIsHiddenFalseOrderByCreatedAtDesc(Pageable pageable);

    // User's posts
    Page<Post> findByAuthorIdOrderByCreatedAtDesc(Long authorId, Pageable pageable);

    // Friends' posts
    @Query("SELECT p FROM Post p WHERE p.isApproved = true AND p.isHidden = false AND " +
            "p.author.id IN :friendIds ORDER BY p.createdAt DESC")
    Page<Post> findFriendsPosts(List<Long> friendIds, Pageable pageable);

    // Admin - all posts
    Page<Post> findAllByOrderByCreatedAtDesc(Pageable pageable);

    // Pending approval
    Page<Post> findByIsApprovedFalseOrderByCreatedAtDesc(Pageable pageable);

    // Count posts by user
    long countByAuthorId(Long authorId);

    @Modifying
    @Query("UPDATE Post p SET p.likeCount = COALESCE(p.likeCount, 0) + 1 WHERE p.id = :id")
    void incrementLikeCount(@Param("id") Long id);

    @Modifying
    @Query("UPDATE Post p SET p.likeCount = CASE WHEN COALESCE(p.likeCount, 0) > 0 THEN p.likeCount - 1 ELSE 0 END WHERE p.id = :id")
    void decrementLikeCount(@Param("id") Long id);
}
