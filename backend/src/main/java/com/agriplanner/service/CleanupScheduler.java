package com.agriplanner.service;

import com.agriplanner.controller.MapImageAnalysisController;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * P3 FIX: Scheduled tasks for resource cleanup
 */
@Service
public class CleanupScheduler {

    private static final Logger logger = LoggerFactory.getLogger(CleanupScheduler.class);

    @Autowired
    private MapImageAnalysisController mapImageAnalysisController;

    @Value("${map.image.upload.dir:${user.home}/agriplanner/uploads/map-images}")
    private String uploadDir;

    /**
     * Clean up old analysis results and temp files every hour
     */
    @Scheduled(fixedRate = 3600000) // 1 hour
    public void cleanupResources() {
        logger.info("Running scheduled resource cleanup...");

        // 1. Clean in-memory maps
        mapImageAnalysisController.cleanupOldAnalysisResults();

        // 2. Clean uploaded map images older than 24 hours
        cleanupOldFiles(uploadDir, 24);

        // 3. Clean OpenCV temp directory handled by system temp (usually auto-cleaned,
        // but good to check)
        // Note: MultiAIOrchestrator extraction likely uses default temp dir
    }

    private void cleanupOldFiles(String dirPath, int ageHours) {
        try {
            Path dir = Paths.get(dirPath);
            if (!Files.exists(dir))
                return;

            Instant retentionTime = Instant.now().minus(ageHours, ChronoUnit.HOURS);

            Files.walkFileTree(dir, new SimpleFileVisitor<Path>() {
                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                    if (attrs.creationTime().toInstant().isBefore(retentionTime)) {
                        try {
                            Files.delete(file);
                            logger.debug("Deleted old file: {}", file);
                        } catch (IOException e) {
                            logger.warn("Failed to delete file: {}", file);
                        }
                    }
                    return FileVisitResult.CONTINUE;
                }
            });
        } catch (Exception e) {
            logger.error("Error cleaning up old files in {}: {}", dirPath, e.getMessage());
        }
    }
}
