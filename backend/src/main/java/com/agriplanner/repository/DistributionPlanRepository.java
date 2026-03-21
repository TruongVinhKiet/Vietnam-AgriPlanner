package com.agriplanner.repository;

import com.agriplanner.model.DistributionPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface DistributionPlanRepository extends JpaRepository<DistributionPlan, Long> {

    List<DistributionPlan> findByCooperative_IdOrderByCreatedAtDesc(Long cooperativeId);

    @Query("SELECT p FROM DistributionPlan p WHERE p.cooperative.id = :coopId AND p.status = 'PENDING' ORDER BY p.createdAt DESC")
    List<DistributionPlan> findPendingByCooperativeId(@Param("coopId") Long cooperativeId);

    @Query("SELECT p FROM DistributionPlan p WHERE p.cooperative.id = :coopId AND p.status IN ('APPROVED', 'EXECUTED') ORDER BY p.createdAt DESC")
    List<DistributionPlan> findCompletedByCooperativeId(@Param("coopId") Long cooperativeId);
}
