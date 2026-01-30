package com.agriplanner.repository;

import com.agriplanner.model.ZoneSnapshotItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ZoneSnapshotItemRepository extends JpaRepository<ZoneSnapshotItem, Long> {

    /**
     * Find all items for a snapshot
     */
    List<ZoneSnapshotItem> findBySnapshotId(Long snapshotId);

    /**
     * Delete all items for a snapshot
     */
    void deleteBySnapshotId(Long snapshotId);

    /**
     * Count items in a snapshot
     */
    long countBySnapshotId(Long snapshotId);
}
