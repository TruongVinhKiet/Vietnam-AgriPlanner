package com.agriplanner.repository;

import com.agriplanner.model.CooperativeInventoryContribution;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface CooperativeInventoryContributionRepository
        extends JpaRepository<CooperativeInventoryContribution, Long> {

    List<CooperativeInventoryContribution> findByInventory_IdOrderByCreatedAtDesc(Long inventoryId);

    List<CooperativeInventoryContribution> findByMember_IdOrderByCreatedAtDesc(Long memberId);

    List<CooperativeInventoryContribution> findByCampaign_Id(Long campaignId);

    @Query("SELECT c FROM CooperativeInventoryContribution c WHERE c.member.id = :memberId AND c.isClaimed = false AND c.earnings > 0")
    List<CooperativeInventoryContribution> findUnclaimedEarnings(Long memberId);

    @Query("SELECT SUM(c.quantity) FROM CooperativeInventoryContribution c WHERE c.inventory.id = :inventoryId")
    BigDecimal sumQuantityByInventoryId(Long inventoryId);

    @Query("SELECT SUM(c.earnings) FROM CooperativeInventoryContribution c WHERE c.member.id = :memberId AND c.isClaimed = false")
    BigDecimal sumUnclaimedEarningsByMemberId(Long memberId);

    // For distribution chart - get contributions by campaign
    @Query("SELECT c FROM CooperativeInventoryContribution c WHERE c.campaign.id = :campaignId ORDER BY c.quantity DESC")
    List<CooperativeInventoryContribution> findByCampaignIdOrderByQuantityDesc(Long campaignId);
}
