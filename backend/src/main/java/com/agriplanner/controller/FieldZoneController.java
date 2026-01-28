package com.agriplanner.controller;

import com.agriplanner.model.*;
import com.agriplanner.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.*;

/**
 * REST Controller for Field Zones (Multi-crop support)
 */
@RestController
@RequestMapping("/api/field-zones")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@SuppressWarnings("null")
public class FieldZoneController {

    private final FieldZoneRepository fieldZoneRepository;

    @GetMapping("/field/{fieldId}")
    public ResponseEntity<List<FieldZone>> getByField(@PathVariable Long fieldId) {
        return ResponseEntity.ok(fieldZoneRepository.findByFieldId(fieldId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        return fieldZoneRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> request) {
        try {
            FieldZone zone = FieldZone.builder()
                    .fieldId(Long.valueOf(request.get("fieldId").toString()))
                    .name((String) request.get("name"))
                    .areaSqm(request.get("areaSqm") != null
                            ? new BigDecimal(request.get("areaSqm").toString())
                            : null)
                    .cropId(request.get("cropId") != null
                            ? Long.valueOf(request.get("cropId").toString())
                            : null)
                    .boundaryCoordinates((String) request.get("boundaryCoordinates"))
                    .build();
            return ResponseEntity.ok(fieldZoneRepository.save(zone));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        return fieldZoneRepository.findById(id)
                .map(zone -> {
                    if (request.containsKey("name")) {
                        zone.setName((String) request.get("name"));
                    }
                    if (request.containsKey("areaSqm")) {
                        zone.setAreaSqm(new BigDecimal(request.get("areaSqm").toString()));
                    }
                    if (request.containsKey("cropId")) {
                        zone.setCropId(Long.valueOf(request.get("cropId").toString()));
                    }
                    if (request.containsKey("workflowStage")) {
                        zone.setWorkflowStage((String) request.get("workflowStage"));
                    }
                    return ResponseEntity.ok(fieldZoneRepository.save(zone));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        fieldZoneRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Deleted successfully"));
    }
}
