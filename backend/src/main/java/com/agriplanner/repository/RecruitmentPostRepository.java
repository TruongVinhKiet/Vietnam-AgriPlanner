package com.agriplanner.repository;

import com.agriplanner.model.RecruitmentPost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RecruitmentPostRepository extends JpaRepository<RecruitmentPost, Long> {
    List<RecruitmentPost> findByFarm_Id(Long farmId);

    List<RecruitmentPost> findByStatus(String status);
}
