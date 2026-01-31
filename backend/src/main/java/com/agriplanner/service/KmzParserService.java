package com.agriplanner.service;

import com.agriplanner.model.KmzUpload;
import com.agriplanner.model.PlanningZone;
import com.agriplanner.model.PlanningZoneType;
import com.agriplanner.repository.KmzUploadRepository;
import com.agriplanner.repository.PlanningZoneRepository;
import com.agriplanner.repository.PlanningZoneTypeRepository;
import net.lingala.zip4j.ZipFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.math.BigDecimal;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.*;

/**
 * Service for parsing KMZ/KML files and extracting planning zones
 * Xử lý upload và parse file KMZ quy hoạch đất đai
 */
@Service
public class KmzParserService {

    private static final Logger logger = LoggerFactory.getLogger(KmzParserService.class);

    private final KmzUploadRepository kmzUploadRepository;
    private final PlanningZoneRepository planningZoneRepository;
    private final PlanningZoneTypeRepository planningZoneTypeRepository;

    @Value("${kmz.upload.dir:${user.home}/agriplanner/uploads/kmz}")
    private String uploadDir;

    public KmzParserService(
            KmzUploadRepository kmzUploadRepository,
            PlanningZoneRepository planningZoneRepository,
            PlanningZoneTypeRepository planningZoneTypeRepository) {
        this.kmzUploadRepository = kmzUploadRepository;
        this.planningZoneRepository = planningZoneRepository;
        this.planningZoneTypeRepository = planningZoneTypeRepository;
    }

    /**
     * Process uploaded KMZ file (original method - defaults to planning type)
     */
    @SuppressWarnings("null")
    public KmzUpload processKmzFile(MultipartFile file, String province, String district, Long userId) {
        return processKmzFile(file, province, district, userId, "planning");
    }

    /**
     * Process uploaded KMZ file with map type
     */
    @SuppressWarnings("null")
    public KmzUpload processKmzFile(MultipartFile file, String province, String district, Long userId, String mapType) {
        // Create upload record
        KmzUpload upload = new KmzUpload();
        upload.setOriginalName(file.getOriginalFilename());
        upload.setFilename(UUID.randomUUID().toString() + ".kmz");
        upload.setProvince(province);
        upload.setDistrict(district);
        upload.setFileSizeBytes(file.getSize());
        upload.setUploadedBy(userId);
        upload.setMapType(mapType);
        upload.setStatus(KmzUpload.STATUS_PROCESSING);
        upload = kmzUploadRepository.save(upload);

        try {
            // Create upload directory if not exists
            Path uploadPath = Paths.get(uploadDir);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }

            // Save file
            Path filePath = uploadPath.resolve(upload.getFilename());
            File targetFile = filePath.toFile();
            file.transferTo(Objects.requireNonNull(targetFile));

            // Extract and parse KMZ
            List<PlanningZone> zones = parseKmzFile(filePath, upload.getId(), province, district);

            // Save zones with map type
            for (PlanningZone zone : zones) {
                zone.setKmzUploadId(upload.getId());
                zone.setCreatedBy(userId);
                zone.setMapType(mapType);
                planningZoneRepository.save(zone);
            }

            // Update upload status
            upload.setZonesCount(zones.size());
            upload.setStatus(KmzUpload.STATUS_COMPLETED);
            upload.setProcessedAt(LocalDateTime.now());

        } catch (Exception e) {
            logger.error("Error processing KMZ file: {}", e.getMessage(), e);
            upload.setStatus(KmzUpload.STATUS_FAILED);
            upload.setErrorMessage(e.getMessage());
        }

