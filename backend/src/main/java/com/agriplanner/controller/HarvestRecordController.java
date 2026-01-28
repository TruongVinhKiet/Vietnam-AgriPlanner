package com.agriplanner.controller;

import com.agriplanner.model.HarvestRecord;
import com.agriplanner.repository.HarvestRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST Controller for Harvest Records
 */
@RestController
@RequestMapping("/api/harvest-records")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@SuppressWarnings("null")
public class HarvestRecordController {

    private final HarvestRecordRepository harvestRecordRepository;

    @GetMapping
    public ResponseEntity<List<HarvestRecord>> getAll() {
        return ResponseEntity.ok(harvestRecordRepository.findTop10ByOrderByHarvestDateDesc());
    }

    @GetMapping("/field/{fieldId}")
    public ResponseEntity<List<HarvestRecord>> getByField(@PathVariable Long fieldId) {
        return ResponseEntity.ok(harvestRecordRepository.findByFieldIdOrderByHarvestDateDesc(fieldId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        return harvestRecordRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        harvestRecordRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Deleted successfully"));
    }
}
