package com.agriplanner.controller;

import com.agriplanner.model.User;
import com.agriplanner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

/**
 * REST Controller for User profile operations
 */
@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:8000", "http://127.0.0.1:8000" })
@SuppressWarnings("null")
@lombok.extern.slf4j.Slf4j
public class UserController {

    private final UserRepository userRepository;

    /**
     * Get user profile by email
     */
    /**
     * Get user profile by email or current authenticated user
     */
    @GetMapping("/profile")
    public ResponseEntity<?> getProfile(@RequestParam(required = false) String email,
            java.security.Principal principal) {
        String targetEmail = email;

        if (targetEmail == null) {
            if (principal != null) {
                targetEmail = principal.getName();
            } else {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Email parameter is required or user must be logged in"));
            }
        }

        Optional<User> userOpt = userRepository.findByEmail(targetEmail);

        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = userOpt.get();
        java.util.Map<String, Object> response = new java.util.HashMap<>();
        response.put("id", user.getId());
        response.put("fullName", user.getFullName() != null ? user.getFullName() : "");
        response.put("email", user.getEmail());
        response.put("phone", user.getPhone() != null ? user.getPhone() : "");
        response.put("role", user.getRole().name());
        response.put("darkMode", user.getDarkMode() != null ? user.getDarkMode() : false);
        response.put("twoFactorEnabled", user.getTwoFactorEnabled() != null ? user.getTwoFactorEnabled() : false);
        response.put("avatarUrl", user.getAvatarUrl() != null ? user.getAvatarUrl() : "");
        response.put("defaultAddress", user.getDefaultAddress() != null ? user.getDefaultAddress() : "");
        response.put("addressLat", user.getAddressLat());
        response.put("addressLng", user.getAddressLng());
        return ResponseEntity.ok(response);
    }

    /**
     * Update user profile
     */
    @PutMapping("/profile")
    @SuppressWarnings("null")
    public ResponseEntity<?> updateProfile(@RequestBody Map<String, Object> updates) {
        String email = (String) updates.get("email");
        if (email == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email is required"));
        }

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = userOpt.get();

        // Update fields if provided
        if (updates.containsKey("fullName")) {
            user.setFullName((String) updates.get("fullName"));
        }
        if (updates.containsKey("phone")) {
            user.setPhone((String) updates.get("phone"));
        }

        userRepository.save(user);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Cập nhật thông tin thành công"));
    }

