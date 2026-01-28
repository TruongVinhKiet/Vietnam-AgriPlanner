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
import java.util.List;
import java.util.Map;
import java.util.Objects;

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
        return ResponseEntity.ok(helpRequestRepository.findByWorker_IdOrderByCreatedAtDesc(workerId));
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
}
