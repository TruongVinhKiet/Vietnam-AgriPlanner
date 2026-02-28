package com.agriplanner.controller;

import com.agriplanner.model.*;
import com.agriplanner.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
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
    private final VaccinationScheduleRepository vaccinationScheduleRepository;
    private final AnimalFeedCompatibilityRepository animalFeedCompatibilityRepository;
    private final FeedDefinitionRepository feedDefinitionRepository;
    private final PestDefinitionRepository pestDefinitionRepository;
    private final UnlockRequestRepository unlockRequestRepository;

    // =============================================
    // USER MANAGEMENT
    // =============================================

    @GetMapping("/users")
    public ResponseEntity<List<User>> getAllUsers() {
        return ResponseEntity.ok(userRepository.findAll());
    }

    @GetMapping("/users/{id}")
    public ResponseEntity<?> getUserById(@PathVariable Long id) {
        return userRepository.findById(id).map(user -> {
            Map<String, Object> detail = new HashMap<>();
            detail.put("id", user.getId());
            detail.put("fullName", user.getFullName());
            detail.put("email", user.getEmail());
            detail.put("phone", user.getPhone());
            detail.put("role", user.getRole());
            detail.put("isActive", user.getIsActive());
            detail.put("createdAt", user.getCreatedAt());
            detail.put("lastLoginAt", user.getLastLoginAt());
            detail.put("avatarUrl", user.getAvatarUrl());
            detail.put("darkMode", user.getDarkMode());
            detail.put("twoFactorEnabled", user.getTwoFactorEnabled());
            detail.put("balance", user.getBalance());
            detail.put("defaultAddress", user.getDefaultAddress());
            detail.put("lockReason", user.getLockReason());
            detail.put("lockedAt", user.getLockedAt());
            detail.put("lockedBy", user.getLockedBy());
            detail.put("failedLoginAttempts", user.getFailedLoginAttempts());
            detail.put("accountLockedUntil", user.getAccountLockedUntil());
            detail.put("farmId", user.getFarmId());
            detail.put("approvalStatus", user.getApprovalStatus());
            detail.put("googleId", user.getGoogleId() != null ? "Linked" : null);
            return ResponseEntity.ok(detail);
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/users/{id}/status")
    public ResponseEntity<?> updateUserStatus(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Boolean isActive = (Boolean) body.get("isActive");
        String lockReason = (String) body.get("lockReason");
        return userRepository.findById(id).map(user -> {
            user.setIsActive(isActive);
            if (Boolean.FALSE.equals(isActive)) {
                user.setLockReason(lockReason);
                user.setLockedAt(LocalDateTime.now());
                // Get admin ID from context if possible
            } else {
                user.setLockReason(null);
                user.setLockedAt(null);
                user.setLockedBy(null);
            }
            userRepository.save(user);
            return ResponseEntity.ok(Map.of("success", true, "message", isActive ? "Đã mở khóa tài khoản" : "Đã khóa tài khoản"));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/users/{id}/lock")
    public ResponseEntity<?> lockUser(@PathVariable Long id, @RequestBody Map<String, String> body, Authentication auth) {
        String reason = body.get("reason");
        if (reason == null || reason.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Lý do khóa không được để trống"));
        }
        return userRepository.findById(id).map(user -> {
            user.setIsActive(false);
            user.setLockReason(reason);
            user.setLockedAt(LocalDateTime.now());
            // Get admin id
            if (auth != null && auth.getPrincipal() instanceof User) {
                user.setLockedBy(((User) auth.getPrincipal()).getId());
            }
            userRepository.save(user);
            return ResponseEntity.ok(Map.of("success", true, "message", "Đã khóa tài khoản " + user.getFullName()));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/users/{id}/unlock")
    public ResponseEntity<?> unlockUser(@PathVariable Long id) {
        return userRepository.findById(id).map(user -> {
            user.setIsActive(true);
            user.setLockReason(null);
            user.setLockedAt(null);
            user.setLockedBy(null);
            user.setAccountLockedUntil(null);
            user.setFailedLoginAttempts(0);
            userRepository.save(user);

            // Also approve any pending unlock requests for this user
            List<UnlockRequest> pendingRequests = unlockRequestRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
            pendingRequests.stream()
                .filter(r -> "PENDING".equals(r.getStatus()))
                .forEach(r -> {
                    r.setStatus("APPROVED");
                    r.setReviewedAt(LocalDateTime.now());
                    unlockRequestRepository.save(r);
                });

            return ResponseEntity.ok(Map.of("success", true, "message", "Đã mở khóa tài khoản " + user.getFullName()));
        }).orElse(ResponseEntity.notFound().build());
    }

    // =============================================
    // UNLOCK REQUESTS MANAGEMENT
    // =============================================

    @GetMapping("/unlock-requests")
    public ResponseEntity<?> getUnlockRequests() {
        List<UnlockRequest> requests = unlockRequestRepository.findAllByOrderByCreatedAtDesc();
        // Enrich with user info
        requests.forEach(req -> {
            userRepository.findById(req.getUserId()).ifPresent(user -> {
                req.setUserFullName(user.getFullName());
                req.setUserEmail(user.getEmail());
                req.setUserAvatarUrl(user.getAvatarUrl());
                req.setLockReason(user.getLockReason());
            });
        });
        return ResponseEntity.ok(requests);
    }

    @PutMapping("/unlock-requests/{id}/approve")
    public ResponseEntity<?> approveUnlockRequest(@PathVariable Long id) {
        return unlockRequestRepository.findById(id).map(req -> {
            req.setStatus("APPROVED");
            req.setReviewedAt(LocalDateTime.now());
            unlockRequestRepository.save(req);

            // Unlock user
            userRepository.findById(req.getUserId()).ifPresent(user -> {
                user.setIsActive(true);
                user.setLockReason(null);
                user.setLockedAt(null);
                user.setLockedBy(null);
                user.setAccountLockedUntil(null);
                user.setFailedLoginAttempts(0);
                userRepository.save(user);
            });

            return ResponseEntity.ok(Map.of("success", true, "message", "Đã duyệt và mở khóa tài khoản"));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/unlock-requests/{id}/reject")
    public ResponseEntity<?> rejectUnlockRequest(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return unlockRequestRepository.findById(id).map(req -> {
            req.setStatus("REJECTED");
            String note = body.get("adminNote") != null ? body.get("adminNote") : body.get("note");
            req.setAdminNote(note);
            req.setReviewedAt(LocalDateTime.now());
            unlockRequestRepository.save(req);
            return ResponseEntity.ok(Map.of("success", true, "message", "Đã từ chối yêu cầu mở khóa"));
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
    // DETAIL ENDPOINTS (For Admin Detail Views)
    // =============================================

    @GetMapping("/crops/{id}")
    public ResponseEntity<CropDefinition> getCropById(@PathVariable Long id) {
        return cropDefinitionRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/animals/{id}")
    public ResponseEntity<AnimalDefinition> getAnimalById(@PathVariable Long id) {
        return animalDefinitionRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/animals/{id}/vaccinations")
    public ResponseEntity<List<VaccinationSchedule>> getVaccinationsByAnimal(@PathVariable Long id) {
        return ResponseEntity.ok(vaccinationScheduleRepository.findByAnimalDefinitionId(id));
    }

    @GetMapping("/animals/{id}/feed-compatibility")
    public ResponseEntity<List<AnimalFeedCompatibility>> getFeedCompatibility(@PathVariable Long id) {
        return ResponseEntity.ok(animalFeedCompatibilityRepository.findByAnimalDefinitionId(id));
    }

    @GetMapping("/shop-items/{id}")
    public ResponseEntity<ShopItem> getShopItemById(@PathVariable Long id) {
        return shopItemRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/feed-definitions")
    public ResponseEntity<List<FeedDefinition>> getAllFeedDefinitions() {
        return ResponseEntity.ok(feedDefinitionRepository.findAll());
    }

    @GetMapping("/pest-definitions")
    public ResponseEntity<List<PestDefinition>> getAllPestDefinitions() {
        return ResponseEntity.ok(pestDefinitionRepository.findAll());
    }

    @GetMapping("/shop-items/{id}/reviews")
    public ResponseEntity<?> getShopItemReviews(@PathVariable Long id) {
        // Return empty list — reviews can be expanded later
        return ResponseEntity.ok(List.of());
    }

    // Add endpoint for Feed, Pests if logic differs from ShopItems/General
}
