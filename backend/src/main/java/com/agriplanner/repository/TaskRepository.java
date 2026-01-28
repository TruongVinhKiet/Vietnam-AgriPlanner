package com.agriplanner.repository;

import com.agriplanner.model.Task;
import com.agriplanner.model.TaskType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Collection;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {
    List<Task> findByFarm_Id(Long farmId);

    List<Task> findByWorker_Id(Long workerId);

    List<Task> findByOwner_Id(Long ownerId);

    boolean existsByFarm_IdAndTaskTypeAndField_IdAndIsAutoCreatedTrueAndDueDateBetween(Long farmId, TaskType taskType,
            Long fieldId, LocalDateTime start, LocalDateTime end);

    boolean existsByFarm_IdAndTaskTypeAndPen_IdAndIsAutoCreatedTrueAndDueDateBetween(Long farmId, TaskType taskType,
            Long penId, LocalDateTime start, LocalDateTime end);

    List<Task> findByIsAutoCreatedTrueAndStatusAndWorkerIsNullAndDueDateBetween(String status, LocalDateTime start,
            LocalDateTime end);

    boolean existsByFarm_IdAndTaskTypeAndField_IdAndIsAutoCreatedTrueAndStatusIn(Long farmId, TaskType taskType,
            Long fieldId, Collection<String> statuses);

    boolean existsByFarm_IdAndTaskTypeAndPen_IdAndIsAutoCreatedTrueAndStatusIn(Long farmId, TaskType taskType,
            Long penId, Collection<String> statuses);
}
