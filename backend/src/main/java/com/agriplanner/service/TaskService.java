package com.agriplanner.service;

import com.agriplanner.model.*;
import com.agriplanner.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Objects;

@Service
@SuppressWarnings({"null"})
public class TaskService {
    @SuppressWarnings("unused")
    private static final String __INTERNAL_SIGNATURE = "AGRIPLANNER-TVK-2026-TNL-TK4L6";

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private UserInventoryRepository userInventoryRepository;

    @Autowired
    private ShopItemRepository shopItemRepository;

    @Autowired
    private WalletService walletService;

    @Autowired
    private FieldService fieldService;

    @Autowired
    private PenRepository penRepository;

    @Autowired
    private FeedingLogRepository feedingLogRepository;

    @Autowired
    private FeedDefinitionRepository feedDefinitionRepository;

    @Autowired
    private AnimalFeedCompatibilityRepository animalFeedCompatibilityRepository;

    @Autowired
    private HealthRecordRepository healthRecordRepository;

    @Autowired
    private ByproductLogRepository byproductLogRepository;

    @Autowired
    private AssetService assetService;

    @Autowired
    private InventoryTransactionRepository inventoryTransactionRepository;

    @Autowired
    private FarmRepository farmRepository;

    @Autowired
    private UserRepository userRepository;

    @Transactional
    public Task assignTask(Task task) {
        // Smart Logic: Check Inventory if task requires items and is NOT a buy task
        if (task.getTaskType() != TaskType.BUY_SUPPLIES &&
                task.getRelatedItem() != null &&
                task.getQuantityRequired() != null &&
                task.getQuantityRequired().compareTo(BigDecimal.ZERO) > 0) {

            ShopItem shopItem = shopItemRepository.findById(Objects.requireNonNull(task.getRelatedItem().getId()))
                    .orElseThrow(() -> new RuntimeException("Shop Item not found"));

            // Check User Inventory (Owner's inventory)
            if (task.getOwner() == null || task.getOwner().getId() == null)
                throw new IllegalArgumentException("Owner ID missing");
            Long ownerId = task.getOwner().getId();

            // Direct lookup for specific item stock
            Optional<UserInventory> inventoryItem = userInventoryRepository.findByUserIdAndShopItemId(ownerId,
                    shopItem.getId());
            BigDecimal totalStock = inventoryItem.map(UserInventory::getQuantity).orElse(BigDecimal.ZERO);

            if (totalStock.compareTo(task.getQuantityRequired()) < 0) {
                BigDecimal shortage = task.getQuantityRequired().subtract(totalStock);

                // Create Auto-Buy Task
                Task buyTask = new Task();
                buyTask.setFarm(task.getFarm());
                buyTask.setOwner(task.getOwner());
                buyTask.setWorker(task.getWorker()); // Assign to same worker
                buyTask.setField(task.getField());
                buyTask.setPen(task.getPen());
                buyTask.setName("Mua vật tư: " + shopItem.getName());
                buyTask.setDescription(
                        "Hệ thống tự tạo: Mua thêm " + shortage + " " + shopItem.getUnit() + " để đủ làm nhiệm vụ.");
                buyTask.setTaskType(TaskType.BUY_SUPPLIES);
                buyTask.setPriority("HIGH");
                buyTask.setStatus("PENDING");
                buyTask.setRelatedItem(shopItem);
                buyTask.setQuantityRequired(shortage);
                buyTask.setIsAutoCreated(true);

                // Ensure BUY_SUPPLIES has a dueDate so auto-assignment can work.
                java.time.LocalDateTime now = java.time.LocalDateTime.now();
                java.time.LocalDateTime buyDue;
                if (task.getDueDate() != null) {
                    java.time.LocalDateTime candidate = task.getDueDate().minusMinutes(30);
                    buyDue = candidate.isAfter(now) ? candidate : task.getDueDate();
                } else {
                    buyDue = now.plusMinutes(30);
                }
                buyTask.setDueDate(buyDue);

                taskRepository.save(buyTask);

                // Mark original task description
                task.setDescription((task.getDescription() != null ? task.getDescription() : "") + " [Chờ mua vật tư]");
            }
        }

        return taskRepository.save(task);
    }

