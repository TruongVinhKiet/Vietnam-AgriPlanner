package com.agriplanner.repository;

import com.agriplanner.model.MapAnalysisHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for MapAnalysisHistory entity
 */
@Repository
public interface MapAnalysisHistoryRepository extends JpaRepository<MapAnalysisHistory, String> {

    /**
     * Find all analysis history ordered by creation date (newest first)
     */
    List<MapAnalysisHistory> findAllByOrderByCreatedAtDesc();

    /**
     * Find analysis history by status
     */
    List<MapAnalysisHistory> findByStatusOrderByCreatedAtDesc(String status);

    /**
     * Find analysis history by map type
     */
    List<MapAnalysisHistory> findByMapTypeOrderByCreatedAtDesc(String mapType);

    /**
     * Find analysis history by user
     */
    List<MapAnalysisHistory> findByUserIdOrderByCreatedAtDesc(Long userId);

    /**
     * Count completed analyses
     */
    @Query("SELECT COUNT(h) FROM MapAnalysisHistory h WHERE h.status = 'completed'")
    long countCompleted();

    /**
     * Find by province and district
     */
    List<MapAnalysisHistory> findByProvinceAndDistrictOrderByCreatedAtDesc(String province, String district);
}
