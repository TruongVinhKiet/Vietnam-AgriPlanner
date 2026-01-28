package com.agriplanner.controller;

import com.agriplanner.model.MachineryDefinition;
import com.agriplanner.repository.MachineryDefinitionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

/**
 * REST Controller for Machinery operations
 */
@RestController
@RequestMapping("/api/machinery")
@RequiredArgsConstructor
@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:8000", "http://127.0.0.1:8000" })
@SuppressWarnings("null")
public class MachineryController {

    private final MachineryDefinitionRepository machineryRepository;

    /**
     * Get all machinery
     */
    @GetMapping
    public ResponseEntity<List<MachineryDefinition>> getAllMachinery() {
        return ResponseEntity.ok(machineryRepository.findAll());
    }

    /**
     * Get harvest machinery suitable for a specific crop
     */
    @GetMapping("/harvest")
    public ResponseEntity<List<MachineryDefinition>> getHarvestMachinery(@RequestParam String cropName) {
        List<MachineryDefinition> all = machineryRepository.findByType("harvest");
        List<MachineryDefinition> suitable = all.stream()
                .filter(m -> m.getSuitableCrops() != null && m.getSuitableCrops().contains(cropName))
                .collect(Collectors.toList());
        return ResponseEntity.ok(suitable);
    }

    /**
     * Get machinery by ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<MachineryDefinition> getMachineryById(@PathVariable Long id) {
        return machineryRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
