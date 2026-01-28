package com.agriplanner.repository;

import com.agriplanner.model.AnimalFeedCompatibility;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AnimalFeedCompatibilityRepository extends JpaRepository<AnimalFeedCompatibility, Long> {
    
    List<AnimalFeedCompatibility> findByAnimalDefinitionId(Long animalDefinitionId);
    
    List<AnimalFeedCompatibility> findByAnimalDefinitionIdOrderByIsPrimaryDesc(Long animalDefinitionId);
    
    @Query("SELECT afc FROM AnimalFeedCompatibility afc " +
           "WHERE afc.animalDefinitionId = :animalDefId " +
           "ORDER BY afc.isPrimary DESC, afc.feedDefinition.name ASC")
    List<AnimalFeedCompatibility> findCompatibleFeedsForAnimal(Long animalDefId);
    
    boolean existsByAnimalDefinitionIdAndFeedDefinitionId(Long animalDefId, Long feedDefId);
}
