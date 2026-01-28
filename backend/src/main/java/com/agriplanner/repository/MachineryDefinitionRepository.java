package com.agriplanner.repository;

import com.agriplanner.model.MachineryDefinition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MachineryDefinitionRepository extends JpaRepository<MachineryDefinition, Long> {
    List<MachineryDefinition> findByType(String type);
}
