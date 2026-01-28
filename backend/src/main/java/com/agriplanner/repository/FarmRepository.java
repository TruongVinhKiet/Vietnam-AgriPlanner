package com.agriplanner.repository;

import com.agriplanner.model.Farm;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for Farm entity
 */
@Repository
public interface FarmRepository extends JpaRepository<Farm, Long> {

    /**
     * Find all farms for a specific owner
     */
    List<Farm> findByOwnerId(Long ownerId);

    /**
     * Find all farms (for worker registration dropdown)
     */
    List<Farm> findAllByOrderByNameAsc();
}
