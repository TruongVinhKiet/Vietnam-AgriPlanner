package com.agriplanner.repository;

import com.agriplanner.model.LandParcel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LandParcelRepository extends JpaRepository<LandParcel, Long> {

    /**
     * Find parcels within a bounding box (for map viewport)
     */
    @Query("SELECT p FROM LandParcel p WHERE p.centerLat BETWEEN :swLat AND :neLat " +
           "AND p.centerLng BETWEEN :swLng AND :neLng")
    List<LandParcel> findInBounds(
            @Param("swLat") double swLat,
            @Param("swLng") double swLng,
            @Param("neLat") double neLat,
            @Param("neLng") double neLng);

    /**
     * Find parcels by district
     */
    List<LandParcel> findByDistrictOrderByAdminUnitName(String district);

    /**
     * Find by administrative unit (xã/phường)
     */
    List<LandParcel> findByAdminUnitCodeOrderByMapSheetNumberAscParcelNumberAsc(Integer adminUnitCode);

    /**
     * Find by map sheet number and parcel number
     */
    List<LandParcel> findByMapSheetNumberAndParcelNumber(Integer mapSheetNumber, Integer parcelNumber);

    /**
     * Find by land use code
     */
    List<LandParcel> findByLandUseCodeAndDistrict(String landUseCode, String district);

    /**
     * Get summary statistics by land use for a district
     */
    @Query("SELECT p.landUseCode, p.landUseName, COUNT(p), SUM(p.areaSqm) " +
           "FROM LandParcel p WHERE p.district = :district " +
           "GROUP BY p.landUseCode, p.landUseName ORDER BY COUNT(p) DESC")
    List<Object[]> getLandUseSummary(@Param("district") String district);

    /**
     * Get summary by administrative unit
     */
    @Query("SELECT p.adminUnitName, COUNT(p), SUM(p.areaSqm) " +
           "FROM LandParcel p WHERE p.district = :district " +
           "GROUP BY p.adminUnitName ORDER BY COUNT(p) DESC")
    List<Object[]> getAdminUnitSummary(@Param("district") String district);

    /**
     * Count total parcels in a district
     */
    long countByDistrict(String district);
}
