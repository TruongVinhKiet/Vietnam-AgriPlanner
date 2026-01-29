package com.agriplanner.service;

import com.agriplanner.model.*;
import com.agriplanner.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.Objects;

@Service
public class TaskService {

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

            Pen pen = penRepository.findById(task.getPen().getId())
                    .orElseThrow(() -> new RuntimeException("Pen not found"));
            pen.setStatus(normalized);
            penRepository.save(pen);
        }
    }

    public List<Task> getWorkerTasks(Long workerId) {
        return taskRepository.findByWorker_Id(workerId);
    }

    public List<Task> getOwnerTasks(Long ownerId) {
        return taskRepository.findByOwner_Id(ownerId);
    }

    public Task getTask(Long id) {
        return taskRepository.findById(Objects.requireNonNull(id)).orElse(null);
    }
}
