package com.agriplanner.repository;

import com.agriplanner.model.TaskWorkLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskWorkLogRepository extends JpaRepository<TaskWorkLog, Long> {
    List<TaskWorkLog> findByTask_IdOrderByCreatedAtDesc(Long taskId);

    List<TaskWorkLog> findByWorker_IdOrderByCreatedAtDesc(Long workerId);

    TaskWorkLog findFirstByTask_IdAndWorker_IdAndEndedAtIsNullOrderByStartedAtDesc(Long taskId, Long workerId);
}
