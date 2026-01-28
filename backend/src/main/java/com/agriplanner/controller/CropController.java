package com.agriplanner.controller;

import com.agriplanner.model.CropDefinition;
import com.agriplanner.service.FieldService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST Controller for Crop definitions
 */
@RestController
@RequestMapping("/api/crops")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class CropController {

    private final FieldService fieldService;

    /**
     * Get all crops
     */
    @GetMapping
    public ResponseEntity<List<CropDefinition>> getAllCrops(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Integer currentTemp) {

        if (currentTemp != null) {
            return ResponseEntity.ok(fieldService.getSuitableCrops(currentTemp));
        }
        if (category != null) {
            return ResponseEntity.ok(fieldService.getCropsByCategory(category));
        }
        return ResponseEntity.ok(fieldService.getAllCrops());
    }

    /**
     * Get single crop by ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getCrop(@PathVariable Long id) {
        return fieldService.getCropById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
