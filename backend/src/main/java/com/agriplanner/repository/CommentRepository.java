package com.agriplanner.repository;

import com.agriplanner.model.Comment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CommentRepository extends JpaRepository<Comment, Long> {

    // Top-level comments for a post
    Page<Comment> findByPostIdAndParentIsNullAndIsHiddenFalseOrderByCreatedAtDesc(Long postId, Pageable pageable);

    // All comments for a post (including replies)
    List<Comment> findByPostIdAndIsHiddenFalseOrderByCreatedAtAsc(Long postId);

    // Replies to a comment
    List<Comment> findByParentIdAndIsHiddenFalseOrderByCreatedAtAsc(Long parentId);

    // Count comments for a post
    long countByPostIdAndIsHiddenFalse(Long postId);

    // User's comments
    List<Comment> findByAuthorIdOrderByCreatedAtDesc(Long authorId);

    // Admin: Get all top-level comments for a post (including hidden)
    List<Comment> findByPostIdAndParentIsNullOrderByCreatedAtDesc(Long postId);

    void deleteByPostId(Long postId);
}
