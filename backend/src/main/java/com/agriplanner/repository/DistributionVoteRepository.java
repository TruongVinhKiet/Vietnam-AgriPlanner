package com.agriplanner.repository;

import com.agriplanner.model.DistributionVote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DistributionVoteRepository extends JpaRepository<DistributionVote, Long> {

    List<DistributionVote> findByPlan_Id(Long planId);

    Optional<DistributionVote> findByPlan_IdAndMember_Id(Long planId, Long memberId);

    long countByPlan_IdAndVote(Long planId, DistributionVote.VoteType vote);
}
