package com.agriplanner.repository;

import com.agriplanner.model.HelpRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HelpRequestRepository extends JpaRepository<HelpRequest, Long> {
    List<HelpRequest> findByWorker_IdOrderByCreatedAtDesc(Long workerId);

    List<HelpRequest> findByOwner_IdOrderByCreatedAtDesc(Long ownerId);

    List<HelpRequest> findByFarm_IdOrderByCreatedAtDesc(Long farmId);

    // Worker-to-owner requests (includes legacy records where targetType is null)
    @Query("SELECT h FROM HelpRequest h WHERE h.worker.id = :workerId AND (h.targetType IS NULL OR h.targetType = 'OWNER') ORDER BY h.createdAt DESC")
    List<HelpRequest> findWorkerToOwnerRequests(@Param("workerId") Long workerId);

    // Admin support queries
    List<HelpRequest> findByTargetTypeOrderByCreatedAtDesc(String targetType);

    List<HelpRequest> findByTargetTypeAndStatusOrderByCreatedAtDesc(String targetType, String status);

    List<HelpRequest> findByWorker_IdAndTargetTypeOrderByCreatedAtDesc(Long workerId, String targetType);

    List<HelpRequest> findByOwner_IdAndTargetTypeOrderByCreatedAtDesc(Long ownerId, String targetType);

    long countByTargetTypeAndStatus(String targetType, String status);

    long countByTargetType(String targetType);
}
