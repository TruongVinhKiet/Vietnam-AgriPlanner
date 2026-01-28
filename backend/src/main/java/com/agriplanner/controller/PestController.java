package com.agriplanner.controller;

import com.agriplanner.model.*;
import com.agriplanner.repository.PestDefinitionRepository;
import com.agriplanner.repository.PestDetectionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

/**
 * REST Controller for Pest Detection (Mock)
 */
@RestController
@RequestMapping("/api/pests")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@SuppressWarnings("null")
public class PestController {

    private final PestDefinitionRepository pestDefinitionRepository;
    private final PestDetectionRepository pestDetectionRepository;

    @GetMapping("/definitions")
    public ResponseEntity<List<PestDefinition>> getAllPestDefinitions() {
        return ResponseEntity.ok(pestDefinitionRepository.findAll());
    }

    @GetMapping("/detections/field/{fieldId}")
    public ResponseEntity<List<PestDetection>> getDetectionsByField(@PathVariable Long fieldId) {
        return ResponseEntity.ok(pestDetectionRepository.findByFieldIdOrderByDetectedAtDesc(fieldId));
    }

    @GetMapping("/detections/field/{fieldId}/active")
    public ResponseEntity<List<PestDetection>> getActiveDetections(@PathVariable Long fieldId) {
        return ResponseEntity.ok(pestDetectionRepository.findByFieldIdAndResolvedAtIsNull(fieldId));
    }

    /**
     * Mock pest detection - simulates AI detection
     */
    /**
     * Mock pest detection - simulates AI detection
     * TRICK: If 'imageName' or 'notes' contains a pest name, detect that specific
     * pest.
     */
    @PostMapping("/detect")
    public ResponseEntity<Map<String, Object>> detectPests(@RequestBody Map<String, Object> request) {
        Long fieldId = request.get("fieldId") != null ? Long.valueOf(request.get("fieldId").toString()) : null;
        String imageName = request.get("imageName") != null ? request.get("imageName").toString().toLowerCase() : "";
        String notes = request.get("notes") != null ? request.get("notes").toString().toLowerCase() : "";
        String searchContext = imageName + " " + notes;

        List<PestDefinition> allPests = pestDefinitionRepository.findAll();
        List<Map<String, Object>> detectedPests = new ArrayList<>();

        if (!allPests.isEmpty()) {
            boolean specificFound = false;

            // 1. Try to find specific pest by name in the image filename or notes
            for (PestDefinition pest : allPests) {
                if (searchContext.contains(pest.getName().toLowerCase()) ||
                        (pest.getScientificName() != null
                                && searchContext.contains(pest.getScientificName().toLowerCase()))) {

                    addDetectionResult(detectedPests, pest, fieldId, 0.95 + (Math.random() * 0.04)); // High confidence
                    specificFound = true;
                }
            }

            // 2. If no specific pest found, random detection (Mock AI)
            if (!specificFound && !searchContext.contains("no_pest") && !searchContext.contains("clean")) {
                int numToDetect = (int) (Math.random() * 3); // 0, 1, or 2 pests
                Collections.shuffle(allPests);

                for (int i = 0; i < Math.min(numToDetect, allPests.size()); i++) {
                    addDetectionResult(detectedPests, allPests.get(i), fieldId, 0.70 + (Math.random() * 0.20));
                }
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("detected", !detectedPests.isEmpty());
        result.put("count", detectedPests.size());
        result.put("pests", detectedPests);
        result.put("message", detectedPests.isEmpty()
                ? "Không phát hiện sâu bệnh"
                : "Phát hiện " + detectedPests.size() + " loại sâu bệnh");

        return ResponseEntity.ok(result);
    }

    private void addDetectionResult(List<Map<String, Object>> results, PestDefinition pest, Long fieldId,
            double confidence) {
        // Just prepare result, DO NOT SAVE yet.
        Map<String, Object> pestInfo = new HashMap<>();
        pestInfo.put("id", pest.getId());
        pestInfo.put("pestName", pest.getName());
        pestInfo.put("scientificName", pest.getScientificName());
        pestInfo.put("severity", pest.getSeverity());
        pestInfo.put("description", pest.getDescription());
        pestInfo.put("treatment", pest.getTreatment());
        pestInfo.put("prevention", pest.getPrevention());
        pestInfo.put("confidence", Math.round(confidence * 100));
        results.add(pestInfo);
    }

    @PostMapping("/detections")
    public ResponseEntity<?> saveDetection(@RequestBody Map<String, Object> request) {
        try {
            Long fieldId = request.get("fieldId") != null ? Long.valueOf(request.get("fieldId").toString()) : null;
            String pestName = (String) request.get("pestName");
            String severity = (String) request.get("severity");
            String notes = (String) request.get("notes");

            if (fieldId == null || pestName == null) {
                return ResponseEntity.badRequest().body("fieldId and pestName are required");
            }

            PestDetection detection = PestDetection.builder()
                    .fieldId(fieldId)
                    .pestName(pestName)
                    .severity(severity)
                    .notes(notes)
                    .detectedAt(LocalDateTime.now())
                    .build();

            return ResponseEntity.ok(pestDetectionRepository.save(detection));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error saving detection: " + e.getMessage());
        }
    }

    @PostMapping("/detections/{id}/resolve")
    public ResponseEntity<?> resolveDetection(@PathVariable Long id, @RequestBody Map<String, String> request) {
        return pestDetectionRepository.findById(id)
                .map(detection -> {
                    detection.setResolvedAt(LocalDateTime.now());
                    detection.setTreatmentApplied(request.get("treatment"));
                    return ResponseEntity.ok(pestDetectionRepository.save(detection));
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
