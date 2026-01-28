package com.agriplanner.controller;

import com.agriplanner.model.Farm;
import com.agriplanner.model.User;
import com.agriplanner.model.UserRole;
import com.agriplanner.repository.FarmRepository;
import com.agriplanner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * REST Controller for Labor & Recruitment operations
 */
@Slf4j
@RestController
@RequestMapping("/api/labor")
@RequiredArgsConstructor
@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:8000" })
@SuppressWarnings("null")
public class LaborController {

    private final UserRepository userRepository;
    private final FarmRepository farmRepository;

    /**
     * Get pending worker applications for a farm
     */
    @GetMapping("/applications")
    public ResponseEntity<?> getPendingApplications(@RequestParam Long farmId) {
        log.info("Fetching pending applications for farm ID: {}", farmId);

        Optional<Farm> farmOpt = farmRepository.findById(farmId);
        if (farmOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Farm not found"));
        }

        List<User> applicants = userRepository.findAll().stream()
                .filter(u -> u.getRole() == UserRole.WORKER)
                .filter(u -> farmId.equals(u.getFarmId()))
                .filter(u -> u.getApprovalStatus() == User.ApprovalStatus.PENDING)
                .collect(Collectors.toList());

        List<Map<String, Object>> result = applicants.stream().map(u -> {
            Map<String, Object> map = new java.util.HashMap<>();
            map.put("id", u.getId());
            map.put("fullName", u.getFullName());
            map.put("email", u.getEmail());
            map.put("phone", u.getPhone());
            map.put("cvProfile", u.getCvProfile());
            map.put("createdAt", u.getCreatedAt());
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    /**
     * Approve a worker application
     */
    @PostMapping("/approve/{userId}")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> approveWorker(@PathVariable Long userId, @RequestBody Map<String, Long> payload) {
        // Just checking payload presence if needed, but owner verification skipped for
        // MVP

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User worker = userOpt.get();
        if (worker.getRole() != UserRole.WORKER || worker.getApprovalStatus() != User.ApprovalStatus.PENDING) {
            return ResponseEntity.badRequest().body("Invalid worker status");
        }

        // Decrement Farm Quota
        Long farmId = worker.getFarmId();
        if (farmId != null) {
            Farm farm = farmRepository.findById(farmId).orElse(null);
            if (farm != null) {
                int currentQuota = farm.getRecruitmentQuota() != null ? farm.getRecruitmentQuota() : 0;
                if (currentQuota > 0) {
                    farm.setRecruitmentQuota(currentQuota - 1);
                    farmRepository.save(farm);
                } else {
                    return ResponseEntity.badRequest().body("Hạn mức tuyển dụng đã hết (Quota = 0)");
                }
            }
        }

        // Activate User
        worker.setApprovalStatus(User.ApprovalStatus.APPROVED);
        worker.setIsActive(true);
        userRepository.save(worker);

        return ResponseEntity.ok(Map.of("message", "Đã duyệt nhân công thành công"));
    }

    /**
     * Reject a worker application
     */
    @PostMapping("/reject/{userId}")
    public ResponseEntity<?> rejectWorker(@PathVariable Long userId) {
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty())
            return ResponseEntity.notFound().build();

        User worker = userOpt.get();
        worker.setApprovalStatus(User.ApprovalStatus.REJECTED);
        worker.setIsActive(false);

        userRepository.save(worker);
        return ResponseEntity.ok(Map.of("message", "Đã từ chối hồ sơ"));
    }
}
