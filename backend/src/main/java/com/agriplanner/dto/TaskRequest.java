package com.agriplanner.dto;

import com.agriplanner.model.TaskType;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class TaskRequest {
    private Long farmId;
    private Long ownerId;
    private Long workerId;

    // Context
    private Long fieldId;
    private Long penId;

    // Main content
    private String name;
    private String description;

    // Details
    private String priority; // LOW, NORMAL, HIGH
    private TaskType taskType;
    private Long relatedShopItemId;
    private BigDecimal quantityRequired;

    private BigDecimal salary;
    private LocalDateTime dueDate;
}
