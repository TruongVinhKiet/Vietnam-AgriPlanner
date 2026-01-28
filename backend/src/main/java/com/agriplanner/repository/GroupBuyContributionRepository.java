package com.agriplanner.repository;

import com.agriplanner.model.GroupBuyContribution;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GroupBuyContributionRepository extends JpaRepository<GroupBuyContribution, Long> {

    List<GroupBuyContribution> findByCampaign_Id(Long campaignId);

    List<GroupBuyContribution> findByMember_Id(Long memberId);

    Optional<GroupBuyContribution> findByCampaign_IdAndMember_Id(Long campaignId, Long memberId);

    boolean existsByCampaign_IdAndMember_Id(Long campaignId, Long memberId);
}
