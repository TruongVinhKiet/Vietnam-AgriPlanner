package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Entity đại diện cho thửa đất (Land Parcel)
 * Dữ liệu cào từ ilis.camau.gov.vn qua WFS GeoServer
 */
@Entity
@Table(name = "land_parcels")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LandParcel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "object_id")
    private Integer objectId;

    @Column(name = "parcel_id", length = 64)
    private String parcelId;

    @Column(name = "map_sheet_id", length = 64)
    private String mapSheetId;

    @Column(name = "map_sheet_number")
    private Integer mapSheetNumber;

    @Column(name = "parcel_number")
    private Integer parcelNumber;

    @Column(name = "area_sqm", precision = 15, scale = 2)
    private BigDecimal areaSqm;

    @Column(name = "legal_area_sqm", precision = 15, scale = 2)
    private BigDecimal legalAreaSqm;

    @Column(name = "land_use_code", length = 30)
    private String landUseCode;

    @Column(name = "land_use_name")
    private String landUseName;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Column(name = "street_name")
    private String streetName;

    @Column(length = 100)
    private String road;

    @Column(name = "road_section", length = 100)
    private String roadSection;

    @Column(length = 100)
    private String location;

    @Column(name = "admin_unit_code")
    private Integer adminUnitCode;

    @Column(name = "admin_unit_name")
    private String adminUnitName;

    @Column(length = 100)
    private String district;

    @Column(length = 100)
    private String province;

    @Column(name = "registration_status")
    private Integer registrationStatus;

    @Column(name = "change_status")
    private Integer changeStatus;

    @Column(name = "spatial_status")
    private Integer spatialStatus;

    @Column(name = "area_zone")
    private Integer areaZone;

    @Column(name = "province_code")
    private Integer provinceCode;

    @Column(name = "area_road", precision = 12, scale = 2)
    private BigDecimal areaRoad;

    @Column(name = "area_land", precision = 12, scale = 2)
    private BigDecimal areaLand;

    @Column(name = "area_river", precision = 12, scale = 2)
    private BigDecimal areaRiver;

    @Column(name = "area_railway", precision = 12, scale = 2)
    private BigDecimal areaRailway;

    @Column(name = "boundary_geojson", columnDefinition = "TEXT")
    private String boundaryGeojson;

    @Column(name = "center_lat", precision = 10, scale = 7)
    private BigDecimal centerLat;

    @Column(name = "center_lng", precision = 10, scale = 7)
    private BigDecimal centerLng;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(length = 100)
    private String source;

    @Column(name = "scraped_at")
    private LocalDateTime scrapedAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