    /**
     * Update dark mode preference
     */
    @PutMapping("/dark-mode")
    public ResponseEntity<?> updateDarkMode(@RequestBody Map<String, Object> request) {
        String email = (String) request.get("email");
        Boolean darkMode = (Boolean) request.get("darkMode");

        if (email == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email is required"));
        }

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = userOpt.get();
        user.setDarkMode(darkMode);
        userRepository.save(user);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "darkMode", darkMode));
    }

    /**
     * Update user avatar
     */
    @PutMapping("/avatar")
    public ResponseEntity<?> updateAvatar(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        String avatarUrl = request.get("avatarUrl");

        log.info("Updating avatar for user: {}", email);
        if (avatarUrl != null) {
            log.debug("Avatar content length: {}", avatarUrl.length());
        }

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            log.warn("User not found for avatar update: {}", email);
            return ResponseEntity.notFound().build();
        }

        try {
            User user = userOpt.get();
            user.setAvatarUrl(avatarUrl);
            userRepository.save(user);
            log.info("Avatar updated successfully for user: {}", email);
            return ResponseEntity.ok(Map.of("message", "Cập nhật ảnh đại diện thành công", "avatarUrl", avatarUrl));
        } catch (Exception e) {
            log.error("Error updating avatar for user: {}", email, e);
            return ResponseEntity.status(500).body(Map.of("error", "Error saving avatar: " + e.getMessage()));
        }
    }

    /**
     * Get user map position
     */
    @GetMapping("/map-position")
    public ResponseEntity<?> getMapPosition(@RequestParam String email) {
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = userOpt.get();
        Double lat = user.getMapLat() != null ? user.getMapLat() : 10.0452;
        Double lng = user.getMapLng() != null ? user.getMapLng() : 105.7469;
        Integer zoom = user.getMapZoom() != null ? user.getMapZoom() : 14;

        return ResponseEntity.ok(Map.of(
                "lat", lat,
                "lng", lng,
                "zoom", zoom));
    }

    /**
     * Update user map position
     */
    @PutMapping("/map-position")
    public ResponseEntity<?> updateMapPosition(@RequestBody Map<String, Object> request) {
        String email = (String) request.get("email");
        Double lat = request.get("lat") != null ? ((Number) request.get("lat")).doubleValue() : null;
        Double lng = request.get("lng") != null ? ((Number) request.get("lng")).doubleValue() : null;
        Integer zoom = request.get("zoom") != null ? ((Number) request.get("zoom")).intValue() : null;

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = userOpt.get();
        if (lat != null)
            user.setMapLat(lat);
        if (lng != null)
            user.setMapLng(lng);
        if (zoom != null)
            user.setMapZoom(zoom);
        userRepository.save(user);

        return ResponseEntity.ok(Map.of("success", true));
    }

    /**
     * Get user balance
     */
    @GetMapping("/balance")
    public ResponseEntity<?> getBalance(@RequestParam String email) {
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = userOpt.get();
        java.math.BigDecimal balance = user.getBalance() != null ? user.getBalance() : java.math.BigDecimal.ZERO;

        return ResponseEntity.ok(Map.of(
                "balance", balance,
                "email", user.getEmail()));
    }

    /**
     * Update user balance (for shop purchases)
     */
    @PutMapping("/balance")
    public ResponseEntity<?> updateBalance(@RequestBody Map<String, Object> request) {
        String email = (String) request.get("email");
        if (email == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email is required"));
        }

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = userOpt.get();

        // Handle amount as BigDecimal
        Object amountObj = request.get("amount");
        java.math.BigDecimal amount;
        if (amountObj instanceof Number) {
            amount = java.math.BigDecimal.valueOf(((Number) amountObj).doubleValue());
        } else if (amountObj instanceof String) {
            amount = new java.math.BigDecimal((String) amountObj);
        } else {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid amount"));
        }

        java.math.BigDecimal currentBalance = user.getBalance() != null ? user.getBalance() : java.math.BigDecimal.ZERO;
        java.math.BigDecimal newBalance = currentBalance.add(amount);

        // Don't allow negative balance
        if (newBalance.compareTo(java.math.BigDecimal.ZERO) < 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Số dư không đủ"));
        }

        user.setBalance(newBalance);
        userRepository.save(user);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "balance", newBalance,
                "message", "Cập nhật số dư thành công"));
    }

    /**
     * Update user address
     */
    @PutMapping("/address")
    public ResponseEntity<?> updateAddress(@RequestBody Map<String, Object> request) {
        String email = (String) request.get("email");
        if (email == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email is required"));
        }

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = userOpt.get();

        if (request.containsKey("defaultAddress")) {
            user.setDefaultAddress((String) request.get("defaultAddress"));
        }
        if (request.containsKey("addressLat") && request.get("addressLat") != null) {
            user.setAddressLat(java.math.BigDecimal.valueOf(((Number) request.get("addressLat")).doubleValue()));
        }
        if (request.containsKey("addressLng") && request.get("addressLng") != null) {
            user.setAddressLng(java.math.BigDecimal.valueOf(((Number) request.get("addressLng")).doubleValue()));
        }

        userRepository.save(user);

        java.util.Map<String, Object> response = new java.util.HashMap<>();
        response.put("success", true);
        response.put("message", "Đã cập nhật địa chỉ thành công");
        response.put("defaultAddress", user.getDefaultAddress() != null ? user.getDefaultAddress() : "");
        response.put("addressLat", user.getAddressLat());
        response.put("addressLng", user.getAddressLng());

        return ResponseEntity.ok(response);
    }

    /**
     * Get all users (for dropdowns)
     * Optional: filter by role and/or farmId
     */
    @GetMapping("/list")
    public ResponseEntity<?> listUsers(
            @RequestParam(required = false) String role,
            @RequestParam(required = false) Long farmId) {
        java.util.List<User> users;
        if (role != null && !role.isEmpty()) {
            try {
                com.agriplanner.model.UserRole userRole = com.agriplanner.model.UserRole.valueOf(role.toUpperCase());
                users = userRepository.findByRole(userRole);
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid role"));
            }
        } else {
            users = userRepository.findAll();
        }

        // Filter by farmId if provided
        if (farmId != null) {
            users = users.stream()
                    .filter(u -> farmId.equals(u.getFarmId()))
                    .collect(java.util.stream.Collectors.toList());
        }

        // For WORKER role, also filter only APPROVED workers
        if ("WORKER".equalsIgnoreCase(role)) {
            users = users.stream()
                    .filter(u -> u.getApprovalStatus() == User.ApprovalStatus.APPROVED)
                    .filter(u -> Boolean.TRUE.equals(u.getIsActive()))
                    .collect(java.util.stream.Collectors.toList());
        }

        // Map to DTO to avoid exposing password
        java.util.List<Map<String, Object>> userDtos = users.stream().map(u -> {
            Map<String, Object> map = new java.util.HashMap<>();
            map.put("id", u.getId());
            map.put("fullName", u.getFullName());
            map.put("email", u.getEmail());
            map.put("phone", u.getPhone());
            map.put("role", u.getRole());
            map.put("farmId", u.getFarmId());
            map.put("createdAt", u.getCreatedAt());
            map.put("cvProfile", u.getCvProfile());
            map.put("approvalStatus", u.getApprovalStatus());
            return map;
        }).collect(java.util.stream.Collectors.toList());

        return ResponseEntity.ok(userDtos);
    }
}
