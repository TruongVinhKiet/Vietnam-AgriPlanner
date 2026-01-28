package com.agriplanner.repository;

import com.agriplanner.model.DissolutionRequest;
import com.agriplanner.model.DissolutionRequest.DissolutionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DissolutionRequestRepository extends JpaRepository<DissolutionRequest, Long> {

    List<DissolutionRequest> findByStatus(DissolutionStatus status);

    List<DissolutionRequest> findByCooperative_Id(Long cooperativeId);

    Optional<DissolutionRequest> findByCooperative_IdAndStatus(Long cooperativeId, DissolutionStatus status);

    @Query("SELECT d FROM DissolutionRequest d WHERE d.cooperative.id = :cooperativeId ORDER BY d.createdAt DESC")
    List<DissolutionRequest> findAllByCooperativeIdOrderByCreatedAtDesc(Long cooperativeId);

    boolean existsByCooperative_IdAndStatus(Long cooperativeId, DissolutionStatus status);

    long countByStatus(DissolutionStatus status);
}