    @Transactional
    public void completeTask(Long taskId) {
        completeTask(taskId, null, null);
    }

    @Transactional
    public void completeTask(Long taskId, String condition, String aiSuggestion) {
        Task task = taskRepository.findById(Objects.requireNonNull(taskId))
                .orElseThrow(() -> new RuntimeException("Task not found"));

        applyInspectionUpdateIfNeeded(task, condition, aiSuggestion);

        if (task.getTaskType() == TaskType.BUY_SUPPLIES) {
            // Execute Buy
            ShopItem item = task.getRelatedItem();
            if (item == null) {
                throw new RuntimeException("Shop Item missing");
            }
            if (task.getQuantityRequired() == null) {
                throw new RuntimeException("Quantity required missing");
            }

            BigDecimal cost = item.getPrice().multiply(task.getQuantityRequired());

            // Deduct from Owner
            if (task.getOwner() == null || task.getOwner().getId() == null) {
                throw new RuntimeException("Owner ID missing");
            }
            walletService.deductFunds(task.getOwner().getId(), cost, "Chi phí mua vật tư (Worker: "
                    + (task.getWorker() != null ? task.getWorker().getFullName() : "Unknown") + ")");

            // Add to Inventory (Owner's inventory)
            UserInventory ui = userInventoryRepository.findByUserIdAndShopItemId(task.getOwner().getId(), item.getId())
                    .orElse(new UserInventory(task.getOwner().getId(), item, BigDecimal.ZERO));

            ui.addQuantity(task.getQuantityRequired());
            userInventoryRepository.save(ui);
        } else {
            // Normal task Logic (Deduct inventory if needed)
            // Skip deduction for workflow tasks - will be deducted on approval
            if (task.getWorkflowData() == null || task.getWorkflowData().isBlank()) {
                if (task.getRelatedItem() != null && task.getQuantityRequired() != null) {
                    ShopItem item = task.getRelatedItem();

                    if (task.getOwner() == null || task.getOwner().getId() == null) {
                        throw new RuntimeException("Owner ID missing");
                    }

                    // Find inventory to deduct
                    Optional<UserInventory> uiOpt = userInventoryRepository
                            .findByUserIdAndShopItemId(task.getOwner().getId(), item.getId());

                    if (uiOpt.isEmpty() || uiOpt.get().getQuantity().compareTo(task.getQuantityRequired()) < 0) {
                        UserInventory ui = uiOpt
                                .orElseThrow(() -> new RuntimeException("Không tìm thấy vật tư trong kho!"));
                        if (!ui.subtractQuantity(task.getQuantityRequired())) {
                            throw new RuntimeException("Không đủ vật tư để hoàn thành (Còn thiếu)!");
                        }
                        userInventoryRepository.save(ui);
                    } else {
                        UserInventory ui = uiOpt.get();
                        ui.subtractQuantity(task.getQuantityRequired());
                        userInventoryRepository.save(ui);
                    }
                }
            }
        }

        task.setStatus("COMPLETED");
        task.setCompletedAt(java.time.LocalDateTime.now());
        taskRepository.save(task);
    }

