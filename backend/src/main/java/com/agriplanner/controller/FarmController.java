package com.agriplanner.controller;

import com.agriplanner.model.Farm;
import com.agriplanner.model.User;
import com.agriplanner.repository.FarmRepository;
import com.agriplanner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * REST Controller for Farm operations
 */
@Slf4j
@RestController
@RequestMapping("/api/farms")
@RequiredArgsConstructor
@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:8000", "http://127.0.0.1:8000" })
@SuppressWarnings("null")
public class FarmController {

    private final FarmRepository farmRepository;
    private final UserRepository userRepository;

    /**
     * Get farms owned by the currently authenticated user
     * Used by cultivation, livestock, and other pages to filter data by user
     */
    @GetMapping("/my-farms")
    public ResponseEntity<List<Farm>> getMyFarms(Authentication authentication) {
        log.info("getMyFarms called. Authentication: {}", authentication != null ? authentication.getName() : "null");

        if (authentication == null) {
            log.warn("No authentication provided, returning empty list");
            return ResponseEntity.ok(Collections.emptyList());
        }

        User user = userRepository.findByEmail(authentication.getName())
                .orElse(null);

        if (user == null) {
            log.warn("User not found for email: {}", authentication.getName());
            return ResponseEntity.ok(Collections.emptyList());
        }

        log.info("Found user: id={}, email={}", user.getId(), user.getEmail());
        List<Farm> farms = farmRepository.findByOwnerId(user.getId());
        log.info("Found {} farms for user {}", farms.size(), user.getEmail());

        return ResponseEntity.ok(farms);
    }

    /**
     * Get all farms for worker registration dropdown
     * Returns only id and name for efficiency
     */
    @GetMapping("/list")
    public ResponseEntity<List<Map<String, Object>>> getAllFarmsForDropdown() {
        List<Farm> farms = farmRepository.findAllByOrderByNameAsc();

        List<Map<String, Object>> farmList = farms.stream()
                .map(farm -> Map.<String, Object>of(
                        "id", farm.getId(),
                        "name", farm.getName()))
                .collect(Collectors.toList());

        return ResponseEntity.ok(farmList);
    }

    /**
     * Get all farms (full details)
     */
    @GetMapping
    public ResponseEntity<List<Farm>> getAllFarms() {
        return ResponseEntity.ok(farmRepository.findAll());
    }

    /**
     * Update Recruitment Quota
     */
    @PutMapping("/{id}/recruitment")
    public ResponseEntity<?> updateRecruitmentQuota(@PathVariable Long id, @RequestBody Map<String, Integer> request) {
        Integer quota = request.get("quota");
        if (quota == null || quota < 0) {
            return ResponseEntity.badRequest().body("Invalid quota");
        }

        Farm farm = farmRepository.findById(id).orElseThrow(() -> new RuntimeException("Farm not found"));
        // In real app, check if current user is owner
        farm.setRecruitmentQuota(quota);
        farmRepository.save(farm);
        return ResponseEntity.ok(Map.of("message", "Updated recruitment quota", "quota", quota));
    }
}
