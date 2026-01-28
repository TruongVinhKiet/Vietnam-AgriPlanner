package com.agriplanner.repository;

import com.agriplanner.model.AnimalGrowth;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AnimalGrowthRepository extends JpaRepository<AnimalGrowth, Long> {
    List<AnimalGrowth> findByPenIdOrderByRecordedDateAsc(Long penId);
}