    private void applyInspectionUpdateIfNeeded(Task task, String condition, String aiSuggestion) {
        if (task == null) {
            return;
        }
        if (aiSuggestion != null && !aiSuggestion.isBlank()) {
            String existing = task.getDescription() != null ? task.getDescription() : "";
            String suffix = "AI: " + aiSuggestion.trim();
            if (existing.isBlank()) {
                task.setDescription(suffix);
            } else {
                task.setDescription(existing + "\n" + suffix);
            }
        }

        if (condition == null || condition.isBlank()) {
            return;
        }

        if (task.getTaskType() != TaskType.OTHER) {
            return;
        }

        String normalized = condition.trim().toUpperCase();

        if (task.getField() != null && task.getField().getId() != null) {
            fieldService.updateFieldCondition(task.getField().getId(), normalized);
            return;
        }

        if (task.getPen() != null && task.getPen().getId() != null) {
            if (!"CLEAN".equals(normalized) && !"DIRTY".equals(normalized) && !"SICK".equals(normalized)
                    && !"EMPTY".equals(normalized)) {
                throw new IllegalArgumentException("Invalid pen status: " + condition);
            }

            Long penId = Objects.requireNonNull(task.getPen().getId());
            Pen pen = penRepository.findById(penId)
                    .orElseThrow(() -> new RuntimeException("Pen not found"));
            pen.setStatus(normalized);
            penRepository.save(pen);
        }
    }

    public List<Task> getWorkerTasks(Long workerId) {
        if (workerId == null) {
            throw new IllegalArgumentException("Worker ID is required");
        }
        return taskRepository.findByWorker_Id(workerId);
    }

    public List<Task> getOwnerTasks(Long ownerId) {
        if (ownerId == null) {
            throw new IllegalArgumentException("Owner ID is required");
        }
        return taskRepository.findByOwner_Id(ownerId);
    }

    public Task getTask(Long id) {
        return taskRepository.findById(Objects.requireNonNull(id)).orElse(null);
    }

    // ==================== TASK APPROVAL (Workflow-based) ====================

    @Transactional
    public Map<String, Object> approveTask(Long taskId) {
        Task task = taskRepository.findById(Objects.requireNonNull(taskId))
                .orElseThrow(() -> new RuntimeException("Task not found"));

        if (!"COMPLETED".equals(task.getStatus())) {
            throw new IllegalStateException("Chỉ có thể duyệt task đã hoàn thành. Trạng thái hiện tại: " + task.getStatus());
        }

        String workflowData = task.getWorkflowData();
        if (workflowData == null || workflowData.isBlank()) {
            // Non-workflow task: just approve without executing workflow
            task.setStatus("APPROVED");
            task.setApprovedAt(LocalDateTime.now());
            taskRepository.save(task);
            return Map.of("message", "Task approved", "taskId", taskId);
        }

        // Parse workflow data
        Map<String, Object> data = parseWorkflowData(workflowData);
        TaskType taskType = task.getTaskType();

        try {
            Map<String, Object> result = new java.util.HashMap<>();
            result.put("taskId", taskId);

            if (task.getField() != null && task.getField().getId() != null) {
                // CULTIVATION WORKFLOW
                Long fieldId = task.getField().getId();
                executeCultivationWorkflow(taskType, fieldId, data, result);
            } else if (task.getPen() != null && task.getPen().getId() != null) {
                // LIVESTOCK WORKFLOW
                Long penId = task.getPen().getId();
                executeLivestockWorkflow(taskType, penId, data, task, result);
            }

            // Deduct inventory if task has related item
            if (task.getRelatedItem() != null && task.getQuantityRequired() != null
                    && task.getQuantityRequired().compareTo(BigDecimal.ZERO) > 0
                    && task.getOwner() != null) {
                deductInventoryOnApproval(task);
            }

            task.setStatus("APPROVED");
            task.setApprovedAt(LocalDateTime.now());
            taskRepository.save(task);

            result.put("message", "Task approved and workflow executed");
            return result;
        } catch (Exception e) {
            throw new RuntimeException("Lỗi khi duyệt task: " + e.getMessage(), e);
        }
    }

