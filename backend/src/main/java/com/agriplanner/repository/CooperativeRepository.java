package com.agriplanner.repository;

import com.agriplanner.model.Cooperative;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CooperativeRepository extends JpaRepository<Cooperative, Long> {

    Optional<Cooperative> findByCode(String code);

    Optional<Cooperative> findByInviteCode(String inviteCode);

    List<Cooperative> findByStatus(Cooperative.CooperativeStatus status);

    List<Cooperative> findByLeader_Id(Long leaderId);

    @Query("SELECT c FROM Cooperative c WHERE c.status = 'APPROVED' ORDER BY c.createdAt DESC")
    List<Cooperative> findAllApproved();

    @Query("SELECT c FROM Cooperative c WHERE c.status = 'PENDING' ORDER BY c.createdAt ASC")
    List<Cooperative> findAllPending();

    @Query("SELECT COALESCE(MAX(CAST(SUBSTRING(c.code, 5) AS integer)), 0) FROM Cooperative c WHERE c.code LIKE 'HTX-%'")
    Integer findMaxCodeNumber();

    boolean existsByInviteCode(String inviteCode);

    long countByStatus(Cooperative.CooperativeStatus status);

    @Query("SELECT SUM(c.balance) FROM Cooperative c")
    java.math.BigDecimal sumBalance();
}