        return kmzUploadRepository.save(upload);
    }

    /**
     * Parse KMZ file and extract planning zones
     */
    private List<PlanningZone> parseKmzFile(Path kmzPath, Long uploadId, String province, String district)
            throws Exception {
        List<PlanningZone> zones = new ArrayList<>();

        // Create temp directory for extraction
        Path tempDir = Files.createTempDirectory("kmz_extract_");

        try {
            logger.info("=== KMZ DEBUG START ===");
            logger.info("KMZ file path: {}", kmzPath);
            logger.info("KMZ file size: {} bytes", Files.size(kmzPath));

            // Extract KMZ (it's a ZIP file) - using try-with-resources for proper cleanup
            try (ZipFile zipFile = new ZipFile(kmzPath.toFile())) {
                zipFile.extractAll(tempDir.toString());
            }

            // List all extracted files for debugging
            logger.info("Extracted files in temp directory:");
            try (var stream = Files.walk(tempDir)) {
                stream.forEach(p -> logger.info("  - {}", p.getFileName()));
            }

            // Find KML file
            Path kmlFile = findKmlFile(tempDir);
            if (kmlFile == null) {
                logger.error("No KML file found in KMZ archive!");
                throw new RuntimeException("No KML file found in KMZ archive");
            }

            logger.info("Found KML file: {}", kmlFile.getFileName());
            logger.info("KML file size: {} bytes", Files.size(kmlFile));

            // Parse KML
            String kmlContent = Files.readString(kmlFile);
            logger.info("KML content length: {} characters", kmlContent.length());

            // Log first 5000 characters for debugging
            String preview = kmlContent.length() > 5000 ? kmlContent.substring(0, 5000) : kmlContent;
            logger.info("KML content preview:\n{}", preview);

            // Check for common KML elements
            logger.info("Contains <Placemark>: {}", kmlContent.contains("<Placemark"));
            logger.info("Contains <GroundOverlay>: {}", kmlContent.contains("<GroundOverlay"));
            logger.info("Contains <coordinates>: {}", kmlContent.contains("<coordinates"));
            logger.info("Contains <Polygon>: {}", kmlContent.contains("<Polygon"));
            logger.info("Contains <Folder>: {}", kmlContent.contains("<Folder"));

            zones = parseKmlContent(kmlContent, province, district, tempDir, uploadId);

            logger.info("=== KMZ DEBUG END - Extracted {} zones ===", zones.size());

        } finally {
            // Cleanup temp directory
            deleteDirectory(tempDir);
        }

        return zones;
    }

    /**
     * Find KML file in extracted directory
     */
    private Path findKmlFile(Path directory) throws IOException {
        try (var stream = Files.walk(directory)) {
            return stream
                    .filter(p -> p.toString().toLowerCase().endsWith(".kml"))
                    .findFirst()
                    .orElse(null);
        }
    }

    /**
     * Parse KML content and extract placemarks
     */
    private List<PlanningZone> parseKmlContent(String kmlContent, String province, String district, Path tempDir,
            Long uploadId) {
        List<PlanningZone> zones = new ArrayList<>();

        // Get zone types for color mapping
        Map<String, PlanningZoneType> zoneTypeMap = new HashMap<>();
        planningZoneTypeRepository.findAll().forEach(zt -> zoneTypeMap.put(zt.getCode(), zt));

        try {
            // Remove namespaces for easier parsing (kml:Placemark -> Placemark)
            String normalizedContent = kmlContent
                    .replaceAll("<kml:", "<")
                    .replaceAll("</kml:", "</")
                    .replaceAll("<gx:", "<")
                    .replaceAll("</gx:", "</");

            logger.info("KML content length: {} characters", normalizedContent.length());

            // Use regex to extract Placemarks - handle various formats
            // Pattern now matches Placemark with optional attributes
            Pattern placemarkPattern = Pattern.compile(
                    "<Placemark[^>]*>(.*?)</Placemark>",
                    Pattern.DOTALL | Pattern.CASE_INSENSITIVE);

            Matcher matcher = placemarkPattern.matcher(normalizedContent);
            int found = 0;
            int parsed = 0;

            while (matcher.find() && parsed < 10000) { // Limit to 10000 zones
                found++;
                String placemarkContent = matcher.group(1);

                try {
                    PlanningZone zone = parsePlacemark(placemarkContent, province, district, zoneTypeMap);
                    if (zone != null) {
                        zones.add(zone);
                        parsed++;
                    }
                } catch (Exception e) {
                    logger.warn("Failed to parse placemark {}: {}", found, e.getMessage());
                }
            }

            logger.info("Found {} placemarks, successfully parsed {} zones", found, parsed);

            // If no placemarks found, try extracting from Document/Folder structure
            if (found == 0) {
                logger.info("No direct placemarks found, trying nested Folder structure...");

                // Try to find placemarks inside Folder elements
                Pattern folderPattern = Pattern.compile(
                        "<Folder[^>]*>(.*?)</Folder>",
                        Pattern.DOTALL | Pattern.CASE_INSENSITIVE);
                Matcher folderMatcher = folderPattern.matcher(normalizedContent);

                while (folderMatcher.find() && parsed < 10000) {
                    String folderContent = folderMatcher.group(1);
                    Matcher innerPlacemarkMatcher = placemarkPattern.matcher(folderContent);

                    while (innerPlacemarkMatcher.find() && parsed < 10000) {
                        found++;
                        String placemarkContent = innerPlacemarkMatcher.group(1);

                        try {
                            PlanningZone zone = parsePlacemark(placemarkContent, province, district, zoneTypeMap);
                            if (zone != null) {
                                zones.add(zone);
                                parsed++;
                            }
                        } catch (Exception e) {
                            logger.warn("Failed to parse nested placemark: {}", e.getMessage());
                        }
                    }
                }

                logger.info("After folder search: Found {} placemarks, parsed {} zones", found, parsed);
            }

            // If still no zones, try GroundOverlay (image overlay KMZ files)
            if (zones.isEmpty() && normalizedContent.contains("<GroundOverlay")) {
                logger.info("No placemarks found, trying GroundOverlay (image overlay) parsing...");
                zones = parseGroundOverlays(normalizedContent, province, district, zoneTypeMap, tempDir, uploadId);
                logger.info("Parsed {} zones from GroundOverlay", zones.size());
            }

        } catch (Exception e) {
            logger.error("Error parsing KML content: {}", e.getMessage(), e);
        }

        return zones;
    }

    /**
     * Parse GroundOverlay elements (image overlays with LatLonBox)
     * These are KMZ files that use raster images instead of vector polygons
     */
    private List<PlanningZone> parseGroundOverlays(String content, String province, String district,
            Map<String, PlanningZoneType> zoneTypeMap, Path tempDir, Long uploadId) {
        List<PlanningZone> zones = new ArrayList<>();
        Set<String> processedBounds = new HashSet<>(); // Avoid duplicates

        try {
            // Find all GroundOverlay elements
            Pattern overlayPattern = Pattern.compile(
                    "<GroundOverlay[^>]*>(.*?)</GroundOverlay>",
                    Pattern.DOTALL | Pattern.CASE_INSENSITIVE);
            Matcher matcher = overlayPattern.matcher(content);

            int found = 0;
            int parsed = 0;

            while (matcher.find() && parsed < 100) { // Limit overlays
                found++;
                String overlayContent = matcher.group(1);

                try {
                    // Extract LatLonBox coordinates
                    String latLonBox = extractTag(overlayContent, "LatLonBox");
                    if (latLonBox == null)
                        continue;

                    String northStr = extractTag(latLonBox, "north");
                    String southStr = extractTag(latLonBox, "south");
                    String eastStr = extractTag(latLonBox, "east");
                    String westStr = extractTag(latLonBox, "west");

                    if (northStr == null || southStr == null || eastStr == null || westStr == null)
                        continue;

                    double north = Double.parseDouble(northStr);
                    double south = Double.parseDouble(southStr);
                    double east = Double.parseDouble(eastStr);
                    double west = Double.parseDouble(westStr);

                    // Create unique key for this bounding box
                    String boundsKey = String.format("%.6f,%.6f,%.6f,%.6f", north, south, east, west);
                    if (processedBounds.contains(boundsKey))
                        continue; // Skip duplicates
                    processedBounds.add(boundsKey);

                    // Get name from parent Folder if available
                    String name = extractTag(overlayContent, "name");
                    if (name == null || name.isEmpty()) {
                        // Try to get from Icon href
                        String icon = extractTag(overlayContent, "Icon");
                        if (icon != null) {
                            String href = extractTag(icon, "href");
                            if (href != null) {
                                name = href.replace(".png", "").replace("kml_image_", "");
                            }
                        }
                    }
                    if (name == null || name.isEmpty()) {
                        name = "Vùng quy hoạch " + (parsed + 1);
                    }

                    // Create zone from bounding box
                    PlanningZone zone = new PlanningZone();
                    zone.setName(name);

                    // Convert LatLonBox to polygon coordinates (clockwise from NW)
                    // NW -> NE -> SE -> SW -> NW (closed polygon)
                    String coordinates = String.format(
                            "%f,%f,0 %f,%f,0 %f,%f,0 %f,%f,0 %f,%f,0",
                            west, north, // NW
                            east, north, // NE
                            east, south, // SE
                            west, south, // SW
                            west, north // Close polygon
                    );

                    String coordJson = parseCoordinatesToJson(coordinates);
                    zone.setBoundaryCoordinates(coordJson);

                    String geojson = createGeoJson(coordinates, name);
                    zone.setGeojson(geojson);

                    // Center point
                    zone.setCenterLat(BigDecimal.valueOf((north + south) / 2));
                    zone.setCenterLng(BigDecimal.valueOf((east + west) / 2));

                    // Calculate approximate area in square meters
                    double latDiff = Math.abs(north - south);
                    double lngDiff = Math.abs(east - west);
                    // Approximate conversion at this latitude (about 111km per degree)
                    double areaSqm = latDiff * 111000 * lngDiff * 111000
                            * Math.cos(Math.toRadians((north + south) / 2));
                    zone.setAreaSqm(BigDecimal.valueOf(areaSqm));

                    // Set metadata
                    zone.setZoneType("Đất quy hoạch");
                    zone.setFillColor(getRandomColor());
                    zone.setProvince(province != null ? province : "Cần Thơ");
                    zone.setDistrict(district);
                    zone.setSource("KMZ Upload (GroundOverlay)");
                    zone.setPlanningPeriod("2021-2030");
                    zone.setFillOpacity(new BigDecimal("0.1")); // Lower opacity for image overlay
                    zone.setStrokeColor("#333333");

                    // Copy image file and set imageUrl
                    String icon = extractTag(overlayContent, "Icon");
                    if (icon != null) {
                        String href = extractTag(icon, "href");
                        if (href != null && !href.isEmpty()) {
                            try {
                                // Find image in temp directory
                                Path sourceImage = tempDir.resolve(href);
                                if (Files.exists(sourceImage)) {
                                    // Create images directory for this upload
                                    Path imagesDir = Paths.get(uploadDir, "images", String.valueOf(uploadId));
                                    Files.createDirectories(imagesDir);

                                    // Copy with unique name
                                    String imageName = parsed + "_" + href;
                                    Path targetImage = imagesDir.resolve(imageName);
                                    Files.copy(sourceImage, targetImage, StandardCopyOption.REPLACE_EXISTING);

                                    // Set image URL (relative path for serving)
                                    String imageUrl = "/api/kmz/images/" + uploadId + "/" + imageName;
                                    zone.setImageUrl(imageUrl);
                                    logger.info("Saved overlay image: {} -> {}", href, imageUrl);
                                } else {
                                    logger.warn("Image file not found: {}", href);
                                }
                            } catch (Exception imageEx) {
                                logger.warn("Failed to copy image {}: {}", href, imageEx.getMessage());
                            }
                        }
                    }

                    zones.add(zone);
                    parsed++;
                    logger.debug("Parsed GroundOverlay zone: {} at [{},{},{},{}]", name, north, south, east, west);

                } catch (Exception e) {
                    logger.warn("Failed to parse GroundOverlay {}: {}", found, e.getMessage());
                }
            }

            logger.info("Found {} GroundOverlays, parsed {} zones", found, parsed);

        } catch (Exception e) {
            logger.error("Error parsing GroundOverlays: {}", e.getMessage(), e);
        }

        return zones;
    }

    /**
     * Parse a single Placemark element
     */
    private PlanningZone parsePlacemark(String content, String province, String district,
            Map<String, PlanningZoneType> zoneTypeMap) {
        PlanningZone zone = new PlanningZone();

        // Extract name
        String name = extractTag(content, "name");
        if (name == null || name.isEmpty()) {
            name = "Unnamed Zone";
        }
        zone.setName(name);

        // Extract description
        String description = extractTag(content, "description");
        zone.setNotes(description);

        // Extract coordinates from Polygon, LineString, or MultiGeometry
        String coordinates = extractCoordinates(content);
        if (coordinates == null || coordinates.isEmpty()) {
            logger.debug("No coordinates found for placemark: {}", name);
            return null; // Skip if no coordinates
        }

        // Parse coordinates to JSON array format
        String coordJson = parseCoordinatesToJson(coordinates);
        zone.setBoundaryCoordinates(coordJson);

        // Create GeoJSON for frontend
        String geojson = createGeoJson(coordinates, name);
        zone.setGeojson(geojson);

        // Calculate center point
        double[] center = calculateCenter(coordinates);
        if (center != null) {
            zone.setCenterLat(BigDecimal.valueOf(center[0]));
            zone.setCenterLng(BigDecimal.valueOf(center[1]));
        }

        // Try to detect zone type from name or description
        String zoneCode = detectZoneCode(name, description);
        zone.setZoneCode(zoneCode);

        // Set zone type based on code
        if (zoneCode != null && zoneTypeMap.containsKey(zoneCode)) {
            PlanningZoneType zoneType = zoneTypeMap.get(zoneCode);
            zone.setZoneType(zoneType.getCategory());
            zone.setFillColor(zoneType.getDefaultColor());
            zone.setLandUsePurpose(zoneType.getName());
        } else {
            zone.setZoneType("Đất khác");
            zone.setFillColor(getRandomColor());
        }

        // Extract style/color from KML if available
        String fillColor = extractStyleColor(content);
        if (fillColor != null) {
            zone.setFillColor(fillColor);
        }

        // Set location
        zone.setProvince(province != null ? province : "Cần Thơ");
        zone.setDistrict(district);
        zone.setSource("KMZ Upload");
        zone.setPlanningPeriod("2021-2030");
        zone.setFillOpacity(new BigDecimal("0.5"));
        zone.setStrokeColor("#333333");

        return zone;
    }

    /**
     * Extract tag content from XML
     */
    private String extractTag(String content, String tagName) {
        Pattern pattern = Pattern.compile(
                "<" + tagName + "[^>]*>(.*?)</" + tagName + ">",
                Pattern.DOTALL | Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(content);
        if (matcher.find()) {
            String value = matcher.group(1).trim();
            // Remove CDATA wrapper if present
            value = value.replaceAll("<!\\[CDATA\\[(.*)\\]\\]>", "$1");
            // Decode HTML entities
            value = value.replace("&lt;", "<").replace("&gt;", ">")
                    .replace("&amp;", "&").replace("&quot;", "\"");
            return value;
        }
        return null;
    }

    /**
     * Extract coordinates from polygon, linestring, or multigeometry
     */
    private String extractCoordinates(String content) {
        // Try to find coordinates in various structures
        // 1. Direct coordinates tag
        Pattern coordPattern = Pattern.compile(
                "<coordinates[^>]*>([^<]+)</coordinates>",
                Pattern.DOTALL | Pattern.CASE_INSENSITIVE);
        Matcher matcher = coordPattern.matcher(content);

        if (matcher.find()) {
            String coords = matcher.group(1).trim();
            // Clean up whitespace and newlines
            coords = coords.replaceAll("\\s+", " ").trim();
            if (!coords.isEmpty()) {
                return coords;
            }
        }

        // 2. Try within Polygon -> outerBoundaryIs -> LinearRing
        Pattern polygonPattern = Pattern.compile(
                "<Polygon[^>]*>.*?<outerBoundaryIs>.*?<LinearRing>.*?<coordinates[^>]*>([^<]+)</coordinates>",
                Pattern.DOTALL | Pattern.CASE_INSENSITIVE);
        matcher = polygonPattern.matcher(content);
        if (matcher.find()) {
            return matcher.group(1).trim().replaceAll("\\s+", " ");
        }

        // 3. Try MultiGeometry
        Pattern multiPattern = Pattern.compile(
                "<MultiGeometry[^>]*>(.*?)</MultiGeometry>",
                Pattern.DOTALL | Pattern.CASE_INSENSITIVE);
        matcher = multiPattern.matcher(content);
        if (matcher.find()) {
            String multiContent = matcher.group(1);
            // Get first polygon's coordinates
            matcher = coordPattern.matcher(multiContent);
            if (matcher.find()) {
                return matcher.group(1).trim().replaceAll("\\s+", " ");
            }
        }

        return null;
    }

    /**
     * Parse KML coordinates to JSON array format
     */
    private String parseCoordinatesToJson(String coordinates) {
        StringBuilder json = new StringBuilder("[");
        String[] points = coordinates.trim().split("\\s+");
        boolean first = true;

        for (String point : points) {
            String[] parts = point.split(",");
            if (parts.length >= 2) {
                if (!first)
                    json.append(",");
                // KML format is: lng,lat,altitude
                double lng = Double.parseDouble(parts[0]);
                double lat = Double.parseDouble(parts[1]);
                json.append("[").append(lat).append(",").append(lng).append("]");
                first = false;
            }
        }

        json.append("]");
        return json.toString();
    }

    /**
     * Create GeoJSON from coordinates
     */
    private String createGeoJson(String coordinates, String name) {
        StringBuilder geojson = new StringBuilder();
        geojson.append("{\"type\":\"Feature\",\"properties\":{\"name\":\"");
        geojson.append(escapeJson(name));
        geojson.append("\"},\"geometry\":{\"type\":\"Polygon\",\"coordinates\":[[");

        String[] points = coordinates.trim().split("\\s+");
        boolean first = true;

        for (String point : points) {
            String[] parts = point.split(",");
            if (parts.length >= 2) {
                if (!first)
                    geojson.append(",");
                // GeoJSON format is: [lng, lat]
                geojson.append("[").append(parts[0]).append(",").append(parts[1]).append("]");
                first = false;
            }
        }

        geojson.append("]]}}");
        return geojson.toString();
    }

    /**
     * Escape JSON string
     */
    private String escapeJson(String text) {
        if (text == null)
            return "";
        return text.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    /**
     * Calculate center point from coordinates
     */
    private double[] calculateCenter(String coordinates) {
        try {
            String[] points = coordinates.trim().split("\\s+");
            double sumLat = 0, sumLng = 0;
            int count = 0;

            for (String point : points) {
                String[] parts = point.split(",");
                if (parts.length >= 2) {
                    sumLng += Double.parseDouble(parts[0]);
                    sumLat += Double.parseDouble(parts[1]);
                    count++;
                }
            }

            if (count > 0) {
                return new double[] { sumLat / count, sumLng / count };
            }
        } catch (Exception e) {
            logger.warn("Error calculating center: {}", e.getMessage());
        }
        return null;
    }

    /**
     * Detect zone code from name or description
     */
    private String detectZoneCode(String name, String description) {
        String combined = (name != null ? name : "") + " " + (description != null ? description : "");
        combined = combined.toUpperCase();

        // Common zone codes from Luật Đất đai
        String[] codes = { "LUC", "LUK", "CHN", "CLN", "RSX", "RPH", "RDD", "NTS", "LMU", "NKH",
                "ONT", "ODT", "TSC", "DGD", "DYT", "DVH", "DTT", "DGT", "DTL", "DNL",
                "SKC", "SKK", "SKT", "TMD", "NTD", "SON", "MNC", "PNK", "BCS", "DCS", "NCS" };

        for (String code : codes) {
            if (combined.contains(code)) {
                return code;
            }
        }

        // Try to detect from Vietnamese keywords
        if (combined.contains("LÚA") || combined.contains("RUỘNG"))
            return "LUC";
        if (combined.contains("CÂY LÂU NĂM") || combined.contains("TRÁI CÂY"))
            return "CLN";
        if (combined.contains("RỪNG"))
            return "RSX";
        if (combined.contains("THỦY SẢN") || combined.contains("AO") || combined.contains("HỒ"))
            return "NTS";
        if (combined.contains("DÂN CƯ") || combined.contains("NHÀ Ở") || combined.contains("ĐÔ THỊ"))
            return "ODT";
        if (combined.contains("NÔNG THÔN"))
            return "ONT";
        if (combined.contains("GIAO THÔNG") || combined.contains("ĐƯỜNG"))
            return "DGT";
        if (combined.contains("CÔNG NGHIỆP"))
            return "SKC";
        if (combined.contains("THƯƠNG MẠI"))
            return "TMD";
        if (combined.contains("GIÁO DỤC") || combined.contains("TRƯỜNG"))
            return "DGD";
        if (combined.contains("Y TẾ") || combined.contains("BỆNH VIỆN"))
            return "DYT";

        return null;
    }

    /**
     * Extract style color from KML
     */
    private String extractStyleColor(String content) {
        // Try to find color in Style element
        Pattern colorPattern = Pattern.compile(
                "<color>([a-fA-F0-9]{8})</color>",
                Pattern.CASE_INSENSITIVE);
        Matcher matcher = colorPattern.matcher(content);
        if (matcher.find()) {
            String kmlColor = matcher.group(1);
            // KML color format: AABBGGRR (Alpha, Blue, Green, Red)
            // Convert to HTML hex: #RRGGBB
            if (kmlColor.length() == 8) {
                String r = kmlColor.substring(6, 8);
                String g = kmlColor.substring(4, 6);
                String b = kmlColor.substring(2, 4);
                return "#" + r + g + b;
            }
        }
        return null;
    }

    /**
     * Generate random pastel color
     */
    private String getRandomColor() {
        String[] colors = {
                "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
                "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"
        };
        return colors[new Random().nextInt(colors.length)];
    }

    /**
     * Delete directory recursively
     */
    private void deleteDirectory(Path path) {
        try {
            Files.walk(path)
                    .sorted(Comparator.reverseOrder())
                    .forEach(p -> {
                        try {
                            Files.delete(p);
                        } catch (Exception e) {
                        }
                    });
        } catch (Exception e) {
            logger.warn("Failed to delete temp directory: {}", e.getMessage());
        }
    }

    /**
     * Get zones by upload ID
     */
    public List<PlanningZone> getZonesByUploadId(Long uploadId) {
        return planningZoneRepository.findByKmzUploadId(uploadId);
    }

    /**
     * Delete upload and associated zones
     */
    public void deleteUpload(Long uploadId) {
        if (uploadId == null)
            return;

        // Get filename before deleting record
        String filename = null;
        try {
            KmzUpload upload = kmzUploadRepository.findById(uploadId).orElse(null);
            if (upload != null) {
                filename = upload.getFilename();
            }
        } catch (Exception e) {
            logger.warn("Error fetching upload info for deletion: {}", e.getMessage());
        }

        // Delete associated zones first
        List<PlanningZone> zones = planningZoneRepository.findByKmzUploadId(uploadId);
        if (zones != null && !zones.isEmpty()) {
            planningZoneRepository.deleteAll(zones);
        }

        // Delete upload record
        kmzUploadRepository.deleteById(uploadId);

        // Try to delete file
        if (filename != null) {
            try {
                Path filePath = Paths.get(uploadDir, filename);
                Files.deleteIfExists(filePath);
            } catch (Exception e) {
                logger.warn("Failed to delete KMZ file: {}", e.getMessage());
            }
        }
    }
}
