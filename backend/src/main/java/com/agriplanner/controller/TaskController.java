package com.agriplanner.controller;

import com.agriplanner.dto.TaskRequest;
import com.agriplanner.model.*;
import com.agriplanner.repository.*;
import com.agriplanner.service.TaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/tasks")
@CrossOrigin(origins = "*")
public class TaskController {

    @Autowired
    private TaskService taskService;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private FarmRepository farmRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private FieldRepository fieldRepository;

    @Autowired
    private PenRepository penRepository;

    @Autowired
    private ShopItemRepository shopItemRepository;

    @Autowired
    private com.agriplanner.service.DailyAutoTaskScheduler dailyAutoTaskScheduler;

    @PostMapping("/generate-daily-auto")
    public ResponseEntity<?> generateDailyAutoTasks() {
        try {
            dailyAutoTaskScheduler.generateDailyAutoTasks();
            return ResponseEntity.ok("Daily tasks generated successfully");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }

    @PostMapping
    public ResponseEntity<?> assignTask(@RequestBody TaskRequest request) {
        try {
            Task task = new Task();

            // Fetch dependencies
            if (request.getFarmId() == null)
                throw new IllegalArgumentException("Farm ID is required");
            Farm farm = farmRepository.findById(Objects.requireNonNull(request.getFarmId()))
                    .orElseThrow(() -> new RuntimeException("Farm not found"));

            if (request.getOwnerId() == null)
                throw new IllegalArgumentException("Owner ID is required");
            User owner = userRepository.findById(Objects.requireNonNull(request.getOwnerId()))
                    .orElseThrow(() -> new RuntimeException("Owner not found"));

            task.setFarm(farm);
            task.setOwner(owner);

            if (request.getWorkerId() != null) {
                User worker = userRepository.findById(Objects.requireNonNull(request.getWorkerId()))
                        .orElseThrow(() -> new RuntimeException("Worker not found"));
                task.setWorker(worker);
            }

            if (request.getFieldId() != null) {
                Field field = fieldRepository.findById(Objects.requireNonNull(request.getFieldId())).orElse(null);
                task.setField(field);
            }

            if (request.getPenId() != null) {
                Pen pen = penRepository.findById(Objects.requireNonNull(request.getPenId())).orElse(null);
                task.setPen(pen);
            }

            task.setName(request.getName());
            task.setDescription(request.getDescription());
            task.setPriority(request.getPriority() != null ? request.getPriority() : "NORMAL");
            task.setTaskType(request.getTaskType() != null ? request.getTaskType() : TaskType.OTHER);

            if (request.getRelatedShopItemId() != null) {
                Long itemId = request.getRelatedShopItemId();
                ShopItem item = shopItemRepository.findById(Objects.requireNonNull(itemId)).orElse(null);
                task.setRelatedItem(item);
            }

            task.setQuantityRequired(request.getQuantityRequired());
            task.setSalary(request.getSalary());
            task.setDueDate(request.getDueDate());

            Task savedTask = taskService.assignTask(task);
            return ResponseEntity.ok(savedTask);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }

    @PostMapping("/{id}/complete")
    public ResponseEntity<?> completeTask(@PathVariable Long id,
            @RequestBody(required = false) Map<String, String> request) {
        try {
            String condition = request != null ? request.get("condition") : null;
            String aiSuggestion = request != null ? request.get("aiSuggestion") : null;
            taskService.completeTask(id, condition, aiSuggestion);
            return ResponseEntity.ok().body(Map.of("message", "Task completed successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/assign")
    public ResponseEntity<?> updateTaskAssignment(@PathVariable Long id, @RequestBody TaskRequest request) {
        try {
            if (request.getOwnerId() == null) {
                throw new IllegalArgumentException("Owner ID is required");
            }

            Task task = taskRepository.findById(Objects.requireNonNull(id))
                    .orElseThrow(() -> new RuntimeException("Task not found"));

            Long taskOwnerId = task.getOwner() != null ? task.getOwner().getId() : null;
            if (taskOwnerId == null || !Objects.equals(taskOwnerId, request.getOwnerId())) {
                throw new IllegalStateException("Not allowed");
            }

            if (request.getWorkerId() == null) {
                task.setWorker(null);
            } else if (Objects.equals(request.getWorkerId(), request.getOwnerId())) {
                User owner = userRepository.findById(Objects.requireNonNull(request.getOwnerId()))
                        .orElseThrow(() -> new RuntimeException("Owner not found"));
                task.setWorker(owner);
            } else {
                User worker = userRepository.findById(Objects.requireNonNull(request.getWorkerId()))
                        .orElseThrow(() -> new RuntimeException("Worker not found"));

                Long farmId = task.getFarm() != null ? task.getFarm().getId() : null;
                if (farmId == null) {
                    throw new IllegalStateException("Farm ID missing");
                }
                if (worker.getFarmId() == null || !Objects.equals(worker.getFarmId(), farmId)) {
                    throw new IllegalArgumentException("Worker is not in this farm");
                }
                if (worker.getApprovalStatus() != User.ApprovalStatus.APPROVED) {
                    throw new IllegalArgumentException("Worker not approved");
                }
                if (worker.getRole() != UserRole.WORKER) {
                    throw new IllegalArgumentException("User is not a worker");
                }

                task.setWorker(worker);
            }

            if (request.getPriority() != null && !request.getPriority().isBlank()) {
                task.setPriority(request.getPriority());
            }

            if (request.getDueDate() != null) {
                task.setDueDate(request.getDueDate());
            }

            Task saved = taskRepository.save(task);
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }

    @GetMapping("/worker/{workerId}")
    public List<Task> getWorkerTasks(@PathVariable Long workerId) {
        return taskService.getWorkerTasks(workerId);
    }

    @GetMapping("/owner/{ownerId}")
    public List<Task> getOwnerTasks(@PathVariable Long ownerId) {
        return taskService.getOwnerTasks(ownerId);
    }
}
