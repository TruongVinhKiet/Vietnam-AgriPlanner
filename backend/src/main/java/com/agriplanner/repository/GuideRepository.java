package com.agriplanner.repository;

import com.agriplanner.model.Guide;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GuideRepository extends JpaRepository<Guide, Long> {

    Optional<Guide> findBySlug(String slug);

    Page<Guide> findByIsPublishedTrueOrderByCreatedAtDesc(Pageable pageable);

    Page<Guide> findByCategoryIdAndIsPublishedTrueOrderByCreatedAtDesc(Long categoryId, Pageable pageable);

    List<Guide> findByIsFeaturedTrueAndIsPublishedTrueOrderByCreatedAtDesc();

    @Query("SELECT g FROM Guide g WHERE g.isPublished = true AND " +
            "(LOWER(g.title) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
            "LOWER(g.content) LIKE LOWER(CONCAT('%', :query, '%')))")
    Page<Guide> searchPublished(String query, Pageable pageable);

    // Admin queries
    Page<Guide> findAllByOrderByCreatedAtDesc(Pageable pageable);

    List<Guide> findByAuthorIdOrderByCreatedAtDesc(Long authorId);
}
