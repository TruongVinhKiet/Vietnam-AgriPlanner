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

    /**
     * Find overlapping analyses by bounding box intersection.
     * Two bounding boxes overlap when:
     * sw1.lat < ne2.lat AND ne1.lat > sw2.lat (latitude overlap)
     * sw1.lng < ne2.lng AND ne1.lng > sw2.lng (longitude overlap)
     */
    @Query("SELECT h FROM MapAnalysisHistory h WHERE h.status = 'completed' " +
           "AND h.mapType = :mapType " +
           "AND h.boundsSWLat IS NOT NULL AND h.boundsNELat IS NOT NULL " +
           "AND h.boundsSWLng IS NOT NULL AND h.boundsNELng IS NOT NULL " +
           "AND h.boundsSWLat < :neLat AND h.boundsNELat > :swLat " +
           "AND h.boundsSWLng < :neLng AND h.boundsNELng > :swLng")
    List<MapAnalysisHistory> findOverlappingAnalyses(
            @org.springframework.data.repository.query.Param("mapType") String mapType,
            @org.springframework.data.repository.query.Param("swLat") double swLat,
            @org.springframework.data.repository.query.Param("swLng") double swLng,
            @org.springframework.data.repository.query.Param("neLat") double neLat,
            @org.springframework.data.repository.query.Param("neLng") double neLng);
}
