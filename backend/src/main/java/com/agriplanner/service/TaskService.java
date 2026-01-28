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
        Task task = taskRepository.findById(Objects.requireNonNull(taskId))
                .orElseThrow(() -> new RuntimeException("Task not found"));

        if (task.getTaskType() == TaskType.BUY_SUPPLIES) {
            // Execute Buy
            ShopItem item = task.getRelatedItem();
            BigDecimal cost = item.getPrice().multiply(task.getQuantityRequired());

            // Deduct from Owner
            if (task.getOwner() == null || task.getOwner().getId() == null)
                throw new RuntimeException("Owner ID missing");
            walletService.deductFunds(task.getOwner().getId(), cost, "Chi phí mua vật tư (Worker: "
                    + (task.getWorker() != null ? task.getWorker().getFullName() : "Unknown") + ")");

            // Add to Inventory (Owner's inventory)
            UserInventory ui = userInventoryRepository.findByUserIdAndShopItemId(task.getOwner().getId(), item.getId())
                    .orElse(new UserInventory(task.getOwner().getId(), item, BigDecimal.ZERO));

            ui.addQuantity(task.getQuantityRequired());
            userInventoryRepository.save(ui);

            task.setStatus("COMPLETED");
            task.setCompletedAt(java.time.LocalDateTime.now());
            taskRepository.save(task);
        } else {
            // Normal task Logic (Deduct inventory if needed)
            if (task.getRelatedItem() != null && task.getQuantityRequired() != null) {
                ShopItem item = task.getRelatedItem();

                if (task.getOwner() == null || task.getOwner().getId() == null)
                    throw new RuntimeException("Owner ID missing");

                // Find inventory to deduct (FIFO or any batch)
                Optional<UserInventory> uiOpt = userInventoryRepository
                        .findByUserIdAndShopItemId(task.getOwner().getId(), item.getId());

                if (uiOpt.isEmpty() || uiOpt.get().getQuantity().compareTo(task.getQuantityRequired()) < 0) {
                    // Check total stock again just in case (optional, but robust)
                    // For simplicity, failing if single main entry is insufficient or implement
                    // batch logic
                    // Here relying on findByUserIdAndShopItemId returning the aggregate or singular
                    // entry
                    // If UserInventory has batches, we need to iterate.
                    // Provided repository has findByUserIdAndShopItemId returning
                    // Optional<UserInventory>, implying uniqueness or primary entry.
                    // But previously I saw findByUserIdAndCategory returning List.
                    // Let's stick to the method that exists: findByUserIdAndShopItemId

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
            task.setStatus("COMPLETED");
            task.setCompletedAt(java.time.LocalDateTime.now());
            taskRepository.save(task);
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
