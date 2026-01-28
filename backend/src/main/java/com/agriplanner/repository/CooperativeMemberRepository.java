package com.agriplanner.repository;

import com.agriplanner.model.CooperativeMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CooperativeMemberRepository extends JpaRepository<CooperativeMember, Long> {

    List<CooperativeMember> findByCooperative_Id(Long cooperativeId);

    List<CooperativeMember> findByUser_Id(Long userId);

    Optional<CooperativeMember> findByCooperative_IdAndUser_Id(Long cooperativeId, Long userId);

    boolean existsByCooperative_IdAndUser_Id(Long cooperativeId, Long userId);

    @Query("SELECT cm FROM CooperativeMember cm WHERE cm.cooperative.id = :cooperativeId AND cm.role = 'LEADER'")
    Optional<CooperativeMember> findLeaderByCooperativeId(Long cooperativeId);

    @Query("SELECT cm FROM CooperativeMember cm JOIN FETCH cm.cooperative c WHERE cm.user.id = :userId AND c.status = 'APPROVED'")
    List<CooperativeMember> findActiveByUserId(Long userId);

    int countByCooperative_Id(Long cooperativeId);
}
