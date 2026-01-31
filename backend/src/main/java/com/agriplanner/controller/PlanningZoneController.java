package com.agriplanner.controller;

import com.agriplanner.model.PlanningZone;
import com.agriplanner.model.PlanningZoneType;
import com.agriplanner.model.SoilType;
import com.agriplanner.model.ZoneSnapshot;
import com.agriplanner.model.ZoneSnapshotItem;
import com.agriplanner.repository.PlanningZoneRepository;
import com.agriplanner.repository.PlanningZoneTypeRepository;
import com.agriplanner.repository.SoilTypeRepository;
import com.agriplanner.repository.ZoneSnapshotRepository;
import com.agriplanner.repository.ZoneSnapshotItemRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * REST Controller for Planning Zone management (Quản lý Quy hoạch Đất đai)
 */
@RestController
@RequestMapping("/api/planning-zones")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class PlanningZoneController {

    private final PlanningZoneRepository planningZoneRepository;
    private final PlanningZoneTypeRepository planningZoneTypeRepository;
    private final SoilTypeRepository soilTypeRepository;
    private final ZoneSnapshotRepository zoneSnapshotRepository;
    private final ZoneSnapshotItemRepository zoneSnapshotItemRepository;

    /**
     * Get all planning zones (optionally filtered by map type)
     */
    @GetMapping
    public ResponseEntity<List<PlanningZone>> getAllZones(
            @RequestParam(required = false) String mapType) {
        if (mapType != null && !mapType.isEmpty()) {
            return ResponseEntity.ok(planningZoneRepository.findByMapType(mapType));
        }
        return ResponseEntity.ok(planningZoneRepository.findAll());
    }

    /**
     * Get planning zones within map bounds (optionally filtered by map type)
     */
    @GetMapping("/bounds")
    public ResponseEntity<List<PlanningZone>> getZonesByBounds(
            @RequestParam BigDecimal minLat,
            @RequestParam BigDecimal maxLat,
            @RequestParam BigDecimal minLng,
            @RequestParam BigDecimal maxLng,
            @RequestParam(required = false) String mapType) {
        List<PlanningZone> zones;
        if (mapType != null && !mapType.isEmpty()) {
            zones = planningZoneRepository.findByMapTypeAndBoundingBox(mapType, minLat, maxLat, minLng, maxLng);
        } else {
            zones = planningZoneRepository.findByBoundingBox(minLat, maxLat, minLng, maxLng);
        }
        return ResponseEntity.ok(zones);
    }

    /**
     * Get planning zones near a point (optionally filtered by map type)
     */
    @GetMapping("/near")
    public ResponseEntity<List<PlanningZone>> getZonesNearPoint(
            @RequestParam BigDecimal lat,
            @RequestParam BigDecimal lng,
            @RequestParam(defaultValue = "0.05") BigDecimal radius,
            @RequestParam(required = false) String mapType) {
        List<PlanningZone> zones = planningZoneRepository.findNearPoint(lat, lng, radius);
        // Filter by mapType if provided
        if (mapType != null && !mapType.isEmpty()) {
            zones = zones.stream()
                    .filter(z -> mapType.equals(z.getMapType()))
                    .toList();
        }
        return ResponseEntity.ok(zones);
    }

    /**
     * Get planning zones by location
     */
    @GetMapping("/location")
    public ResponseEntity<List<PlanningZone>> getZonesByLocation(
            @RequestParam(required = false) String province,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String commune) {

        List<PlanningZone> zones;
        if (commune != null && district != null && province != null) {
            zones = planningZoneRepository.findByProvinceAndDistrictAndCommune(province, district, commune);
        } else if (district != null && province != null) {
            zones = planningZoneRepository.findByProvinceAndDistrict(province, district);
        } else if (province != null) {
            zones = planningZoneRepository.findByProvince(province);
        } else {
            zones = planningZoneRepository.findAll();
        }
        return ResponseEntity.ok(zones);
    }

    /**
     * Get planning zone by ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getZoneById(@PathVariable Long id) {
        if (id == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "ID is required"));
        }
        return planningZoneRepository.findById(id)
                .map(zone -> ResponseEntity.ok((Object) zone))
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Create a new planning zone
     */
    @PostMapping
    public ResponseEntity<?> createZone(@RequestBody Map<String, Object> request) {
        try {
            PlanningZone zone = new PlanningZone();

            zone.setName((String) request.get("name"));
            zone.setBoundaryCoordinates((String) request.get("boundaryCoordinates"));

            if (request.get("areaSqm") != null) {
                zone.setAreaSqm(new BigDecimal(request.get("areaSqm").toString()));
            }
            if (request.get("centerLat") != null) {
                zone.setCenterLat(new BigDecimal(request.get("centerLat").toString()));
            }
            if (request.get("centerLng") != null) {
                zone.setCenterLng(new BigDecimal(request.get("centerLng").toString()));
            }

            zone.setZoneType((String) request.get("zoneType"));
            zone.setZoneCode((String) request.get("zoneCode"));
            zone.setLandUsePurpose((String) request.get("landUsePurpose"));
            zone.setPlanningPeriod((String) request.get("planningPeriod"));

            zone.setProvince((String) request.get("province"));
            zone.setDistrict((String) request.get("district"));
            zone.setCommune((String) request.get("commune"));

            zone.setSource((String) request.get("source"));
            zone.setSourceUrl((String) request.get("sourceUrl"));

            zone.setFillColor((String) request.getOrDefault("fillColor", "#ff6b6b"));
            zone.setStrokeColor((String) request.getOrDefault("strokeColor", "#c92a2a"));

            if (request.get("fillOpacity") != null) {
                zone.setFillOpacity(new BigDecimal(request.get("fillOpacity").toString()));
            }

            zone.setNotes((String) request.get("notes"));

            // Map type: planning or soil
            zone.setMapType((String) request.getOrDefault("mapType", "planning"));

            if (request.get("createdBy") != null) {
                zone.setCreatedBy(Long.valueOf(request.get("createdBy").toString()));
            }

            PlanningZone saved = planningZoneRepository.save(zone);
            return ResponseEntity.ok(saved);

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Update a planning zone
     */
    @PutMapping("/{id}")
    @SuppressWarnings("null")
    public ResponseEntity<?> updateZone(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        if (id == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "ID is required"));
        }
        return planningZoneRepository.findById(id)
                .map(zone -> {
                    if (request.containsKey("name"))
                        zone.setName((String) request.get("name"));
                    if (request.containsKey("boundaryCoordinates"))
                        zone.setBoundaryCoordinates((String) request.get("boundaryCoordinates"));
                    if (request.containsKey("zoneType"))
                        zone.setZoneType((String) request.get("zoneType"));
                    if (request.containsKey("zoneCode"))
                        zone.setZoneCode((String) request.get("zoneCode"));
                    if (request.containsKey("landUsePurpose"))
                        zone.setLandUsePurpose((String) request.get("landUsePurpose"));
                    if (request.containsKey("fillColor"))
                        zone.setFillColor((String) request.get("fillColor"));
                    if (request.containsKey("strokeColor"))
                        zone.setStrokeColor((String) request.get("strokeColor"));
                    if (request.containsKey("notes"))
                        zone.setNotes((String) request.get("notes"));
                    if (request.containsKey("verified")) {
                        zone.setVerified((Boolean) request.get("verified"));
                        if (zone.getVerified()) {
                            zone.setVerifiedDate(LocalDateTime.now());
                        }
                    }

                    PlanningZone saved = planningZoneRepository.save(zone);
                    @SuppressWarnings("null")
                    ResponseEntity<?> response = ResponseEntity.ok(saved);
                    return response;
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Delete a planning zone
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteZone(@PathVariable Long id) {
        if (id == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "ID is required"));
        }
        if (planningZoneRepository.existsById(id)) {
            planningZoneRepository.deleteById(id);
            return ResponseEntity.ok(Map.of("message", "Planning zone deleted successfully"));
        }
        return ResponseEntity.notFound().build();
    }

    /**
     * Get all zone types (danh mục loại đất)
     */
    @GetMapping("/types")
    public ResponseEntity<List<PlanningZoneType>> getAllZoneTypes() {
        return ResponseEntity.ok(planningZoneTypeRepository.findAllByOrderByCategoryAscNameAsc());
    }

    /**
     * Get all soil types (danh mục loại đất thổ nhưỡng)
     */
    @GetMapping("/soil-types")
    public ResponseEntity<List<SoilType>> getAllSoilTypes() {
        return ResponseEntity.ok(soilTypeRepository.findAllByOrderByCategoryAscNameAsc());
    }

    /**
     * Get soil types suitable for a specific crop
     */
    @GetMapping("/soil-types/for-crop")
    public ResponseEntity<List<SoilType>> getSoilTypesForCrop(@RequestParam String cropName) {
        return ResponseEntity.ok(soilTypeRepository.findBySuitableCropsContainingIgnoreCase(cropName));
    }

    /**
     * Get zone types by category
     */
    @GetMapping("/types/category/{category}")
    public ResponseEntity<List<PlanningZoneType>> getZoneTypesByCategory(@PathVariable String category) {
        return ResponseEntity.ok(planningZoneTypeRepository.findByCategory(category));
    }

    /**
     * Get statistics
     */
    @GetMapping("/stats")
    public ResponseEntity<?> getStats() {
        List<Object[]> countByType = planningZoneRepository.countByZoneType();
        long total = planningZoneRepository.count();
        long verified = planningZoneRepository.findByVerifiedTrue().size();

        return ResponseEntity.ok(Map.of(
                "total", total,
                "verified", verified,
                "byType", countByType));
    }

    /**
     * Get official data sources for planning zones
     * Returns list of verified government sources
     */
    @GetMapping("/sources")
    public ResponseEntity<?> getOfficialSources() {
        // Hardcoded official sources - in production, this would come from database
        var sources = List.of(
                Map.of(
                        "id", 1,
                        "name", "Cổng thông tin GIS Cần Thơ - Quy hoạch 2021-2030",
                        "province", "Cần Thơ",
                        "sourceType", "GOVERNMENT_GIS",
                        "baseUrl", "https://gisportal.cantho.gov.vn",
                        "apiEndpoint",
                        "https://gisportal.cantho.gov.vn/maps/web/kg/e574cba1-8f4b-4b4a-b654-5593045ba85b/0/home",
                        "isOfficial", true,
                        "description",
                        "Nguồn chính thức từ UBND TP Cần Thơ - Quy hoạch sử dụng đất, phân vùng chức năng"),
                Map.of(
                        "id", 2,
                        "name", "Cổng thông tin GIS Cần Thơ - Sở Nông nghiệp",
                        "province", "Cần Thơ",
                        "sourceType", "GOVERNMENT_GIS",
                        "baseUrl", "https://gisportal.cantho.gov.vn",
                        "apiEndpoint",
                        "https://gisportal.cantho.gov.vn/maps/web/kg/75b3f8ba-e8d2-4a3b-aa5b-9a4bc8d84dd2/0/csdl",
                        "isOfficial", true,
                        "description", "Dữ liệu nông nghiệp, môi trường từ Sở NN&MT"),
                Map.of(
                        "id", 3,
                        "name", "Guland.vn - Bản đồ quy hoạch",
                        "province", "Toàn quốc",
                        "sourceType", "REFERENCE",
                        "baseUrl", "https://guland.vn",
                        "apiEndpoint", "https://guland.vn/soi-quy-hoach",
                        "isOfficial", false,
                        "description", "Nguồn tham khảo - cần đối chiếu với nguồn chính thức"),
                Map.of(
                        "id", 4,
                        "name", "Sở TN&MT Cần Thơ",
                        "province", "Cần Thơ",
                        "sourceType", "GOVERNMENT",
                        "baseUrl", "https://sonnmt.cantho.gov.vn",
                        "apiEndpoint", null,
                        "isOfficial", true,
                        "description", "Liên hệ trực tiếp để lấy dữ liệu số"));

        return ResponseEntity.ok(sources);
    }

    /**
     * Get Can Tho administrative divisions
     */
    @GetMapping("/cantho/districts")
    public ResponseEntity<?> getCanThoDistricts() {
        var districts = List.of(
                Map.of("code", "NK", "name", "Quận Ninh Kiều", "lat", 10.0306, "lng", 105.7701),
                Map.of("code", "BT", "name", "Quận Bình Thủy", "lat", 10.0833, "lng", 105.7333),
                Map.of("code", "CR", "name", "Quận Cái Răng", "lat", 10.0000, "lng", 105.7500),
                Map.of("code", "OT", "name", "Quận Ô Môn", "lat", 10.1167, "lng", 105.6333),
                Map.of("code", "TN", "name", "Quận Thốt Nốt", "lat", 10.2333, "lng", 105.5833),
                Map.of("code", "PD", "name", "Huyện Phong Điền", "lat", 10.0500, "lng", 105.7167),
                Map.of("code", "CD", "name", "Huyện Cờ Đỏ", "lat", 10.0167, "lng", 105.5167),
                Map.of("code", "VT", "name", "Huyện Vĩnh Thạnh", "lat", 10.2000, "lng", 105.4667),
                Map.of("code", "TL", "name", "Huyện Thới Lai", "lat", 10.0667, "lng", 105.5667));

        return ResponseEntity.ok(Map.of(
                "province", Map.of("code", "CT", "name", "Thành phố Cần Thơ"),
                "districts", districts,
                "bounds", Map.of(
                        "sw", List.of(9.8, 105.4),
                        "ne", List.of(10.3, 105.9))));
    }

    // ==================== PHASE 3: SEARCH, FILTER & EXPORT ====================

    /**
     * Search zones by name
     */
    @GetMapping("/search")
    public ResponseEntity<List<PlanningZone>> searchZonesByName(@RequestParam String q) {
        if (q == null || q.trim().isEmpty()) {
            return ResponseEntity.ok(List.of());
        }
        return ResponseEntity.ok(planningZoneRepository.findByNameContainingIgnoreCase(q.trim()));
    }

    /**
     * Get available districts that have zones
     */
    @GetMapping("/districts")
    public ResponseEntity<?> getAvailableDistricts() {
        List<String> districts = planningZoneRepository.findDistinctDistricts();
        List<Object[]> counts = planningZoneRepository.countByDistrict();

        // Create district info with counts
        var districtInfo = counts.stream().map(row -> Map.of(
                "name", row[0] != null ? row[0].toString() : "Không xác định",
                "count", row[1])).toList();

        return ResponseEntity.ok(Map.of(
                "districts", districts,
                "withCounts", districtInfo));
    }

    /**
     * Filter zones by district
     */
    @GetMapping("/by-district")
    public ResponseEntity<List<PlanningZone>> getZonesByDistrict(
            @RequestParam String district,
            @RequestParam(required = false) String zoneType) {
        if (zoneType != null && !zoneType.isEmpty()) {
            return ResponseEntity.ok(planningZoneRepository.findByDistrictAndZoneType(district, zoneType));
        }
        return ResponseEntity.ok(planningZoneRepository.findByDistrict(district));
    }

    /**
     * Get zones overview for clustering (lightweight data)
     */
    @GetMapping("/overview")
    public ResponseEntity<?> getZonesOverview() {
        List<Object[]> overview = planningZoneRepository.findZoneOverview();

        var result = overview.stream().map(row -> Map.of(
                "id", row[0],
                "name", row[1] != null ? row[1] : "Vùng quy hoạch",
                "lat", row[2],
                "lng", row[3],
                "type", row[4] != null ? row[4] : "unknown",
                "color", row[5] != null ? row[5] : "#f59e0b",
                "area", row[6] != null ? row[6] : 0)).toList();

        return ResponseEntity.ok(result);
    }

    /**
     * Find zones at a specific point (which zone contains this coordinate)
     */
    @GetMapping("/at-point")
    public ResponseEntity<List<PlanningZone>> getZonesAtPoint(
            @RequestParam BigDecimal lat,
            @RequestParam BigDecimal lng) {
        // First find zones near the point, then filter by actual polygon
        BigDecimal radius = new BigDecimal("0.01"); // ~1km radius
        List<PlanningZone> nearbyZones = planningZoneRepository.findNearPoint(lat, lng, radius);

        // For now return nearby zones - full "contains" check would require PostGIS
        return ResponseEntity.ok(nearbyZones);
    }

    /**
     * Export zones as GeoJSON
     */
    @GetMapping("/export/geojson")
    public ResponseEntity<?> exportAsGeoJson(
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String zoneType) {

        List<PlanningZone> zones;
        if (district != null && !district.isEmpty()) {
            if (zoneType != null && !zoneType.isEmpty()) {
                zones = planningZoneRepository.findByDistrictAndZoneType(district, zoneType);
            } else {
                zones = planningZoneRepository.findByDistrict(district);
            }
        } else if (zoneType != null && !zoneType.isEmpty()) {
            zones = planningZoneRepository.findByZoneType(zoneType);
        } else {
            zones = planningZoneRepository.findAll();
        }

        // Build GeoJSON FeatureCollection
        var features = zones.stream().map(zone -> {
            Object geometry = null;
            if (zone.getGeojson() != null && !zone.getGeojson().isEmpty()) {
                try {
                    geometry = new com.fasterxml.jackson.databind.ObjectMapper().readValue(zone.getGeojson(),
                            Object.class);
                } catch (Exception e) {
                    geometry = null;
                }
            }
            if (geometry == null && zone.getBoundaryCoordinates() != null) {
                try {
                    var coords = new com.fasterxml.jackson.databind.ObjectMapper()
                            .readValue(zone.getBoundaryCoordinates(), Object.class);
                    geometry = Map.of(
                            "type", "Polygon",
                            "coordinates", List.of(coords));
                } catch (Exception e) {
                    geometry = null;
                }
            }

            return Map.of(
                    "type", "Feature",
                    "properties", Map.of(
                            "id", zone.getId(),
                            "name", zone.getName() != null ? zone.getName() : "",
                            "zoneType", zone.getZoneType() != null ? zone.getZoneType() : "",
                            "zoneCode", zone.getZoneCode() != null ? zone.getZoneCode() : "",
                            "district", zone.getDistrict() != null ? zone.getDistrict() : "",
                            "fillColor", zone.getFillColor() != null ? zone.getFillColor() : "#f59e0b",
                            "areaSqm", zone.getAreaSqm() != null ? zone.getAreaSqm() : 0),
                    "geometry", geometry);
        }).toList();

        var geojson = Map.of(
                "type", "FeatureCollection",
                "features", features,
                "metadata", Map.of(
                        "exported", java.time.LocalDateTime.now().toString(),
                        "count", zones.size(),
                        "filter", Map.of(
                                "district", district != null ? district : "all",
                                "zoneType", zoneType != null ? zoneType : "all")));

        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=planning_zones.geojson")
                .body(geojson);
    }

    // ==================== SNAPSHOT & VERSION CONTROL ====================

    /**
     * Create a snapshot of current zones
     */
    @PostMapping("/snapshots")
    public ResponseEntity<?> createSnapshot(@RequestBody Map<String, String> request) {
        try {
            String name = request.getOrDefault("name", "Snapshot " + LocalDateTime.now());
            String description = request.get("description");

            // Create snapshot
            ZoneSnapshot snapshot = new ZoneSnapshot();
            snapshot.setName(name);
            snapshot.setDescription(description);
            snapshot.setCreatedBy(1L); // TODO: Get from auth

            // Get all current zones
            List<PlanningZone> zones = planningZoneRepository.findAll();
            snapshot.setZonesCount(zones.size());
            zoneSnapshotRepository.save(snapshot);

            // Save zone data as JSON items
            ObjectMapper mapper = new ObjectMapper();
            mapper.registerModule(new JavaTimeModule());

            List<ZoneSnapshotItem> items = new ArrayList<>();
            for (PlanningZone zone : zones) {
                ZoneSnapshotItem item = new ZoneSnapshotItem();
                item.setSnapshot(snapshot);
                item.setOriginalZoneId(zone.getId());
                item.setZoneData(mapper.writeValueAsString(zone));
                items.add(item);
            }
            zoneSnapshotItemRepository.saveAll(items);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Đã tạo snapshot thành công",
                    "snapshot", Map.of(
                            "id", snapshot.getId(),
                            "name", snapshot.getName(),
                            "zonesCount", snapshot.getZonesCount(),
                            "createdAt", snapshot.getCreatedAt().toString())));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "Lỗi tạo snapshot: " + e.getMessage()));
        }
    }

    /**
     * Get all snapshots
     */
    @GetMapping("/snapshots")
    public ResponseEntity<?> getSnapshots() {
        List<ZoneSnapshot> snapshots = zoneSnapshotRepository.findAllByOrderByCreatedAtDesc();

        List<Map<String, Object>> result = new ArrayList<>();
        for (ZoneSnapshot s : snapshots) {
            result.add(Map.of(
                    "id", s.getId(),
                    "name", s.getName(),
                    "description", s.getDescription() != null ? s.getDescription() : "",
                    "zonesCount", s.getZonesCount() != null ? s.getZonesCount() : 0,
                    "createdAt", s.getCreatedAt() != null ? s.getCreatedAt().toString() : ""));
        }
        return ResponseEntity.ok(result);
    }

    /**
     * Rollback to a specific snapshot
     */
    @PostMapping("/rollback/{snapshotId}")
    @SuppressWarnings("null")
    public ResponseEntity<?> rollbackToSnapshot(@PathVariable Long snapshotId) {
        try {
            ZoneSnapshot snapshot = zoneSnapshotRepository.findById(snapshotId)
                    .orElseThrow(() -> new RuntimeException("Snapshot không tồn tại"));

            // Get snapshot items
            List<ZoneSnapshotItem> items = zoneSnapshotItemRepository.findBySnapshotId(snapshotId);

            // Delete all current zones
            planningZoneRepository.deleteAll();

            // Restore zones from snapshot
            ObjectMapper mapper = new ObjectMapper();
            mapper.registerModule(new JavaTimeModule());

            List<PlanningZone> restoredZones = new ArrayList<>();
            for (ZoneSnapshotItem item : items) {
                PlanningZone zone = mapper.readValue(item.getZoneData(), PlanningZone.class);
                zone.setId(null); // Reset ID for new insert
                restoredZones.add(zone);
            }
            planningZoneRepository.saveAll(restoredZones);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Đã rollback về snapshot: " + snapshot.getName(),
                    "restoredCount", restoredZones.size()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "Lỗi rollback: " + e.getMessage()));
        }
    }

    /**
     * Delete a snapshot
     */
    @DeleteMapping("/snapshots/{snapshotId}")
    @SuppressWarnings("null")
    public ResponseEntity<?> deleteSnapshot(@PathVariable Long snapshotId) {
        try {
            if (!zoneSnapshotRepository.existsById(snapshotId)) {
                return ResponseEntity.notFound().build();
            }
            zoneSnapshotRepository.deleteById(snapshotId);
            return ResponseEntity.ok(Map.of("success", true, "message", "Đã xóa snapshot"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "Lỗi xóa snapshot: " + e.getMessage()));
        }
    }

    /**
     * Update zone geometry (polygon shape)
     */
    @PutMapping("/{id}/geometry")
    @SuppressWarnings("null")
    public ResponseEntity<?> updateZoneGeometry(
            @PathVariable Long id,
            @RequestBody Map<String, Object> request) {
        try {
            PlanningZone zone = planningZoneRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Zone không tồn tại"));

            // Update boundary coordinates
            if (request.containsKey("boundaryCoordinates")) {
                zone.setBoundaryCoordinates((String) request.get("boundaryCoordinates"));
            }

            // Update GeoJSON if provided
            if (request.containsKey("geojson")) {
                zone.setGeojson((String) request.get("geojson"));
            }

            // Update center point if provided
            if (request.containsKey("centerLat")) {
                zone.setCenterLat(new BigDecimal(request.get("centerLat").toString()));
            }
            if (request.containsKey("centerLng")) {
                zone.setCenterLng(new BigDecimal(request.get("centerLng").toString()));
            }

            // Update area if provided
            if (request.containsKey("areaSqm")) {
                zone.setAreaSqm(new BigDecimal(request.get("areaSqm").toString()));
            }

            zone.setUpdatedAt(LocalDateTime.now());
            PlanningZone saved = planningZoneRepository.save(zone);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Đã cập nhật hình dạng zone",
                    "zone", saved));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "Lỗi cập nhật geometry: " + e.getMessage()));
        }
    }

    /**
     * Delete all zones from a specific upload
     */
    @DeleteMapping("/by-upload/{uploadId}")
    public ResponseEntity<?> deleteZonesByUpload(@PathVariable Long uploadId) {
        try {
            List<PlanningZone> zones = planningZoneRepository.findByKmzUploadId(uploadId);
            int count = zones.size();

            if (count == 0) {
                return ResponseEntity.ok(Map.of(
                        "success", true,
                        "message", "Không có zone nào thuộc upload này",
                        "deletedCount", 0));
            }

            planningZoneRepository.deleteAll(zones);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Đã xóa " + count + " zones từ upload",
                    "deletedCount", count));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "Lỗi xóa zones: " + e.getMessage()));
        }
    }
}
