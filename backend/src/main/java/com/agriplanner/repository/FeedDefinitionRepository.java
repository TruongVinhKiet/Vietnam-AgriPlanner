package com.agriplanner.repository;

import com.agriplanner.model.FeedDefinition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FeedDefinitionRepository extends JpaRepository<FeedDefinition, Long> {
    
    List<FeedDefinition> findByCategory(String category);
    
    List<FeedDefinition> findAllByOrderByNameAsc();
}
