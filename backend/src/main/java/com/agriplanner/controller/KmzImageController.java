package com.agriplanner.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.MalformedURLException;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Controller for serving KMZ overlay images
 * Phục vụ ảnh từ file KMZ quy hoạch
 */
@RestController
@RequestMapping("/api/kmz")
@CrossOrigin(origins = "*")
public class KmzImageController {

    private static final Logger logger = LoggerFactory.getLogger(KmzImageController.class);

    @Value("${kmz.upload.dir:${user.home}/agriplanner/uploads/kmz}")
    private String uploadDir;

    /**
     * Serve overlay image from KMZ upload
     * Public endpoint - no authentication required for maps
     */
    @GetMapping("/images/{uploadId}/{filename:.+}")
    public ResponseEntity<Resource> getOverlayImage(
            @PathVariable Long uploadId,
            @PathVariable String filename) {

        try {
            Path imagePath = Paths.get(uploadDir, "images", String.valueOf(uploadId), filename);
            Resource resource = new UrlResource(java.util.Objects.requireNonNull(imagePath.toUri()));

            if (!resource.exists() || !resource.isReadable()) {
                logger.warn("Image not found: {}", imagePath);
                return ResponseEntity.notFound().build();
            }

            // Determine content type based on extension
            String contentType = "image/png";
            if (filename.toLowerCase().endsWith(".jpg") || filename.toLowerCase().endsWith(".jpeg")) {
                contentType = "image/jpeg";
            } else if (filename.toLowerCase().endsWith(".gif")) {
                contentType = "image/gif";
            }

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .body(resource);

        } catch (MalformedURLException e) {
            logger.error("Error serving image: {}", e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
}