    private void executeCultivationWorkflow(TaskType taskType, Long fieldId, Map<String, Object> data, Map<String, Object> result) {
        switch (taskType) {
            case FERTILIZE -> {
                Long fertilizerId = toLong(data.get("fertilizerId"));
                BigDecimal cost = toBigDecimal(data.get("cost"));
                Field field = fieldService.fertilizeField(fieldId, fertilizerId, cost);
                result.put("field", field);
            }
            case SEED -> {
                BigDecimal quantity = toBigDecimal(data.get("quantity"));
                BigDecimal cost = toBigDecimal(data.get("cost"));
                Field field = fieldService.seedField(fieldId, quantity, cost);
                result.put("field", field);
            }
            case WATER -> {
                Field field = fieldService.waterField(fieldId);
                result.put("field", field);
            }
            case PEST_CONTROL -> {
                String pesticideName = (String) data.getOrDefault("pesticideName", "Thuốc trừ sâu");
                BigDecimal cost = toBigDecimal(data.get("cost"));
                Field field = fieldService.applyPesticide(fieldId, pesticideName, cost);
                result.put("field", field);
            }
            case HARVEST -> {
                Long machineryId = toLong(data.get("machineryId"));
                BigDecimal machineCost = toBigDecimal(data.get("machineCost"));
                Map<String, Object> harvestResult = fieldService.startHarvest(fieldId, machineryId, machineCost);
                result.putAll(harvestResult);
            }
            default -> { /* no-op for non-workflow types */ }
        }
    }

    private void executeLivestockWorkflow(TaskType taskType, Long penId, Map<String, Object> data, Task task, Map<String, Object> result) {
        switch (taskType) {
            case FEED -> {
                Long feedDefinitionId = toLong(data.get("feedDefinitionId"));
                BigDecimal amountKg = toBigDecimal(data.get("amountKg"));
                String notes = (String) data.getOrDefault("notes", "");
                executeFeedingOnApproval(penId, feedDefinitionId, amountKg, notes, task);
                result.put("action", "FEED");
            }
            case CLEAN -> {
                Pen pen = penRepository.findById(penId)
                        .orElseThrow(() -> new RuntimeException("Pen not found"));
                pen.setStatus("CLEAN");
                penRepository.save(pen);
                result.put("action", "CLEAN");
            }
            case VACCINATE -> {
                String vaccineName = (String) data.getOrDefault("vaccineName", "Vaccine");
                String eventDate = (String) data.getOrDefault("eventDate", LocalDate.now().toString());
                String vaccineNotes = (String) data.getOrDefault("notes", "");
                HealthRecord record = HealthRecord.builder()
                        .penId(penId)
                        .name(vaccineName)
                        .eventType("VACCINE")
                        .eventDate(LocalDate.parse(eventDate))
                        .status("COMPLETED")
                        .notes(vaccineNotes)
                        .build();
                healthRecordRepository.save(record);
                result.put("action", "VACCINATE");
            }
            case HARVEST -> {
                String subType = (String) data.getOrDefault("subType", "");
                if ("BYPRODUCT_COLLECTION".equals(subType)) {
                    executeByproductCollectionOnApproval(penId, data, task);
                    result.put("action", "BYPRODUCT_COLLECTION");
                } else {
                    int quantity = toInt(data.get("quantity"));
                    BigDecimal pricePerUnit = toBigDecimal(data.get("pricePerUnit"));
                    String buyer = (String) data.getOrDefault("buyer", "");
                    String harvestNotes = (String) data.getOrDefault("notes", "");
                    String animalName = (String) data.getOrDefault("animalName", "Vật nuôi");
                    executeLivestockHarvestOnApproval(penId, quantity, pricePerUnit, buyer, harvestNotes, animalName);
                    result.put("action", "HARVEST");
                }
            }
            default -> { /* no-op */ }
        }
    }

