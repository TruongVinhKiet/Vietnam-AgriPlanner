package com.agriplanner.repository;

import com.agriplanner.model.GroupBuyCampaign;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.ZonedDateTime;
import java.util.List;

@Repository
public interface GroupBuyCampaignRepository extends JpaRepository<GroupBuyCampaign, Long> {

    List<GroupBuyCampaign> findByCooperative_IdOrderByCreatedAtDesc(Long cooperativeId);

    List<GroupBuyCampaign> findByCooperative_IdAndStatus(Long cooperativeId, GroupBuyCampaign.CampaignStatus status);

    @Query("SELECT c FROM GroupBuyCampaign c WHERE c.cooperative.id = :cooperativeId AND c.status = 'OPEN' ORDER BY c.deadline ASC")
    List<GroupBuyCampaign> findOpenByCooperativeId(Long cooperativeId);

    @Query("SELECT c FROM GroupBuyCampaign c WHERE c.status = 'OPEN' AND c.deadline < :now")
    List<GroupBuyCampaign> findExpiredCampaigns(ZonedDateTime now);

    @Query("SELECT c FROM GroupBuyCampaign c WHERE c.status = 'COMPLETED'")
    List<GroupBuyCampaign> findCompletedCampaigns();

    // Admin-created campaigns (global)
    @Query("SELECT c FROM GroupBuyCampaign c WHERE c.isAdminCreated = true AND c.status = 'OPEN' ORDER BY c.createdAt DESC")
    List<GroupBuyCampaign> findAdminCreatedOpenCampaigns();

    @Query("SELECT c FROM GroupBuyCampaign c WHERE c.isAdminCreated = true ORDER BY c.createdAt DESC")
    List<GroupBuyCampaign> findAllAdminCreatedCampaigns();

    List<GroupBuyCampaign> findByIsAdminCreatedTrue();
}
