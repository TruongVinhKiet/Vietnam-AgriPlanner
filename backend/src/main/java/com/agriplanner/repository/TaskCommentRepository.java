package com.agriplanner.repository;

import com.agriplanner.model.TaskComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskCommentRepository extends JpaRepository<TaskComment, Long> {
    List<TaskComment> findByTask_IdOrderByCreatedAtAsc(Long taskId);
}
