package com.agriplanner.repository;

import com.agriplanner.model.Contract;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ContractRepository extends JpaRepository<Contract, Long> {

    Optional<Contract> findByJobApplication_Id(Long applicationId);

    List<Contract> findByJobApplication_Worker_Id(Long workerId);

    List<Contract> findByJobApplication_Post_Farm_Id(Long farmId);
}
