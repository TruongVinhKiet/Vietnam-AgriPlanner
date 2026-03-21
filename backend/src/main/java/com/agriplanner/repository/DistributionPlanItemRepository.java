package com.agriplanner.repository;

import com.agriplanner.model.DistributionPlanItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DistributionPlanItemRepository extends JpaRepository<DistributionPlanItem, Long> {

    List<DistributionPlanItem> findByPlan_Id(Long planId);

    List<DistributionPlanItem> findByMember_Id(Long memberId);
}
