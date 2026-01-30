package com.agriplanner.repository;

import com.agriplanner.model.ZoneSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ZoneSnapshotRepository extends JpaRepository<ZoneSnapshot, Long> {

    /**
     * Find all snapshots ordered by creation date descending
     */
    List<ZoneSnapshot> findAllByOrderByCreatedAtDesc();

    /**
     * Find snapshots created by a specific user
     */
    List<ZoneSnapshot> findByCreatedByOrderByCreatedAtDesc(Long userId);

    /**
     * Count total snapshots
     */
    @Query("SELECT COUNT(s) FROM ZoneSnapshot s")
    long countSnapshots();

    /**
     * Find latest N snapshots
     */
    @Query(value = "SELECT * FROM zone_snapshots ORDER BY created_at DESC LIMIT ?1", nativeQuery = true)
    List<ZoneSnapshot> findLatestSnapshots(int limit);
}
