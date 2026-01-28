package com.agriplanner.repository;

import com.agriplanner.model.FeedingLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FeedingLogRepository extends JpaRepository<FeedingLog, Long> {
    List<FeedingLog> findByPenIdOrderByFedAtDesc(Long penId);
}
