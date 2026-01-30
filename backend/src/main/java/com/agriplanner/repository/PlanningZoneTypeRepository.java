package com.agriplanner.repository;

import com.agriplanner.model.PlanningZoneType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for PlanningZoneType entities
 */
@Repository
public interface PlanningZoneTypeRepository extends JpaRepository<PlanningZoneType, Long> {
    
    /**
     * Find by code
     */
    Optional<PlanningZoneType> findByCode(String code);
    
    /**
     * Find by category
     */
    List<PlanningZoneType> findByCategory(String category);
    
    /**
     * Find all ordered by category and name
     */
    List<PlanningZoneType> findAllByOrderByCategoryAscNameAsc();
}
