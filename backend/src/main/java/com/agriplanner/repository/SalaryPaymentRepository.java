package com.agriplanner.repository;

import com.agriplanner.model.SalaryPayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SalaryPaymentRepository extends JpaRepository<SalaryPayment, Long> {
    List<SalaryPayment> findByWorker_IdOrderByPaidAtDesc(Long workerId);

    List<SalaryPayment> findByOwner_IdOrderByPaidAtDesc(Long ownerId);

    List<SalaryPayment> findByFarm_IdOrderByPaidAtDesc(Long farmId);
}
