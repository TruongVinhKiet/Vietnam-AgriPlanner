package com.agriplanner.repository;

import com.agriplanner.model.PlanningZone;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

/**
 * Repository for PlanningZone entities
 */
@Repository
public interface PlanningZoneRepository extends JpaRepository<PlanningZone, Long> {

        /**
         * Find zones by province
         */
        List<PlanningZone> findByProvince(String province);

        /**
         * Find zones by province and district
         */
        List<PlanningZone> findByProvinceAndDistrict(String province, String district);

        /**
         * Find zones by province, district and commune
         */
        List<PlanningZone> findByProvinceAndDistrictAndCommune(String province, String district, String commune);

        /**
         * Find zones by zone type
         */
        List<PlanningZone> findByZoneType(String zoneType);

        /**
         * Find zones by zone code
         */
        List<PlanningZone> findByZoneCode(String zoneCode);

        /**
         * Find zones within a bounding box (for map viewport)
         */
        @Query("SELECT pz FROM PlanningZone pz WHERE " +
                        "pz.centerLat BETWEEN :minLat AND :maxLat AND " +
                        "pz.centerLng BETWEEN :minLng AND :maxLng")
        List<PlanningZone> findByBoundingBox(
                        @Param("minLat") BigDecimal minLat,
                        @Param("maxLat") BigDecimal maxLat,
                        @Param("minLng") BigDecimal minLng,
                        @Param("maxLng") BigDecimal maxLng);

        /**
         * Find zones near a point (within radius in degrees)
         */
        @Query("SELECT pz FROM PlanningZone pz WHERE " +
                        "SQRT(POWER(pz.centerLat - :lat, 2) + POWER(pz.centerLng - :lng, 2)) <= :radius")
        List<PlanningZone> findNearPoint(
                        @Param("lat") BigDecimal lat,
                        @Param("lng") BigDecimal lng,
                        @Param("radius") BigDecimal radius);

        /**
         * Find verified zones only
         */
        List<PlanningZone> findByVerifiedTrue();

        /**
         * Count zones by type
         */
        @Query("SELECT pz.zoneType, COUNT(pz) FROM PlanningZone pz GROUP BY pz.zoneType")
        List<Object[]> countByZoneType();

        /**
         * Find zones by KMZ upload ID
         */
        List<PlanningZone> findByKmzUploadId(Long kmzUploadId);

        /**
         * Delete zones by KMZ upload ID
         */
        void deleteByKmzUploadId(Long kmzUploadId);

        // ==================== PHASE 3: SEARCH & FILTER ====================

        /**
         * Find zones by district only
         */
        List<PlanningZone> findByDistrict(String district);

        /**
         * Find zones by district and zone type
         */
        List<PlanningZone> findByDistrictAndZoneType(String district, String zoneType);

        /**
         * Search zones by name containing text (case insensitive)
         */
        List<PlanningZone> findByNameContainingIgnoreCase(String name);

        /**
         * Count zones by district
         */
        @Query("SELECT pz.district, COUNT(pz) FROM PlanningZone pz WHERE pz.district IS NOT NULL GROUP BY pz.district ORDER BY COUNT(pz) DESC")
        List<Object[]> countByDistrict();

        /**
         * Get zone overview (for clustering view - limited fields)
         */
        @Query("SELECT pz.id, pz.name, pz.centerLat, pz.centerLng, pz.zoneType, pz.fillColor, pz.areaSqm FROM PlanningZone pz")
        List<Object[]> findZoneOverview();

        /**
         * Find distinct districts that have zones
         */
        @Query("SELECT DISTINCT pz.district FROM PlanningZone pz WHERE pz.district IS NOT NULL ORDER BY pz.district")
        List<String> findDistinctDistricts();

        // ==================== MAP TYPE FILTERS ====================

        /**
         * Find zones by map type (planning or soil)
         */
        List<PlanningZone> findByMapType(String mapType);

        /**
         * Find zones by map type and province
         */
        List<PlanningZone> findByMapTypeAndProvince(String mapType, String province);

        /**
         * Find zones by map type and district
         */
        List<PlanningZone> findByMapTypeAndDistrict(String mapType, String district);

        /**
         * Find zones within bounding box filtered by map type
         */
        @Query("SELECT pz FROM PlanningZone pz WHERE " +
                        "pz.mapType = :mapType AND " +
                        "pz.centerLat BETWEEN :minLat AND :maxLat AND " +
                        "pz.centerLng BETWEEN :minLng AND :maxLng")
        List<PlanningZone> findByMapTypeAndBoundingBox(
                        @Param("mapType") String mapType,
                        @Param("minLat") BigDecimal minLat,
                        @Param("maxLat") BigDecimal maxLat,
                        @Param("minLng") BigDecimal minLng,
                        @Param("maxLng") BigDecimal maxLng);

        /**
         * Count zones by map type
         */
        @Query("SELECT pz.mapType, COUNT(pz) FROM PlanningZone pz GROUP BY pz.mapType")
        List<Object[]> countByMapType();
}
