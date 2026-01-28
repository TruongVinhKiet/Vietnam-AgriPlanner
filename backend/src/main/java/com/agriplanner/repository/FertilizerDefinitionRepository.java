package com.agriplanner.repository;

import com.agriplanner.model.FertilizerDefinition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FertilizerDefinitionRepository extends JpaRepository<FertilizerDefinition, Long> {
    List<FertilizerDefinition> findByType(String type);
}
