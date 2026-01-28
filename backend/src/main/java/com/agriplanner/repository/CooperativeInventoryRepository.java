package com.agriplanner.repository;

import com.agriplanner.model.CooperativeInventory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CooperativeInventoryRepository extends JpaRepository<CooperativeInventory, Long> {

    List<CooperativeInventory> findByCooperative_IdOrderByUpdatedAtDesc(Long cooperativeId);

    Optional<CooperativeInventory> findByCooperative_IdAndShopItem_Id(Long cooperativeId, Long shopItemId);

    Optional<CooperativeInventory> findByCooperative_IdAndCropDefinition_Id(Long cooperativeId, Long cropDefinitionId);

    Optional<CooperativeInventory> findByCooperative_IdAndAnimalDefinition_Id(Long cooperativeId,
            Long animalDefinitionId);

    @Query("SELECT i FROM CooperativeInventory i WHERE i.cooperative.id = :cooperativeId AND i.quantity > 0")
    List<CooperativeInventory> findAvailableByCooperativeId(Long cooperativeId);

    @Query("SELECT i FROM CooperativeInventory i WHERE i.cooperative.id = :cooperativeId AND i.productType = :productType")
    List<CooperativeInventory> findByCooperativeIdAndProductType(Long cooperativeId,
            CooperativeInventory.ProductType productType);
}
