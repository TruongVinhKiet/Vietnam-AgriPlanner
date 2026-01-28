package com.agriplanner.repository;

import com.agriplanner.model.PestDefinition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PestDefinitionRepository extends JpaRepository<PestDefinition, Long> {
    List<PestDefinition> findBySeverity(String severity);
}
