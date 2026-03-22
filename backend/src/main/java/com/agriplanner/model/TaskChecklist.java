package com.agriplanner.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "task_checklists")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskChecklist {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id", nullable = false)
    @JsonIgnoreProperties({"checklists", "comments", "hibernateLazyInitializer", "handler"})
    private Task task;

    @Column(nullable = false, length = 500)
    private String description;

    @Column(name = "is_completed")
    @Builder.Default
    private Boolean isCompleted = false;

    @Column(name = "sort_order")
    @Builder.Default
    private Integer sortOrder = 0;
}
