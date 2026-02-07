package com.agriplanner.controller;

import com.agriplanner.model.LandParcel;
import com.agriplanner.repository.LandParcelRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * REST Controller for Land Parcel data (Lớp thửa đất - Huyện Thới Bình, Cà Mau)
 * Data scraped from ilis.camau.gov.vn GeoServer WFS
 */
@RestController
@RequestMapping("/api/land-parcels")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class LandParcelController {

    private final LandParcelRepository landParcelRepository;

    /**
     * Get parcels within map bounds (for viewport rendering)
     */
    @GetMapping("/bounds")
    public ResponseEntity<List<LandParcel>> getParcelsInBounds(
            @RequestParam double swLat,
            @RequestParam double swLng,
            @RequestParam double neLat,
            @RequestParam double neLng) {
        List<LandParcel> parcels = landParcelRepository.findInBounds(swLat, swLng, neLat, neLng);
        return ResponseEntity.ok(parcels);
    }

    /**
     * Get parcels by admin unit code (xã/phường)
     */
    @GetMapping("/admin-unit/{code}")
    public ResponseEntity<List<LandParcel>> getByAdminUnit(@PathVariable Integer code) {
        return ResponseEntity.ok(
                landParcelRepository.findByAdminUnitCodeOrderByMapSheetNumberAscParcelNumberAsc(code));
    }

    /**
     * Get land use summary statistics for a district
     */
    @GetMapping("/stats/land-use")
    public ResponseEntity<List<Map<String, Object>>> getLandUseStats(
            @RequestParam(defaultValue = "Thới Bình") String district) {
        List<Object[]> rows = landParcelRepository.getLandUseSummary(district);
        List<Map<String, Object>> result = rows.stream().map(r -> {
            Map<String, Object> m = new HashMap<>();
            m.put("landUseCode", r[0]);
            m.put("landUseName", r[1]);
            m.put("count", r[2]);
            m.put("totalAreaSqm", r[3]);
            return m;
        }).toList();
        return ResponseEntity.ok(result);
    }

    /**
     * Get summary grouped by administrative unit
     */
    @GetMapping("/stats/admin-units")
    public ResponseEntity<List<Map<String, Object>>> getAdminUnitStats(
            @RequestParam(defaultValue = "Thới Bình") String district) {
        List<Object[]> rows = landParcelRepository.getAdminUnitSummary(district);
        List<Map<String, Object>> result = rows.stream().map(r -> {
            Map<String, Object> m = new HashMap<>();
            m.put("adminUnitName", r[0]);
            m.put("count", r[1]);
            m.put("totalAreaSqm", r[2]);
            return m;
        }).toList();
        return ResponseEntity.ok(result);
    }

    /**
     * Get overall district statistics
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getDistrictStats(
            @RequestParam(defaultValue = "Thới Bình") String district) {
        long totalParcels = landParcelRepository.countByDistrict(district);
        List<Object[]> landUse = landParcelRepository.getLandUseSummary(district);
        List<Object[]> adminUnits = landParcelRepository.getAdminUnitSummary(district);

        Map<String, Object> stats = new HashMap<>();
        stats.put("district", district);
        stats.put("totalParcels", totalParcels);
        stats.put("landUseTypes", landUse.size());
        stats.put("adminUnits", adminUnits.size());
        return ResponseEntity.ok(stats);
    }

    /**
     * Search parcel by map sheet and parcel number
     */
    @GetMapping("/search")
    public ResponseEntity<List<LandParcel>> searchParcel(
            @RequestParam Integer mapSheet,
            @RequestParam Integer parcelNumber) {
        return ResponseEntity.ok(
                landParcelRepository.findByMapSheetNumberAndParcelNumber(mapSheet, parcelNumber));
    }
}
