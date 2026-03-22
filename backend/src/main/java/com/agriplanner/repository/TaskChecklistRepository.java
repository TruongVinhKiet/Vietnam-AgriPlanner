package com.agriplanner.repository;

import com.agriplanner.model.TaskChecklist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskChecklistRepository extends JpaRepository<TaskChecklist, Long> {
    List<TaskChecklist> findByTask_IdOrderBySortOrderAsc(Long taskId);

    long countByTask_IdAndIsCompletedTrue(Long taskId);

    long countByTask_Id(Long taskId);
}
