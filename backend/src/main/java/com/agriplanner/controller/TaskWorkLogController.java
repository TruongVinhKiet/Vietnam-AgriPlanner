package com.agriplanner.controller;

import com.agriplanner.model.Task;
import com.agriplanner.model.TaskWorkLog;
import com.agriplanner.model.User;
import com.agriplanner.repository.TaskRepository;
import com.agriplanner.repository.TaskWorkLogRepository;
import com.agriplanner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/worklogs")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@SuppressWarnings("null")
public class TaskWorkLogController {

    private final TaskWorkLogRepository taskWorkLogRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;

    @PostMapping("/start")
    public ResponseEntity<?> start(@RequestBody Map<String, Object> request) {
        try {
            Long taskId = Long.valueOf(request.get("taskId").toString());
            Long workerId = Long.valueOf(request.get("workerId").toString());
            String note = request.get("note") != null ? request.get("note").toString() : null;

            TaskWorkLog active = taskWorkLogRepository
                    .findFirstByTask_IdAndWorker_IdAndEndedAtIsNullOrderByStartedAtDesc(taskId, workerId);
            if (active != null) {
                return ResponseEntity.ok(active);
            }

            Task task = taskRepository.findById(Objects.requireNonNull(taskId))
                    .orElseThrow(() -> new RuntimeException("Task not found"));
            User worker = userRepository.findById(Objects.requireNonNull(workerId))
                    .orElseThrow(() -> new RuntimeException("Worker not found"));

            TaskWorkLog log = new TaskWorkLog();
            log.setTask(task);
            log.setWorker(worker);
            log.setStartedAt(LocalDateTime.now());
            log.setNote(note);

            return ResponseEntity.ok(taskWorkLogRepository.save(log));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/stop")
    public ResponseEntity<?> stop(@RequestBody Map<String, Object> request) {
        try {
            Long taskId = Long.valueOf(request.get("taskId").toString());
            Long workerId = Long.valueOf(request.get("workerId").toString());
            String note = request.get("note") != null ? request.get("note").toString() : null;

            TaskWorkLog active = taskWorkLogRepository
                    .findFirstByTask_IdAndWorker_IdAndEndedAtIsNullOrderByStartedAtDesc(taskId, workerId);
            if (active == null) {
                throw new RuntimeException("No active work log found");
            }

            LocalDateTime endedAt = LocalDateTime.now();
            active.setEndedAt(endedAt);

            if (active.getStartedAt() != null) {
                long minutes = Duration.between(active.getStartedAt(), endedAt).toMinutes();
                active.setDurationMinutes((int) Math.max(minutes, 0));
            }

            if (note != null) {
                active.setNote(note);
            }

            return ResponseEntity.ok(taskWorkLogRepository.save(active));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/task/{taskId}")
    public ResponseEntity<List<TaskWorkLog>> getByTask(@PathVariable Long taskId) {
        return ResponseEntity.ok(taskWorkLogRepository.findByTask_IdOrderByCreatedAtDesc(taskId));
    }

    @GetMapping("/worker/{workerId}")
    public ResponseEntity<List<TaskWorkLog>> getByWorker(@PathVariable Long workerId) {
        return ResponseEntity.ok(taskWorkLogRepository.findByWorker_IdOrderByCreatedAtDesc(workerId));
    }

    @GetMapping("/active")
    public ResponseEntity<?> getActive(@RequestParam Long taskId, @RequestParam Long workerId) {
        TaskWorkLog active = taskWorkLogRepository
                .findFirstByTask_IdAndWorker_IdAndEndedAtIsNullOrderByStartedAtDesc(taskId, workerId);
        return ResponseEntity.ok(active);
    }
}
