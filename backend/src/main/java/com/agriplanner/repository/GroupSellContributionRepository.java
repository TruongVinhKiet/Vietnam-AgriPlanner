package com.agriplanner.repository;

import com.agriplanner.model.GroupSellContribution;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GroupSellContributionRepository extends JpaRepository<GroupSellContribution, Long> {

    List<GroupSellContribution> findByCampaign_Id(Long campaignId);

    List<GroupSellContribution> findByMember_Id(Long memberId);

    Optional<GroupSellContribution> findByCampaign_IdAndMember_Id(Long campaignId, Long memberId);
}
