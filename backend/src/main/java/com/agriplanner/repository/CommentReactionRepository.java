package com.agriplanner.repository;

import com.agriplanner.model.CommentReaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CommentReactionRepository extends JpaRepository<CommentReaction, Long> {

    Optional<CommentReaction> findByComment_IdAndUser_Id(Long commentId, Long userId);

    List<CommentReaction> findByComment_Id(Long commentId);

    void deleteByComment_IdAndUser_Id(Long commentId, Long userId);

    long countByComment_Id(Long commentId);

    @Query("SELECT cr.reactionType, COUNT(cr) FROM CommentReaction cr WHERE cr.comment.id = :commentId GROUP BY cr.reactionType")
    List<Object[]> countByReactionType(@Param("commentId") Long commentId);

    boolean existsByComment_IdAndUser_Id(Long commentId, Long userId);
}