    private void executeFeedingOnApproval(Long penId, Long feedDefinitionId, BigDecimal amountKg, String notes, Task task) {
        BigDecimal cost = BigDecimal.ZERO;
        if (feedDefinitionId != null) {
            FeedDefinition feedDef = feedDefinitionRepository.findById(feedDefinitionId).orElse(null);
            if (feedDef != null) {
                cost = feedDef.getPricePerUnit().multiply(amountKg);
            }
        }

        FeedingLog log = FeedingLog.builder()
                .penId(penId)
                .feedDefinitionId(feedDefinitionId)
                .amountKg(amountKg)
                .cost(cost)
                .fedAt(LocalDateTime.now())
                .notes(notes)
                .build();
        feedingLogRepository.save(log);

        Pen pen = penRepository.findById(penId).orElse(null);
        if (pen != null) {
            pen.setLastFedAt(LocalDateTime.now());
            int feedingFrequency = 2;
            if (feedDefinitionId != null && pen.getAnimalDefinition() != null) {
                List<AnimalFeedCompatibility> compatList = animalFeedCompatibilityRepository
                        .findByAnimalDefinitionIdOrderByIsPrimaryDesc(pen.getAnimalDefinition().getId());
                for (AnimalFeedCompatibility compat : compatList) {
                    if (compat.getFeedDefinitionId().equals(feedDefinitionId)) {
                        feedingFrequency = compat.getFeedingFrequency() != null ? compat.getFeedingFrequency() : 2;
                        break;
                    }
                }
            }
            pen.setNextFeedingAt(LocalDateTime.now().plusHours(24 / feedingFrequency));
            pen.setFeedingStatus("FED");
            penRepository.save(pen);
        }

        // Deduct feed from inventory
        if (feedDefinitionId != null && amountKg != null && amountKg.compareTo(BigDecimal.ZERO) > 0
                && task.getOwner() != null) {
            Optional<UserInventory> feedInvOpt = userInventoryRepository
                    .findByUserIdAndFeedDefinitionId(task.getOwner().getId(), feedDefinitionId);
            if (feedInvOpt.isPresent()) {
                UserInventory feedInv = feedInvOpt.get();
                if (feedInv.getQuantity().compareTo(amountKg) >= 0) {
                    feedInv.subtractQuantity(amountKg);
                    userInventoryRepository.save(feedInv);

                    InventoryTransaction tx = InventoryTransaction.createUsage(
                            task.getOwner().getId(), feedInv.getId(), amountKg,
                            "TASK", task.getId(),
                            "Cho ăn - " + task.getName()
                    );
                    inventoryTransactionRepository.save(tx);

                    if (feedInv.getQuantity().compareTo(BigDecimal.ZERO) <= 0) {
                        userInventoryRepository.delete(feedInv);
                    }
                }
            }
        }

        // Deduct cost
        if (cost.compareTo(BigDecimal.ZERO) > 0 && task.getOwner() != null) {
            String feedName = feedDefinitionId != null
                    ? feedDefinitionRepository.findById(feedDefinitionId).map(FeedDefinition::getName).orElse("Thức ăn")
                    : "Thức ăn";
            String penCode = pen != null ? pen.getCode() : "N/A";
            assetService.deductExpense(task.getOwner().getId(), cost, "LIVESTOCK",
                    String.format("Cho ăn %s - Chuồng %s (%.2f kg)", feedName, penCode, amountKg), penId);
        }
    }

    private void executeLivestockHarvestOnApproval(Long penId, int quantity, BigDecimal pricePerUnit, String buyer, String notes, String animalName) {
        Pen pen = penRepository.findById(penId)
                .orElseThrow(() -> new RuntimeException("Pen not found"));

        if (quantity <= 0 || (pen.getAnimalCount() != null && quantity > pen.getAnimalCount())) {
            throw new IllegalArgumentException("Số lượng không hợp lệ");
        }

        BigDecimal totalRevenue = pricePerUnit.multiply(BigDecimal.valueOf(quantity));

        Farm farm = farmRepository.findById(pen.getFarmId())
                .orElseThrow(() -> new RuntimeException("Farm not found"));
        User user = userRepository.findById(farm.getOwnerId())
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Add revenue
        BigDecimal currentBalance = user.getBalance() != null ? user.getBalance() : BigDecimal.ZERO;
        user.setBalance(currentBalance.add(totalRevenue));
        userRepository.save(user);

        // Update pen
        int newCount = (pen.getAnimalCount() != null ? pen.getAnimalCount() : 0) - quantity;
        pen.setAnimalCount(Math.max(0, newCount));
        if (newCount <= 0) {
            pen.setStatus("EMPTY");
            pen.setAnimalCount(0);
        }
        penRepository.save(pen);

        // Log transaction
        String description = "Bán " + animalName + " (" + quantity + " con"
                + (buyer != null && !buyer.isEmpty() ? " - " + buyer : "") + ")";
        assetService.addIncome(user.getId(), totalRevenue, "LIVESTOCK", description, penId);
    }

