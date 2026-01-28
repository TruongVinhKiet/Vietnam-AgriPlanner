package com.agriplanner.repository;

import com.agriplanner.model.GroupSellCampaign;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GroupSellCampaignRepository extends JpaRepository<GroupSellCampaign, Long> {

    List<GroupSellCampaign> findByCooperative_IdOrderByCreatedAtDesc(Long cooperativeId);

    List<GroupSellCampaign> findByCooperative_IdAndStatus(Long cooperativeId,
            GroupSellCampaign.SellCampaignStatus status);

    @Query("SELECT c FROM GroupSellCampaign c WHERE c.cooperative.id = :cooperativeId AND c.status IN ('OPEN', 'READY') ORDER BY c.deadline ASC")
    List<GroupSellCampaign> findActiveByCooperativeId(Long cooperativeId);

    // Admin-created campaigns (global)
    @Query("SELECT c FROM GroupSellCampaign c WHERE c.isAdminCreated = true AND c.status = 'OPEN' ORDER BY c.createdAt DESC")
    List<GroupSellCampaign> findAdminCreatedOpenCampaigns();

    @Query("SELECT c FROM GroupSellCampaign c WHERE c.isAdminCreated = true ORDER BY c.createdAt DESC")
    List<GroupSellCampaign> findAllAdminCreatedCampaigns();

    List<GroupSellCampaign> findByIsAdminCreatedTrue();
}
