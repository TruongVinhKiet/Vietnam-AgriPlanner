package com.agriplanner.controller;

import com.agriplanner.model.FertilizerDefinition;
import com.agriplanner.repository.FertilizerDefinitionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

/**
 * REST Controller for Fertilizer operations
 */
@RestController
@RequestMapping("/api/fertilizers")
@RequiredArgsConstructor
@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:8000", "http://127.0.0.1:8000" })
@SuppressWarnings("null")
public class FertilizerController {

    private final FertilizerDefinitionRepository fertilizerRepository;

    /**
     * Get all fertilizers
     */
    @GetMapping
    public ResponseEntity<List<FertilizerDefinition>> getAllFertilizers() {
        return ResponseEntity.ok(fertilizerRepository.findAll());
    }

    /**
     * Get fertilizers suitable for a specific crop
     */
    @GetMapping("/suitable")
    public ResponseEntity<List<FertilizerDefinition>> getSuitableFertilizers(@RequestParam String cropName) {
        List<FertilizerDefinition> all = fertilizerRepository.findAll();
        List<FertilizerDefinition> suitable = all.stream()
                .filter(f -> f.getSuitableCrops() != null && f.getSuitableCrops().contains(cropName))
                .collect(Collectors.toList());
        return ResponseEntity.ok(suitable);
    }

    /**
     * Get fertilizer by ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<FertilizerDefinition> getFertilizerById(@PathVariable Long id) {
        return fertilizerRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