    private void executeByproductCollectionOnApproval(Long penId, Map<String, Object> data, Task task) {
        String byproductType = (String) data.getOrDefault("byproductType", "NONE");
        String byproductUnit = (String) data.getOrDefault("byproductUnit", "");
        BigDecimal collectedQuantity = toBigDecimal(data.get("collectedQuantity"));
        String notes = (String) data.getOrDefault("notes", "");

        // If worker didn't report a collected quantity, use the estimated quantity
        if (collectedQuantity == null || collectedQuantity.compareTo(BigDecimal.ZERO) <= 0) {
            collectedQuantity = toBigDecimal(data.get("estimatedQuantity"));
        }

        if (collectedQuantity != null && collectedQuantity.compareTo(BigDecimal.ZERO) > 0) {
            // Save to ByproductLog
            ByproductLog log = ByproductLog.builder()
                    .penId(penId)
                    .productType(byproductType)
                    .quantity(collectedQuantity)
                    .unit(byproductUnit)
                    .recordedDate(LocalDate.now())
                    .notes("Thu bởi nhân công" + (notes != null && !notes.isEmpty() ? " - " + notes : ""))
                    .build();
            byproductLogRepository.save(log);
        }
    }

    private void deductInventoryOnApproval(Task task) {
        ShopItem item = task.getRelatedItem();
        Long ownerId = task.getOwner().getId();
        Optional<UserInventory> uiOpt = userInventoryRepository.findByUserIdAndShopItemId(ownerId, item.getId());
        if (uiOpt.isPresent()) {
            UserInventory ui = uiOpt.get();
            if (ui.getQuantity().compareTo(task.getQuantityRequired()) >= 0) {
                ui.subtractQuantity(task.getQuantityRequired());
                userInventoryRepository.save(ui);

                // Log inventory transaction
                InventoryTransaction tx = InventoryTransaction.createUsage(
                    ownerId, ui.getId(), task.getQuantityRequired(),
                    "TASK", task.getId(),
                    "Sử dụng cho công việc: " + task.getName()
                );
                inventoryTransactionRepository.save(tx);

                // Auto-remove if quantity reaches 0
                if (ui.getQuantity().compareTo(BigDecimal.ZERO) <= 0) {
                    userInventoryRepository.delete(ui);
                }
            }
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseWorkflowData(String json) {
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            return mapper.readValue(json, Map.class);
        } catch (Exception e) {
            throw new RuntimeException("Invalid workflow data JSON: " + e.getMessage());
        }
    }

    private Long toLong(Object obj) {
        if (obj == null) return null;
        if (obj instanceof Number) return ((Number) obj).longValue();
        return Long.valueOf(obj.toString());
    }

    private BigDecimal toBigDecimal(Object obj) {
        if (obj == null) return BigDecimal.ZERO;
        if (obj instanceof BigDecimal) return (BigDecimal) obj;
        return new BigDecimal(obj.toString());
    }

    private int toInt(Object obj) {
        if (obj == null) return 0;
        if (obj instanceof Number) return ((Number) obj).intValue();
        return Integer.parseInt(obj.toString());
    }
}
