package com.agriplanner.repository;

import com.agriplanner.model.HealthRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface HealthRecordRepository extends JpaRepository<HealthRecord, Long> {
    List<HealthRecord> findByPenIdOrderByEventDateAsc(Long penId);
}
