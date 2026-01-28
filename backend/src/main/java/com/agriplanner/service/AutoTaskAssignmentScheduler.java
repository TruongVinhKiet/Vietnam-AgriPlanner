package com.agriplanner.service;

import com.agriplanner.model.Farm;
import com.agriplanner.model.Task;
import com.agriplanner.model.User;
import com.agriplanner.model.UserRole;
import com.agriplanner.repository.TaskRepository;
import com.agriplanner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Random;

@Service
@RequiredArgsConstructor
@Slf4j
public class AutoTaskAssignmentScheduler {

    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final Random random = new Random();

    @Scheduled(fixedRate = 60000)
    @Transactional
    public void autoAssignDueSoonTasks() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime start = now.minusMinutes(10);
        LocalDateTime end = now.plusMinutes(10);

        List<Task> tasks = taskRepository.findByIsAutoCreatedTrueAndStatusAndWorkerIsNullAndDueDateBetween(
                "PENDING", start, end);

        int assignedCount = 0;

        for (Task task : tasks) {
            Farm farm = task.getFarm();
            Long farmId = farm != null ? farm.getId() : null;
            if (farmId == null) {
                continue;
            }

            List<User> workers = userRepository.findByRoleAndFarmIdAndApprovalStatus(
                    UserRole.WORKER, farmId, User.ApprovalStatus.APPROVED);
            if (workers == null || workers.isEmpty()) {
                continue;
            }

            User chosen = workers.size() == 1
                    ? workers.get(0)
                    : workers.get(random.nextInt(workers.size()));

            task.setWorker(chosen);
            taskRepository.save(task);
            assignedCount++;
        }

        if (assignedCount > 0) {
            log.info("AutoTaskAssignmentScheduler assigned {} tasks (window {} -> {})", assignedCount, start, end);
        }
    }
}
