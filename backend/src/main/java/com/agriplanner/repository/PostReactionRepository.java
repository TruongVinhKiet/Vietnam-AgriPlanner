package com.agriplanner.repository;

import com.agriplanner.model.PostReaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PostReactionRepository extends JpaRepository<PostReaction, Long> {

    Optional<PostReaction> findByPost_IdAndUser_Id(Long postId, Long userId);

    List<PostReaction> findByPost_Id(Long postId);

    void deleteByPost_IdAndUser_Id(Long postId, Long userId);

    long countByPost_Id(Long postId);

    @Query("SELECT pr.reactionType, COUNT(pr) FROM PostReaction pr WHERE pr.post.id = :postId GROUP BY pr.reactionType")
    List<Object[]> countByReactionType(@Param("postId") Long postId);

    boolean existsByPost_IdAndUser_Id(Long postId, Long userId);

    void deleteByPost_Id(Long postId);
}
