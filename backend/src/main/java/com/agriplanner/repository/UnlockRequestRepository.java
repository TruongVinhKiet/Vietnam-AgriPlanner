package com.agriplanner.repository;

import com.agriplanner.model.UnlockRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UnlockRequestRepository extends JpaRepository<UnlockRequest, Long> {

    List<UnlockRequest> findByStatus(String status);

    List<UnlockRequest> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<UnlockRequest> findAllByOrderByCreatedAtDesc();

    boolean existsByUserIdAndStatus(Long userId, String status);
}
