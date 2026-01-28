package com.agriplanner.controller;

import com.agriplanner.model.*;
import com.agriplanner.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * System Admin Controller
 * Manages system-wide data: Users, Crops, Shop Items, Animals
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('SYSTEM_ADMIN')")
@CrossOrigin(origins = "*")
@SuppressWarnings("null")
public class SystemAdminController {

    private final UserRepository userRepository;
    private final ShopItemRepository shopItemRepository;
    private final CropDefinitionRepository cropDefinitionRepository;
    private final AnimalDefinitionRepository animalDefinitionRepository;

    // =============================================
    // USER MANAGEMENT
    // =============================================

    @GetMapping("/users")
    public ResponseEntity<List<User>> getAllUsers() {
        return ResponseEntity.ok(userRepository.findAll());
    }

    @PutMapping("/users/{id}/status")
    public ResponseEntity<?> updateUserStatus(@PathVariable Long id, @RequestBody Map<String, Boolean> body) {
        Boolean isActive = body.get("isActive");
        return userRepository.findById(id).map(user -> {
            user.setIsActive(isActive);
            userRepository.save(user);
            return ResponseEntity.ok(user);
        }).orElse(ResponseEntity.notFound().build());
    }

    // =============================================
    // SHOP ITEM MANAGEMENT (Fertilizers, Pesticides, Tools)
    // =============================================

    @GetMapping("/shop-items")
    public ResponseEntity<List<ShopItem>> getAllShopItems() {
        return ResponseEntity.ok(shopItemRepository.findAll());
    }

    @PostMapping("/shop-items")
    public ResponseEntity<ShopItem> createShopItem(@RequestBody ShopItem item) {
        return ResponseEntity.ok(shopItemRepository.save(item));
    }

    @PutMapping("/shop-items/{id}")
    public ResponseEntity<ShopItem> updateShopItem(@PathVariable Long id, @RequestBody ShopItem itemDetails) {
        return shopItemRepository.findById(id).map(item -> {
            item.setName(itemDetails.getName());
            item.setCategory(itemDetails.getCategory());
            item.setDescription(itemDetails.getDescription());
            item.setPrice(itemDetails.getPrice());
            item.setImageUrl(itemDetails.getImageUrl());
            item.setStockQuantity(itemDetails.getStockQuantity());
            item.setIsActive(itemDetails.getIsActive());
            return ResponseEntity.ok(shopItemRepository.save(item));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/shop-items/{id}")
    public ResponseEntity<?> deleteShopItem(@PathVariable Long id) {
        if (shopItemRepository.existsById(id)) {
            shopItemRepository.deleteById(id);
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.notFound().build();
    }

    // =============================================
    // CROP DEFINITIONS
    // =============================================

    @GetMapping("/crops")
    public ResponseEntity<List<CropDefinition>> getAllCrops() {
        return ResponseEntity.ok(cropDefinitionRepository.findAll());
    }

    @PostMapping("/crops")
    public ResponseEntity<CropDefinition> createCrop(@RequestBody CropDefinition crop) {
        return ResponseEntity.ok(cropDefinitionRepository.save(crop));
    }

    @PutMapping("/crops/{id}")
    public ResponseEntity<CropDefinition> updateCrop(@PathVariable Long id, @RequestBody CropDefinition details) {
        return cropDefinitionRepository.findById(id).map(crop -> {
            crop.setName(details.getName());
            crop.setCategory(details.getCategory());
            crop.setGrowthDurationDays(details.getGrowthDurationDays());
            crop.setIdealSeasons(details.getIdealSeasons());
            crop.setImageUrl(details.getImageUrl());
            crop.setMinTemp(details.getMinTemp());
            crop.setMaxTemp(details.getMaxTemp());
            crop.setWaterNeeds(details.getWaterNeeds());
            crop.setDescription(details.getDescription());
            return ResponseEntity.ok(cropDefinitionRepository.save(crop));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/crops/{id}")
    public ResponseEntity<?> deleteCrop(@PathVariable Long id) {
        cropDefinitionRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }

    // =============================================
    // ANIMAL DEFINITIONS
    // =============================================

    @GetMapping("/animals")
    public ResponseEntity<List<AnimalDefinition>> getAllAnimals() {
        return ResponseEntity.ok(animalDefinitionRepository.findAll());
    }

    @PostMapping("/animals")
    public ResponseEntity<AnimalDefinition> createAnimal(@RequestBody AnimalDefinition animal) {
        return ResponseEntity.ok(animalDefinitionRepository.save(animal));
    }

    @PutMapping("/animals/{id}")
    public ResponseEntity<AnimalDefinition> updateAnimal(@PathVariable Long id, @RequestBody AnimalDefinition details) {
        return animalDefinitionRepository.findById(id).map(animal -> {
            animal.setName(details.getName());
            animal.setCategory(details.getCategory());
            animal.setIconName(details.getIconName());
            animal.setImageUrl(details.getImageUrl());
            animal.setGrowthDurationDays(details.getGrowthDurationDays());
            animal.setUnit(details.getUnit());
            animal.setBuyPricePerUnit(details.getBuyPricePerUnit());
            animal.setSellPricePerUnit(details.getSellPricePerUnit());
            animal.setDescription(details.getDescription());
            return ResponseEntity.ok(animalDefinitionRepository.save(animal));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/animals/{id}")
    public ResponseEntity<?> deleteAnimal(@PathVariable Long id) {
        animalDefinitionRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }

    // =============================================
    // OTHER DEFINITIONS (Just in case needed separately)
    // =============================================

    // Add endpoint for Feed, Pests if logic differs from ShopItems/General
}
