package com.agriplanner.controller;

import com.agriplanner.model.Farm;
import com.agriplanner.model.User;
import com.agriplanner.model.UserRole;
import com.agriplanner.model.EmploymentHistory;
import com.agriplanner.model.JobApplication;
import com.agriplanner.repository.FarmRepository;
import com.agriplanner.repository.UserRepository;
import com.agriplanner.repository.TaskRepository;
import com.agriplanner.repository.EmploymentHistoryRepository;
import com.agriplanner.repository.JobApplicationRepository;
import com.agriplanner.service.RecruitmentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
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
    private final TaskRepository taskRepository;
    private final EmploymentHistoryRepository employmentHistoryRepository;
    private final JobApplicationRepository jobApplicationRepository;
    private final RecruitmentService recruitmentService;

    /**
     * Get pending worker applications for a farm.
     * Pulls from JobApplication table (new flow) + legacy PENDING users.
     * Also marks former workers via EmploymentHistory.
     */
    @GetMapping("/applications")
    public ResponseEntity<?> getPendingApplications(@RequestParam Long farmId) {
        log.info("Fetching pending applications for farm ID: {}", farmId);

        Optional<Farm> farmOpt = farmRepository.findById(farmId);
        if (farmOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Farm not found"));
        }

        // Query from JobApplication table (new flow)
        List<JobApplication> applications = jobApplicationRepository.findByPost_Farm_IdAndStatus(farmId, "PENDING");

        List<Map<String, Object>> result = applications.stream().map(app -> {
            User worker = app.getWorker();
            Map<String, Object> map = new java.util.HashMap<>();
            map.put("id", app.getId());
            map.put("workerId", worker.getId());
            map.put("fullName", worker.getFullName());
            map.put("email", worker.getEmail());
            map.put("phone", worker.getPhone());
            map.put("applyMessage", app.getMessage());
            // We'll let the frontend parse the chosen CV from `applyMessage` if needed,
            // but we also keep cvProfile and cvPdfUrl as fallbacks.
            map.put("cvProfile", worker.getCvProfile());
            map.put("cvPdfUrl", app.getCvPdfUrl() != null ? app.getCvPdfUrl() : worker.getCvPdfUrl());
            map.put("createdAt", app.getAppliedAt());
            boolean isFormerWorker = employmentHistoryRepository.existsByWorkerIdAndFarmId(worker.getId(), farmId);
            map.put("isFormerWorker", isFormerWorker);
            return map;
        }).collect(Collectors.toList());

        // Also include legacy direct-registration applicants (PENDING users with this farmId)
        List<User> legacyApplicants = userRepository.findAll().stream()
                .filter(u -> u.getRole() == UserRole.WORKER)
                .filter(u -> farmId.equals(u.getFarmId()))
                .filter(u -> u.getApprovalStatus() == User.ApprovalStatus.PENDING)
                .collect(Collectors.toList());

        legacyApplicants.forEach(u -> {
            Map<String, Object> map = new java.util.HashMap<>();
            map.put("id", u.getId());
            map.put("workerId", u.getId());
            map.put("fullName", u.getFullName());
            map.put("email", u.getEmail());
            map.put("phone", u.getPhone());
            map.put("cvProfile", u.getCvProfile());
            map.put("cvPdfUrl", u.getCvPdfUrl());
            map.put("applyMessage", "Ứng tuyển trực tiếp");
            map.put("createdAt", u.getCreatedAt());
            map.put("isLegacy", true);
            map.put("isFormerWorker", employmentHistoryRepository.existsByWorkerIdAndFarmId(u.getId(), farmId));
            result.add(map);
        });

        return ResponseEntity.ok(result);
    }

    /**
     * Approve a worker application (supports both JobApplication ID and legacy User ID)
     */
    @PostMapping("/approve/{id}")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> approveWorker(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        Boolean isLegacy = payload.get("isLegacy") != null && Boolean.TRUE.equals(payload.get("isLegacy"));

        if (isLegacy) {
            Optional<User> userOpt = userRepository.findById(id);
            if (userOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            User worker = userOpt.get();
            if (worker.getRole() != UserRole.WORKER || worker.getApprovalStatus() != User.ApprovalStatus.PENDING) {
                return ResponseEntity.badRequest().body("Invalid worker status");
            }

            Long farmId = worker.getFarmId();
            if (farmId != null) {
                Farm farm = farmRepository.findById(farmId).orElse(null);
                if (farm != null) {
                    int currentQuota = farm.getRecruitmentQuota() != null ? farm.getRecruitmentQuota() : 0;
                    long currentWorkers = userRepository.findByRoleAndFarmIdAndApprovalStatus(UserRole.WORKER, farmId, User.ApprovalStatus.APPROVED).size();
                    if (currentQuota <= 0 || currentWorkers >= currentQuota) {
                        return ResponseEntity.badRequest().body("Hạn mức tuyển dụng đã đầy (" + currentWorkers + "/" + currentQuota + ")");
                    }
                }
            }

            worker.setApprovalStatus(User.ApprovalStatus.APPROVED);
            worker.setIsActive(true);
            userRepository.save(worker);
            
            if (farmId != null) {
                Farm refetchedFarm = farmRepository.findById(farmId).orElse(null);
                if (refetchedFarm != null) {
                    recruitmentService.syncRecruitmentPostForFarm(refetchedFarm);
                }
            }
            
            return ResponseEntity.ok(Map.of("message", "Đã duyệt nhân công thành công"));
        }

        // New flow: id is JobApplication ID
        Optional<JobApplication> appOpt = jobApplicationRepository.findById(id);
        if (appOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        JobApplication app = appOpt.get();
        if (!"PENDING".equals(app.getStatus())) {
            return ResponseEntity.badRequest().body("Hồ sơ này đã được xử lý");
        }

        User worker = app.getWorker();
        Farm farm = app.getPost().getFarm();

        int currentQuota = farm.getRecruitmentQuota() != null ? farm.getRecruitmentQuota() : 0;
        long currentWorkers = userRepository.findByRoleAndFarmIdAndApprovalStatus(UserRole.WORKER, farm.getId(), User.ApprovalStatus.APPROVED).size();
        if (currentQuota <= 0 || currentWorkers >= currentQuota) {
            return ResponseEntity.badRequest().body("Hạn mức tuyển dụng đã đầy (" + currentWorkers + "/" + currentQuota + ")");
        }

        worker.setFarmId(farm.getId());
        worker.setApprovalStatus(User.ApprovalStatus.APPROVED);
        worker.setIsActive(true);
        userRepository.save(worker);



        app.setStatus("ACCEPTED");
        jobApplicationRepository.save(app);

        recruitmentService.syncRecruitmentPostForFarm(farm);

        return ResponseEntity.ok(Map.of("message", "Đã duyệt nhân công thành công"));
    }

    /**
     * Reject a worker application (supports both JobApplication ID and legacy User ID)
     */
    @PostMapping("/reject/{id}")
    public ResponseEntity<?> rejectWorker(@PathVariable Long id, @RequestBody(required = false) Map<String, Object> payload) {
        Boolean isLegacy = payload != null && payload.get("isLegacy") != null && Boolean.TRUE.equals(payload.get("isLegacy"));

        if (isLegacy) {
            Optional<User> userOpt = userRepository.findById(id);
            if (userOpt.isEmpty()) return ResponseEntity.notFound().build();
            User worker = userOpt.get();
            worker.setApprovalStatus(User.ApprovalStatus.REJECTED);
            worker.setIsActive(false);
            userRepository.save(worker);
            return ResponseEntity.ok(Map.of("message", "Đã từ chối hồ sơ"));
        }

        Optional<JobApplication> appOpt = jobApplicationRepository.findById(id);
        if (appOpt.isEmpty()) return ResponseEntity.notFound().build();
        JobApplication app = appOpt.get();
        app.setStatus("REJECTED");
        jobApplicationRepository.save(app);
        return ResponseEntity.ok(Map.of("message", "Đã từ chối hồ sơ"));
    }

    /**
     * Dismiss a worker from a farm.
     * - Blocks if worker has active tasks (PENDING or IN_PROGRESS)
     * - Restores farm quota (+1)
     * - Records employment history
     */
    @PostMapping("/dismiss/{workerId}")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> dismissWorker(@PathVariable Long workerId) {
        log.info("Dismissing worker ID: {}", workerId);

        Optional<User> userOpt = userRepository.findById(workerId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User worker = userOpt.get();
        if (worker.getRole() != UserRole.WORKER) {
            return ResponseEntity.badRequest().body(Map.of("error", "Người dùng này không phải nhân công"));
        }

        Long farmId = worker.getFarmId();
        if (farmId == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Nhân công này không thuộc nông trại nào"));
        }

        // Check for active tasks
        long activeTasks = taskRepository.countByWorker_IdAndStatusIn(workerId, List.of("PENDING", "IN_PROGRESS"));
        if (activeTasks > 0) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Nhân công còn " + activeTasks + " công việc chưa hoàn thành. Hãy gỡ phân công hoặc hoàn thành trước khi đuổi việc."
            ));
        }

        // Record employment history
        EmploymentHistory history = EmploymentHistory.builder()
                .workerId(workerId)
                .farmId(farmId)
                .startedAt(worker.getCreatedAt())
                .endedAt(LocalDateTime.now())
                .reason("DISMISSED")
                .build();
        employmentHistoryRepository.save(history);

        // Fetch farm to sync recruitment post later
        Farm farm = farmRepository.findById(farmId).orElse(null);

        // Remove worker from farm
        worker.setFarmId(null);
        worker.setApprovalStatus(null);
        userRepository.save(worker);
        
        if (farm != null) {
            recruitmentService.syncRecruitmentPostForFarm(farm);
        }

        log.info("Worker {} dismissed from farm {}", workerId, farmId);
        return ResponseEntity.ok(Map.of("message", "Đã đuổi nhân công thành công. Hạn mức tuyển dụng đã được cập nhật."));
    }
}
