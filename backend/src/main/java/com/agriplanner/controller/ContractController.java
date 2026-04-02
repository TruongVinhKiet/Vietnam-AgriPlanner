package com.agriplanner.controller;

import com.agriplanner.model.Contract;
import com.agriplanner.model.JobApplication;
import com.agriplanner.model.User;
import com.agriplanner.model.UserRole;
import com.agriplanner.model.Farm;
import com.agriplanner.repository.ContractRepository;
import com.agriplanner.repository.JobApplicationRepository;
import com.agriplanner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * REST Controller for Digital Contract signing workflow
 */
@Slf4j
@RestController
@RequestMapping("/api/contracts")
@RequiredArgsConstructor
@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:8000" })
@SuppressWarnings("null")
public class ContractController {

    private final ContractRepository contractRepository;
    private final JobApplicationRepository jobApplicationRepository;
    private final UserRepository userRepository;

    /**
     * POST /api/contracts
     * Owner creates a contract and signs it.
     * Body: { applicationId, contractContent, ownerSignature }
     * Status becomes PENDING_WORKER_SIGN
     */
    @PostMapping
    public ResponseEntity<?> createContract(@RequestBody Map<String, Object> payload) {
        Long applicationId = payload.get("applicationId") != null
                ? Long.valueOf(payload.get("applicationId").toString())
                : null;
        String contractContent = (String) payload.get("contractContent");
        String ownerSignature = (String) payload.get("ownerSignature");

        if (applicationId == null || contractContent == null || ownerSignature == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Thiếu thông tin bắt buộc"));
        }

        Optional<JobApplication> appOpt = jobApplicationRepository.findById(applicationId);
        if (appOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Không tìm thấy đơn ứng tuyển"));
        }

        JobApplication application = appOpt.get();
        if (!"ACCEPTED".equals(application.getStatus())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Đơn ứng tuyển chưa được duyệt"));
        }

        // Check if a contract already exists for this application
        Optional<Contract> existing = contractRepository.findByJobApplication_Id(applicationId);
        if (existing.isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Hợp đồng đã tồn tại cho đơn ứng tuyển này"));
        }

        Contract contract = Contract.builder()
                .jobApplication(application)
                .contractContent(contractContent)
                .ownerSignature(ownerSignature)
                .ownerSignedAt(LocalDateTime.now())
                .status("PENDING_WORKER_SIGN")
                .build();

        contractRepository.save(contract);

        log.info("Contract created for application {} with status PENDING_WORKER_SIGN", applicationId);
        return ResponseEntity.ok(toContractMap(contract));
    }

    /**
     * GET /api/contracts/application/{appId}
     * Get contract by JobApplication ID
     */
    @GetMapping("/application/{appId}")
    public ResponseEntity<?> getContractByApplication(@PathVariable Long appId) {
        Optional<Contract> contractOpt = contractRepository.findByJobApplication_Id(appId);
        if (contractOpt.isEmpty()) {
            return ResponseEntity.ok(Map.of("found", false));
        }
        Map<String, Object> result = toContractMap(contractOpt.get());
        result.put("found", true);
        return ResponseEntity.ok(result);
    }

    /**
     * PUT /api/contracts/{id}/sign-worker
     * Worker signs the contract.
     * Body: { workerSignature }
     * Status becomes COMPLETED
     */
    @PutMapping("/{id}/sign-worker")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> signWorker(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        String workerSignature = (String) payload.get("workerSignature");

        if (workerSignature == null || workerSignature.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Thiếu chữ ký của nhân công"));
        }

        Optional<Contract> contractOpt = contractRepository.findById(id);
        if (contractOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Contract contract = contractOpt.get();
        if (!"PENDING_WORKER_SIGN".equals(contract.getStatus())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Hợp đồng không ở trạng thái chờ ký"));
        }

        JobApplication app = contract.getJobApplication();
        User worker = app.getWorker();
        Farm farm = app.getPost().getFarm();

        // Check Quota again right before signing
        int currentQuota = farm.getRecruitmentQuota() != null ? farm.getRecruitmentQuota() : 0;
        long currentWorkers = userRepository
                .findByRoleAndFarmIdAndApprovalStatus(UserRole.WORKER, farm.getId(), User.ApprovalStatus.APPROVED)
                .size();
        if (currentQuota <= 0 || currentWorkers >= currentQuota) {
            return ResponseEntity.badRequest().body(Map.of("error", "Hạn mức tuyển dụng của trang trại đã đầy ("
                    + currentWorkers + "/" + currentQuota + "). Không thể vào làm."));
        }

        // Add the worker to the farm!
        worker.setFarmId(farm.getId());
        worker.setApprovalStatus(User.ApprovalStatus.APPROVED);
        worker.setIsActive(true);
        userRepository.save(worker);

        contract.setWorkerSignature(workerSignature);
        contract.setWorkerSignedAt(LocalDateTime.now());
        contract.setStatus("COMPLETED");
        contractRepository.save(contract);

        log.info("Contract {} signed by worker, status: COMPLETED. Worker {} joined Farm {}", id, worker.getId(),
                farm.getId());
        return ResponseEntity.ok(toContractMap(contract));
    }

    /**
     * GET /api/contracts/worker/{workerId}
     * Get all contracts for a worker
     */
    @GetMapping("/worker/{workerId}")
    public ResponseEntity<?> getContractsByWorker(@PathVariable Long workerId) {
        List<Contract> contracts = contractRepository.findByJobApplication_Worker_Id(workerId);
        List<Map<String, Object>> result = contracts.stream()
                .map(this::toContractMap)
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    /**
     * Helper: Convert Contract to a safe Map for JSON response
     */
    private Map<String, Object> toContractMap(Contract c) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", c.getId());
        map.put("contractContent", c.getContractContent());
        map.put("ownerSignature", c.getOwnerSignature());
        map.put("workerSignature", c.getWorkerSignature());
        map.put("ownerSignedAt", c.getOwnerSignedAt());
        map.put("workerSignedAt", c.getWorkerSignedAt());
        map.put("status", c.getStatus());
        map.put("createdAt", c.getCreatedAt());

        // Include application info
        if (c.getJobApplication() != null) {
            Map<String, Object> appMap = new HashMap<>();
            appMap.put("id", c.getJobApplication().getId());

            if (c.getJobApplication().getWorker() != null) {
                Map<String, Object> workerMap = new HashMap<>();
                workerMap.put("id", c.getJobApplication().getWorker().getId());
                workerMap.put("fullName", c.getJobApplication().getWorker().getFullName());
                workerMap.put("email", c.getJobApplication().getWorker().getEmail());
                appMap.put("worker", workerMap);
            }

            if (c.getJobApplication().getPost() != null) {
                Map<String, Object> postMap = new HashMap<>();
                postMap.put("id", c.getJobApplication().getPost().getId());
                postMap.put("title", c.getJobApplication().getPost().getTitle());
                if (c.getJobApplication().getPost().getFarm() != null) {
                    postMap.put("farmName", c.getJobApplication().getPost().getFarm().getName());
                }
                appMap.put("post", postMap);
            }

            map.put("application", appMap);
        }

        return map;
    }
}
