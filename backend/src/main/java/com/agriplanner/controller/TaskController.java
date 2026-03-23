package com.agriplanner.controller;

import com.agriplanner.dto.TaskRequest;
import com.agriplanner.model.*;
import com.agriplanner.repository.*;
import com.agriplanner.service.TaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@RestController
@RequestMapping("/api/tasks")
@CrossOrigin(origins = "*")
@SuppressWarnings("null")
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

    @Autowired
    private EpicRepository epicRepository;

    @Autowired
    private TaskChecklistRepository taskChecklistRepository;

    @Autowired
    private TaskCommentRepository taskCommentRepository;

    @Autowired
    private TaskWorkLogRepository taskWorkLogRepository;

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

            // Epic (Season) assignment
            if (request.getEpicId() != null) {
                Epic epic = epicRepository.findById(request.getEpicId()).orElse(null);
                task.setEpic(epic);
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
            task.setWorkflowData(request.getWorkflowData());

            // Auto-fill startDate = now if not provided
            task.setStartDate(LocalDateTime.now());

            // Auto-fill dueDate = startDate + 2 hours if not provided
            if (request.getDueDate() != null) {
                task.setDueDate(request.getDueDate());
            } else {
                task.setDueDate(task.getStartDate().plusHours(2));
            }

            // Harvest workflow fields
            task.setHarvestCategory(request.getHarvestCategory());
            task.setHarvestProductName(request.getHarvestProductName());
            task.setHarvestProductUnit(request.getHarvestProductUnit());
            task.setHarvestRefPrice(request.getHarvestRefPrice());

            Task savedTask = taskService.assignTask(task);

            // Create checklist items if provided
            if (request.getChecklistItems() != null && !request.getChecklistItems().isEmpty()) {
                List<TaskChecklist> checklists = new ArrayList<>();
                int order = 0;
                for (String item : request.getChecklistItems()) {
                    if (item != null && !item.trim().isEmpty()) {
                        TaskChecklist cl = TaskChecklist.builder()
                                .task(savedTask)
                                .description(item.trim())
                                .isCompleted(false)
                                .sortOrder(order++)
                                .build();
                        checklists.add(cl);
                    }
                }
                if (!checklists.isEmpty()) {
                    taskChecklistRepository.saveAll(checklists);
                }
            }

            return ResponseEntity.ok(savedTask);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }

    @PostMapping("/{id}/start")
    public ResponseEntity<?> startTask(@PathVariable Long id) {
        try {
            Task task = taskRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Task not found"));

            if (!"PENDING".equalsIgnoreCase(task.getStatus()) && !"PAUSED".equalsIgnoreCase(task.getStatus())) {
                return ResponseEntity.badRequest().body(Map.of("error", "Task phải ở trạng thái Chờ xử lý hoặc Tạm dừng để bắt đầu"));
            }

            LocalDateTime now = LocalDateTime.now();

            // Set startedAt only on first transition
            if (task.getStartedAt() == null) {
                task.setStartedAt(now);
            }

            task.setStatus("IN_PROGRESS");
            taskRepository.save(task);

            // Log status change in TaskWorkLog
            TaskWorkLog log = TaskWorkLog.builder()
                    .task(task)
                    .worker(task.getWorker())
                    .startedAt(now)
                    .status("IN_PROGRESS")
                    .build();
            taskWorkLogRepository.save(log);

            return ResponseEntity.ok().body(Map.of("message", "Đã bắt đầu công việc", "startedAt", now.toString()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // === PAUSE (Báo sự cố) ===
    @PostMapping("/{id}/pause")
    public ResponseEntity<?> pauseTask(@PathVariable Long id, @RequestBody(required = false) Map<String, String> request) {
        try {
            Task task = taskRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Task not found"));

            if (!"IN_PROGRESS".equalsIgnoreCase(task.getStatus())) {
                return ResponseEntity.badRequest().body(Map.of("error", "Chỉ có thể tạm dừng công việc đang thực hiện"));
            }

            LocalDateTime now = LocalDateTime.now();
            String reason = request != null ? request.getOrDefault("reason", "Báo sự cố") : "Báo sự cố";

            task.setStatus("PAUSED");
            taskRepository.save(task);

            // Close previous IN_PROGRESS log
            TaskWorkLog openLog = taskWorkLogRepository.findFirstByTask_IdAndWorker_IdAndEndedAtIsNullOrderByStartedAtDesc(
                    task.getId(), task.getWorker() != null ? task.getWorker().getId() : 0L);
            if (openLog != null) {
                openLog.setEndedAt(now);
                long minutes = java.time.Duration.between(openLog.getStartedAt(), now).toMinutes();
                openLog.setDurationMinutes((int) minutes);
                taskWorkLogRepository.save(openLog);
            }

            // Create PAUSED log entry
            TaskWorkLog pauseLog = TaskWorkLog.builder()
                    .task(task)
                    .worker(task.getWorker())
                    .startedAt(now)
                    .status("PAUSED")
                    .note(reason)
                    .build();
            taskWorkLogRepository.save(pauseLog);

            return ResponseEntity.ok().body(Map.of("message", "Đã tạm dừng công việc", "reason", reason));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/complete")
    public ResponseEntity<?> completeTask(@PathVariable Long id,
            @RequestBody(required = false) Map<String, String> request) {
        try {
            Task task = taskRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Task not found"));

            // HARD CONSTRAINT: Must go through IN_PROGRESS first
            if (task.getStartedAt() == null) {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "Bạn phải bấm \"Đang tiến hành\" trước khi hoàn thành công việc",
                        "code", "MUST_START_FIRST"
                ));
            }

            // Check checklist completion
            long totalChecklist = taskChecklistRepository.countByTask_Id(id);
            if (totalChecklist > 0) {
                long completedChecklist = taskChecklistRepository.countByTask_IdAndIsCompletedTrue(id);
                if (completedChecklist < totalChecklist) {
                    return ResponseEntity.badRequest().body(Map.of(
                            "error", "Bạn cần hoàn thành tất cả " + totalChecklist + " mục kiểm tra trước khi báo cáo hoàn thành (hiện tại: " + completedChecklist + "/" + totalChecklist + ")",
                            "code", "CHECKLIST_INCOMPLETE",
                            "completed", completedChecklist,
                            "total", totalChecklist
                    ));
                }
            }

            String condition = request != null ? request.get("condition") : null;
            String aiSuggestion = request != null ? request.get("aiSuggestion") : null;
            taskService.completeTask(id, condition, aiSuggestion);

            // Close any open work log
            LocalDateTime now = LocalDateTime.now();
            if (task.getWorker() != null) {
                TaskWorkLog openLog = taskWorkLogRepository.findFirstByTask_IdAndWorker_IdAndEndedAtIsNullOrderByStartedAtDesc(
                        task.getId(), task.getWorker().getId());
                if (openLog != null) {
                    openLog.setEndedAt(now);
                    long minutes = java.time.Duration.between(openLog.getStartedAt(), now).toMinutes();
                    openLog.setDurationMinutes((int) minutes);
                    taskWorkLogRepository.save(openLog);
                }

                // Create COMPLETED log
                TaskWorkLog completeLog = TaskWorkLog.builder()
                        .task(task)
                        .worker(task.getWorker())
                        .startedAt(now)
                        .endedAt(now)
                        .durationMinutes(0)
                        .status("COMPLETED")
                        .build();
                taskWorkLogRepository.save(completeLog);
            }

            // Save media URLs if provided
            if (request != null) {
                Task updatedTask = taskRepository.findById(id).orElse(null);
                if (updatedTask != null) {
                    String imgUrl = request.get("reportImageUrl");
                    String vidUrl = request.get("reportVideoUrl");
                    if (imgUrl != null && !imgUrl.isBlank())
                        updatedTask.setReportImageUrl(imgUrl);
                    if (vidUrl != null && !vidUrl.isBlank())
                        updatedTask.setReportVideoUrl(vidUrl);
                    taskRepository.save(updatedTask);
                }
            }

            return ResponseEntity.ok().body(Map.of("message", "Đã hoàn thành công việc"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<?> approveTask(@PathVariable Long id) {
        try {
            Map<String, Object> result = taskService.approveTask(id);
            return ResponseEntity.ok(result);
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

    // ==================== CHECKLIST APIs ====================

    @GetMapping("/{taskId}/checklists")
    public ResponseEntity<?> getChecklists(@PathVariable Long taskId) {
        return ResponseEntity.ok(taskChecklistRepository.findByTask_IdOrderBySortOrderAsc(taskId));
    }

    @PostMapping("/{taskId}/checklists")
    public ResponseEntity<?> addChecklist(@PathVariable Long taskId, @RequestBody Map<String, String> request) {
        try {
            Task task = taskRepository.findById(taskId)
                    .orElseThrow(() -> new RuntimeException("Task not found"));
            String description = request.get("description");
            if (description == null || description.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Mô tả không được để trống"));
            }
            long count = taskChecklistRepository.countByTask_Id(taskId);
            TaskChecklist cl = TaskChecklist.builder()
                    .task(task)
                    .description(description.trim())
                    .isCompleted(false)
                    .sortOrder((int) count)
                    .build();
            return ResponseEntity.ok(taskChecklistRepository.save(cl));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/checklists/{checklistId}")
    public ResponseEntity<?> toggleChecklist(@PathVariable Long checklistId) {
        try {
            TaskChecklist cl = taskChecklistRepository.findById(checklistId)
                    .orElseThrow(() -> new RuntimeException("Checklist item not found"));
            cl.setIsCompleted(!cl.getIsCompleted());
            return ResponseEntity.ok(taskChecklistRepository.save(cl));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/checklists/{checklistId}")
    public ResponseEntity<?> deleteChecklist(@PathVariable Long checklistId) {
        try {
            taskChecklistRepository.deleteById(checklistId);
            return ResponseEntity.ok(Map.of("message", "Đã xóa mục kiểm tra"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== COMMENT APIs ====================

    @GetMapping("/{taskId}/comments")
    public ResponseEntity<?> getComments(@PathVariable Long taskId) {
        return ResponseEntity.ok(taskCommentRepository.findByTask_IdOrderByCreatedAtAsc(taskId));
    }

    @PostMapping("/{taskId}/comments")
    public ResponseEntity<?> addComment(@PathVariable Long taskId, @RequestBody Map<String, Object> request) {
        try {
            Task task = taskRepository.findById(taskId)
                    .orElseThrow(() -> new RuntimeException("Task not found"));
            Long authorId = Long.valueOf(request.get("authorId").toString());
            User author = userRepository.findById(authorId)
                    .orElseThrow(() -> new RuntimeException("User not found"));
            String content = (String) request.get("content");
            if (content == null || content.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Nội dung không được để trống"));
            }
            String imageUrl = request.get("imageUrl") != null ? request.get("imageUrl").toString() : null;

            TaskComment comment = TaskComment.builder()
                    .task(task)
                    .author(author)
                    .content(content.trim())
                    .imageUrl(imageUrl)
                    .build();
            return ResponseEntity.ok(taskCommentRepository.save(comment));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== EPIC (Season) APIs ====================

    @GetMapping("/epics/farm/{farmId}")
    public ResponseEntity<?> getEpicsByFarm(@PathVariable Long farmId) {
        return ResponseEntity.ok(epicRepository.findByFarm_IdOrderByCreatedAtDesc(farmId));
    }

    @GetMapping("/epics/farm/{farmId}/active")
    public ResponseEntity<?> getActiveEpicsByFarm(@PathVariable Long farmId) {
        return ResponseEntity.ok(epicRepository.findByFarm_IdAndStatusOrderByCreatedAtDesc(farmId, "ACTIVE"));
    }

    @PostMapping("/epics")
    public ResponseEntity<?> createEpic(@RequestBody Map<String, Object> request) {
        try {
            Long farmId = Long.valueOf(request.get("farmId").toString());
            Farm farm = farmRepository.findById(farmId)
                    .orElseThrow(() -> new RuntimeException("Farm not found"));
            String name = (String) request.get("name");
            if (name == null || name.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Tên mùa vụ không được để trống"));
            }

            Epic epic = Epic.builder()
                    .farm(farm)
                    .name(name.trim())
                    .description(request.get("description") != null ? request.get("description").toString() : null)
                    .status("ACTIVE")
                    .build();

            if (request.get("startDate") != null) {
                epic.setStartDate(LocalDateTime.parse(request.get("startDate").toString()));
            }
            if (request.get("expectedEndDate") != null) {
                epic.setExpectedEndDate(LocalDateTime.parse(request.get("expectedEndDate").toString()));
            }

            return ResponseEntity.ok(epicRepository.save(epic));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/epics/{epicId}")
    public ResponseEntity<?> updateEpic(@PathVariable Long epicId, @RequestBody Map<String, Object> request) {
        try {
            Epic epic = epicRepository.findById(epicId)
                    .orElseThrow(() -> new RuntimeException("Epic not found"));
            if (request.get("name") != null) epic.setName(request.get("name").toString());
            if (request.get("description") != null) epic.setDescription(request.get("description").toString());
            if (request.get("status") != null) epic.setStatus(request.get("status").toString());
            if (request.get("startDate") != null) epic.setStartDate(LocalDateTime.parse(request.get("startDate").toString()));
            if (request.get("expectedEndDate") != null) epic.setExpectedEndDate(LocalDateTime.parse(request.get("expectedEndDate").toString()));
            return ResponseEntity.ok(epicRepository.save(epic));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== WORK LOG (Timeline Data) ====================

    @GetMapping("/{taskId}/work-logs")
    public ResponseEntity<?> getTaskWorkLogs(@PathVariable Long taskId) {
        return ResponseEntity.ok(taskWorkLogRepository.findByTask_IdOrderByCreatedAtDesc(taskId));
    }

    // ==================== MEDIA UPLOAD ====================

    @PostMapping(value = "/{id}/upload-media", consumes = "multipart/form-data")
    public ResponseEntity<?> uploadMedia(@PathVariable Long id,
            @RequestParam("file") MultipartFile file) {
        try {
            Task task = taskRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Task not found"));

            String originalName = file.getOriginalFilename();
            if (originalName == null)
                originalName = "file";
            // Sanitize filename
            String safeName = originalName.replaceAll("[^a-zA-Z0-9._-]", "_");
            String uniqueName = UUID.randomUUID().toString().substring(0, 8) + "_" + safeName;

            // Determine sub-directory based on content type
            String contentType = file.getContentType();
            boolean isVideo = contentType != null && contentType.startsWith("video");
            String subDir = isVideo ? "videos" : "images";

            Path uploadDir = Paths.get(System.getProperty("user.dir"), "uploads", "tasks", subDir).toAbsolutePath()
                    .normalize();
            Files.createDirectories(uploadDir);
            Path filePath = uploadDir.resolve(uniqueName);
            file.transferTo(filePath.toFile());

            String url = "/uploads/tasks/" + subDir + "/" + uniqueName;

            // Also save URL to task
            if (isVideo) {
                task.setReportVideoUrl(url);
            } else {
                task.setReportImageUrl(url);
            }
            taskRepository.save(task);

            return ResponseEntity.ok(Map.of("url", url, "filename", originalName));
        } catch (IOException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "File upload failed: " + e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== DELETE PENDING TASK ====================

    @DeleteMapping("/{id}")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> deletePendingTask(@PathVariable Long id) {
        try {
            Task task = taskRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy công việc"));

            if (!"PENDING".equalsIgnoreCase(task.getStatus())) {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "Chỉ có thể xóa công việc ở trạng thái Chờ xử lý (PENDING)"));
            }

            // Delete comments first (no cascade from Task side)
            taskCommentRepository.deleteByTask_Id(id);

            // Delete task (checklists + workLogs cascade automatically via JPA)
            taskRepository.delete(task);

            return ResponseEntity.ok(Map.of("message", "Đã xóa công việc thành công"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
