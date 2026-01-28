package com.agriplanner.repository;

import com.agriplanner.model.JobApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JobApplicationRepository extends JpaRepository<JobApplication, Long> {
    List<JobApplication> findByPost_Id(Long postId);

    List<JobApplication> findByWorker_Id(Long workerId);
}
