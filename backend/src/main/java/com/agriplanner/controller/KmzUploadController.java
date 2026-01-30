package com.agriplanner.controller;

import com.agriplanner.model.KmzUpload;
import com.agriplanner.model.PlanningZone;
import com.agriplanner.repository.KmzUploadRepository;
import com.agriplanner.service.KmzParserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * REST Controller for KMZ file upload and management
 * Quản lý upload file KMZ quy hoạch đất đai
 */
@RestController
@RequestMapping("/api/admin/kmz")
@CrossOrigin(origins = "*")
public class KmzUploadController {

    private static final Logger logger = LoggerFactory.getLogger(KmzUploadController.class);

    private final KmzParserService kmzParserService;
    private final KmzUploadRepository kmzUploadRepository;

    public KmzUploadController(KmzParserService kmzParserService,
            KmzUploadRepository kmzUploadRepository) {
        this.kmzParserService = kmzParserService;
        this.kmzUploadRepository = kmzUploadRepository;
    }

    /**
     * Upload and process KMZ file
     */
    @PostMapping("/upload")
    public ResponseEntity<?> uploadKmz(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "province", defaultValue = "Cần Thơ") String province,
            @RequestParam(value = "district", required = false) String district,
            @RequestParam(value = "notes", required = false) String notes) {

        try {
            // Validate file
            if (file.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "File is empty"));
            }

            String filename = file.getOriginalFilename();
            if (filename == null || (!filename.toLowerCase().endsWith(".kmz") &&
                    !filename.toLowerCase().endsWith(".kml"))) {
                return ResponseEntity.badRequest().body(Map.of("error", "Only KMZ/KML files are allowed"));
            }

            // Get current user ID
            Long userId = getCurrentUserId();

            logger.info("Processing KMZ upload: {} ({})", filename, formatFileSize(file.getSize()));

            // Process file
            KmzUpload upload = kmzParserService.processKmzFile(file, province, district, userId);

            if (notes != null && !notes.isEmpty()) {
                upload.setNotes(notes);
                kmzUploadRepository.save(upload);
            }

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("upload", upload);
            response.put("message", String.format(
                    "Đã xử lý thành công %d vùng quy hoạch từ file %s",
                    upload.getZonesCount(),
                    upload.getOriginalName()));

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("Error uploading KMZ: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "Lỗi xử lý file: " + e.getMessage()));
        }
    }

    /**
     * Get all uploads
     */
    @GetMapping("/uploads")
    public ResponseEntity<List<KmzUpload>> getAllUploads() {
        return ResponseEntity.ok(kmzUploadRepository.findAllByOrderByUploadedAtDesc());
    }

    /**
     * Get upload by ID
     */
    @GetMapping("/uploads/{id}")
    public ResponseEntity<?> getUploadById(@PathVariable Long id) {
        if (id == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "ID is required"));
        }
        return kmzUploadRepository.findById(id)
                .map(upload -> ResponseEntity.ok((Object) upload))
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Get zones from a specific upload
     */
    @GetMapping("/uploads/{id}/zones")
    public ResponseEntity<List<PlanningZone>> getZonesByUpload(@PathVariable Long id) {
        List<PlanningZone> zones = kmzParserService.getZonesByUploadId(id);
        return ResponseEntity.ok(zones);
    }

    /**
     * Delete upload and associated zones
     */
    @DeleteMapping("/uploads/{id}")
    public ResponseEntity<?> deleteUpload(@PathVariable Long id) {
        try {
            if (id == null || !kmzUploadRepository.existsById(id)) {
                return ResponseEntity.notFound().build();
            }

            kmzParserService.deleteUpload(id);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Đã xóa upload và các vùng quy hoạch liên quan"));
        } catch (Exception e) {
            logger.error("Error deleting upload: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "Lỗi xóa upload: " + e.getMessage()));
        }
    }

    /**
     * Get uploads by province
     */
    @GetMapping("/uploads/province/{province}")
    public ResponseEntity<List<KmzUpload>> getUploadsByProvince(@PathVariable String province) {
        return ResponseEntity.ok(kmzUploadRepository.findByProvinceOrderByUploadedAtDesc(province));
    }

    /**
     * Get upload statistics
     */
    @GetMapping("/stats")
    public ResponseEntity<?> getStats() {
        Map<String, Object> stats = new HashMap<>();

        List<KmzUpload> completed = kmzUploadRepository.findByStatusOrderByUploadedAtDesc(KmzUpload.STATUS_COMPLETED);
        List<KmzUpload> failed = kmzUploadRepository.findByStatusOrderByUploadedAtDesc(KmzUpload.STATUS_FAILED);

        int totalZones = completed.stream().mapToInt(u -> u.getZonesCount() != null ? u.getZonesCount() : 0).sum();
        long totalSize = completed.stream().mapToLong(u -> u.getFileSizeBytes() != null ? u.getFileSizeBytes() : 0)
                .sum();

        stats.put("totalUploads", completed.size() + failed.size());
        stats.put("completedUploads", completed.size());
        stats.put("failedUploads", failed.size());
        stats.put("totalZones", totalZones);
        stats.put("totalSize", formatFileSize(totalSize));

        return ResponseEntity.ok(stats);
    }

    /**
     * Get current user ID from security context
     */
    private Long getCurrentUserId() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getPrincipal() != null) {
                // Try to get user ID from principal
                Object principal = auth.getPrincipal();
                if (principal instanceof org.springframework.security.core.userdetails.User) {
                    // Return default admin ID if we can't get real ID
                    return 1L;
                }
            }
        } catch (Exception e) {
            logger.warn("Could not get current user ID: {}", e.getMessage());
        }
        return 1L; // Default admin ID
    }

    /**
     * Format file size for display
     */
    private String formatFileSize(long bytes) {
        if (bytes < 1024)
            return bytes + " B";
        if (bytes < 1024 * 1024)
            return String.format("%.1f KB", bytes / 1024.0);
        if (bytes < 1024 * 1024 * 1024)
            return String.format("%.1f MB", bytes / (1024.0 * 1024));
        return String.format("%.1f GB", bytes / (1024.0 * 1024 * 1024));
    }
}
