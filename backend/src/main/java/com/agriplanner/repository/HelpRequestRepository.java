package com.agriplanner.repository;

import com.agriplanner.model.HelpRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HelpRequestRepository extends JpaRepository<HelpRequest, Long> {
    List<HelpRequest> findByWorker_IdOrderByCreatedAtDesc(Long workerId);

    List<HelpRequest> findByOwner_IdOrderByCreatedAtDesc(Long ownerId);

    List<HelpRequest> findByFarm_IdOrderByCreatedAtDesc(Long farmId);
}
