package com.agriplanner.repository;

import com.agriplanner.model.EmploymentHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EmploymentHistoryRepository extends JpaRepository<EmploymentHistory, Long> {
    List<EmploymentHistory> findByWorkerIdAndFarmId(Long workerId, Long farmId);
    List<EmploymentHistory> findByFarmId(Long farmId);
    boolean existsByWorkerIdAndFarmId(Long workerId, Long farmId);
}
