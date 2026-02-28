package com.agriplanner.controller;

import com.agriplanner.model.Farm;
import com.agriplanner.model.HelpRequest;
import com.agriplanner.model.User;
import com.agriplanner.repository.FarmRepository;
import com.agriplanner.repository.HelpRequestRepository;
import com.agriplanner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.security.core.Authentication;

@RestController
@RequestMapping("/api/help")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@SuppressWarnings("null")
public class HelpRequestController {

    private final HelpRequestRepository helpRequestRepository;
    private final UserRepository userRepository;
    private final FarmRepository farmRepository;

    @PostMapping
    public ResponseEntity<?> createHelpRequest(@RequestBody Map<String, Object> request) {
        try {
            Long ownerId = Long.valueOf(request.get("ownerId").toString());
            Long workerId = Long.valueOf(request.get("workerId").toString());
            Long farmId = request.get("farmId") != null ? Long.valueOf(request.get("farmId").toString()) : null;

            String title = request.get("title") != null ? request.get("title").toString() : null;
            String message = request.get("message") != null ? request.get("message").toString() : null;
            if (message == null || message.trim().isEmpty()) {
                throw new IllegalArgumentException("message is required");
            }

            User owner = userRepository.findById(Objects.requireNonNull(ownerId))
                    .orElseThrow(() -> new RuntimeException("Owner not found"));
            User worker = userRepository.findById(Objects.requireNonNull(workerId))
                    .orElseThrow(() -> new RuntimeException("Worker not found"));

            HelpRequest helpRequest = new HelpRequest();
            helpRequest.setOwner(owner);
            helpRequest.setWorker(worker);

            if (farmId != null) {
                Farm farm = farmRepository.findById(Objects.requireNonNull(farmId))
                        .orElseThrow(() -> new RuntimeException("Farm not found"));
                helpRequest.setFarm(farm);
            }

            helpRequest.setTitle(title);
            helpRequest.setMessage(message);
            helpRequest.setTargetType("OWNER");

            return ResponseEntity.ok(helpRequestRepository.save(helpRequest));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getHelpRequest(@PathVariable Long id) {
        try {
            HelpRequest helpRequest = helpRequestRepository.findById(Objects.requireNonNull(id))
                    .orElseThrow(() -> new RuntimeException("Help request not found"));
            return ResponseEntity.ok(helpRequest);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/worker/{workerId}")
    public ResponseEntity<List<HelpRequest>> getByWorker(@PathVariable Long workerId) {
        return ResponseEntity.ok(helpRequestRepository.findWorkerToOwnerRequests(workerId));
    }

    @GetMapping("/owner/{ownerId}")
    public ResponseEntity<List<HelpRequest>> getByOwner(@PathVariable Long ownerId) {
        return ResponseEntity.ok(helpRequestRepository.findByOwner_IdOrderByCreatedAtDesc(ownerId));
    }

    @GetMapping("/farm/{farmId}")
    public ResponseEntity<List<HelpRequest>> getByFarm(@PathVariable Long farmId) {
        return ResponseEntity.ok(helpRequestRepository.findByFarm_IdOrderByCreatedAtDesc(farmId));
    }

    @PutMapping("/{id}/respond")
    public ResponseEntity<?> respond(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        try {
            HelpRequest helpRequest = helpRequestRepository.findById(Objects.requireNonNull(id))
                    .orElseThrow(() -> new RuntimeException("Help request not found"));

            String ownerResponse = request.get("ownerResponse") != null ? request.get("ownerResponse").toString()
                    : null;
            if (ownerResponse == null || ownerResponse.trim().isEmpty()) {
                throw new IllegalArgumentException("ownerResponse is required");
            }

            String status = request.get("status") != null ? request.get("status").toString() : "RESPONDED";

            helpRequest.setOwnerResponse(ownerResponse);
            helpRequest.setStatus(status);
            helpRequest.setRespondedAt(LocalDateTime.now());

            return ResponseEntity.ok(helpRequestRepository.save(helpRequest));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/close")
    public ResponseEntity<?> close(@PathVariable Long id) {
        try {
            HelpRequest helpRequest = helpRequestRepository.findById(Objects.requireNonNull(id))
                    .orElseThrow(() -> new RuntimeException("Help request not found"));

            helpRequest.setStatus("CLOSED");
            helpRequest.setClosedAt(LocalDateTime.now());

            return ResponseEntity.ok(helpRequestRepository.save(helpRequest));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== ADMIN SUPPORT ENDPOINTS ====================

    /**
     * Tạo yêu cầu hỗ trợ gửi tới admin (từ worker hoặc owner)
     */
    @PostMapping("/admin")
    public ResponseEntity<?> createAdminHelpRequest(@RequestBody Map<String, Object> request,
                                                     Authentication authentication) {
        try {
            // Try to get senderId from body, fallback to JWT token
            Long senderId = null;
            if (request.get("senderId") != null && !request.get("senderId").toString().isEmpty()
                    && !"null".equals(request.get("senderId").toString())) {
                senderId = Long.valueOf(request.get("senderId").toString());
            }

            User sender = null;
            if (senderId != null) {
                sender = userRepository.findById(senderId).orElse(null);
            }

            // Fallback: use authenticated user from JWT token
            if (sender == null && authentication != null && authentication.getPrincipal() instanceof User) {
                sender = (User) authentication.getPrincipal();
            }

            if (sender == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Không xác định được người gửi"));
            }

            String senderRole = request.get("senderRole") != null ? request.get("senderRole").toString() : "WORKER";
            String title = request.get("title") != null ? request.get("title").toString() : null;
            String message = request.get("message") != null ? request.get("message").toString() : null;
            String requestType = request.get("requestType") != null ? request.get("requestType").toString() : null;
            Long farmId = request.get("farmId") != null ? Long.valueOf(request.get("farmId").toString()) : null;

            if (message == null || message.trim().isEmpty()) {
                throw new IllegalArgumentException("message is required");
            }

            HelpRequest helpRequest = new HelpRequest();
            helpRequest.setTargetType("ADMIN");
            helpRequest.setTitle(title);
            helpRequest.setMessage(message);
            helpRequest.setRequestType(requestType);

            // Set sender based on role
            if ("OWNER".equalsIgnoreCase(senderRole)) {
                helpRequest.setOwner(sender);
            } else {
                helpRequest.setWorker(sender);
            }

            if (farmId != null) {
                Farm farm = farmRepository.findById(farmId).orElse(null);
                helpRequest.setFarm(farm);
            }

            return ResponseEntity.ok(helpRequestRepository.save(helpRequest));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Lấy tất cả yêu cầu hỗ trợ gửi tới admin
     */
    @GetMapping("/admin/all")
    public ResponseEntity<?> getAllAdminRequests(@RequestParam(required = false) String status) {
        try {
            List<HelpRequest> requests;
            if (status != null && !status.isEmpty()) {
                requests = helpRequestRepository.findByTargetTypeAndStatusOrderByCreatedAtDesc("ADMIN", status);
            } else {
                requests = helpRequestRepository.findByTargetTypeOrderByCreatedAtDesc("ADMIN");
            }
            return ResponseEntity.ok(requests);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Lấy thống kê yêu cầu hỗ trợ admin
     */
    @GetMapping("/admin/stats")
    public ResponseEntity<?> getAdminSupportStats() {
        try {
            Map<String, Object> stats = new HashMap<>();
            stats.put("total", helpRequestRepository.countByTargetType("ADMIN"));
            stats.put("open", helpRequestRepository.countByTargetTypeAndStatus("ADMIN", "OPEN"));
            stats.put("responded", helpRequestRepository.countByTargetTypeAndStatus("ADMIN", "RESPONDED"));
            stats.put("closed", helpRequestRepository.countByTargetTypeAndStatus("ADMIN", "CLOSED"));
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Admin phản hồi yêu cầu hỗ trợ
     */
    @PutMapping("/admin/{id}/respond")
    public ResponseEntity<?> adminRespond(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        try {
            HelpRequest helpRequest = helpRequestRepository.findById(Objects.requireNonNull(id))
                    .orElseThrow(() -> new RuntimeException("Help request not found"));

            String adminResponse = request.get("adminResponse") != null ? request.get("adminResponse").toString()
                    : null;
            if (adminResponse == null || adminResponse.trim().isEmpty()) {
                throw new IllegalArgumentException("adminResponse is required");
            }

            String status = request.get("status") != null ? request.get("status").toString() : "RESPONDED";

            helpRequest.setAdminResponse(adminResponse);
            helpRequest.setStatus(status);
            helpRequest.setRespondedAt(LocalDateTime.now());

            return ResponseEntity.ok(helpRequestRepository.save(helpRequest));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Lấy yêu cầu hỗ trợ admin của worker cụ thể
     */
    @GetMapping("/admin/worker/{workerId}")
    public ResponseEntity<List<HelpRequest>> getAdminRequestsByWorker(@PathVariable Long workerId) {
        return ResponseEntity.ok(helpRequestRepository.findByWorker_IdAndTargetTypeOrderByCreatedAtDesc(workerId, "ADMIN"));
    }

    /**
     * Lấy yêu cầu hỗ trợ admin của owner cụ thể
     */
    @GetMapping("/admin/owner/{ownerId}")
    public ResponseEntity<List<HelpRequest>> getAdminRequestsByOwner(@PathVariable Long ownerId) {
        return ResponseEntity.ok(helpRequestRepository.findByOwner_IdAndTargetTypeOrderByCreatedAtDesc(ownerId, "ADMIN"));
    }

    /**
     * Lấy yêu cầu hỗ trợ admin của người dùng hiện tại (từ JWT token)
     */
    @GetMapping("/admin/my-requests")
    public ResponseEntity<?> getMyAdminRequests(Authentication authentication) {
        try {
            if (authentication == null || !(authentication.getPrincipal() instanceof User)) {
                return ResponseEntity.status(401).body(Map.of("error", "Chưa đăng nhập"));
            }
            User user = (User) authentication.getPrincipal();
            List<HelpRequest> requests;
            if ("OWNER".equalsIgnoreCase(user.getRole().name())) {
                requests = helpRequestRepository.findByOwner_IdAndTargetTypeOrderByCreatedAtDesc(user.getId(), "ADMIN");
            } else {
                requests = helpRequestRepository.findByWorker_IdAndTargetTypeOrderByCreatedAtDesc(user.getId(), "ADMIN");
            }
            return ResponseEntity.ok(requests);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
