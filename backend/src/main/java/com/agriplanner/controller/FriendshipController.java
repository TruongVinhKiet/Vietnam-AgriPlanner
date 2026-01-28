package com.agriplanner.controller;

import com.agriplanner.model.*;
import com.agriplanner.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/friends")
@RequiredArgsConstructor
@SuppressWarnings("null")
public class FriendshipController {

    private final FriendshipRepository friendshipRepository;
    private final UserRepository userRepository;

    // ==================== FRIENDS LIST ====================

    @GetMapping
    public ResponseEntity<List<User>> getFriends(@RequestParam Long userId) {
        List<Friendship> friendships = friendshipRepository.findFriendsByUserId(userId);
        List<User> friends = friendships.stream()
                .map(f -> f.getRequester().getId().equals(userId) ? f.getAddressee() : f.getRequester())
                .collect(Collectors.toList());
        return ResponseEntity.ok(friends);
    }

    @GetMapping("/ids")
    public ResponseEntity<List<Long>> getFriendIds(@RequestParam Long userId) {
        return ResponseEntity.ok(friendshipRepository.findFriendIdsByUserId(userId));
    }

    @GetMapping("/check")
    public ResponseEntity<Map<String, Object>> checkFriendship(
            @RequestParam Long userId1,
            @RequestParam Long userId2) {
        var friendship = friendshipRepository.findBetweenUsers(userId1, userId2);
        if (friendship.isEmpty()) {
            return ResponseEntity.ok(Map.of("status", "NONE"));
        }
        Friendship f = friendship.get();
        return ResponseEntity.ok(Map.of(
                "status", f.getStatus().name(),
                "requesterId", f.getRequester().getId(),
                "addresseeId", f.getAddressee().getId()));
    }

    // ==================== FRIEND REQUESTS ====================

    @GetMapping("/requests")
    public ResponseEntity<List<Friendship>> getPendingRequests(@RequestParam Long userId) {
        return ResponseEntity.ok(
                friendshipRepository.findByAddresseeIdAndStatusOrderByCreatedAtDesc(
                        userId, Friendship.FriendshipStatus.PENDING));
    }

    @GetMapping("/requests/sent")
    public ResponseEntity<List<Friendship>> getSentRequests(@RequestParam Long userId) {
        return ResponseEntity.ok(
                friendshipRepository.findByRequesterIdAndStatusOrderByCreatedAtDesc(
                        userId, Friendship.FriendshipStatus.PENDING));
    }

    @GetMapping("/requests/count")
    public ResponseEntity<Long> getPendingCount(@RequestParam Long userId) {
        return ResponseEntity.ok(
                friendshipRepository.countByAddresseeIdAndStatus(
                        userId, Friendship.FriendshipStatus.PENDING));
    }

    @PostMapping("/request/{addresseeId}")
    public ResponseEntity<?> sendFriendRequest(
            @PathVariable Long addresseeId,
            @RequestParam Long requesterId) {
        // Check if already exists
        var existing = friendshipRepository.findBetweenUsers(requesterId, addresseeId);
        if (existing.isPresent()) {
            Friendship f = existing.get();
            if (f.getStatus() == Friendship.FriendshipStatus.ACCEPTED) {
                return ResponseEntity.badRequest().body(Map.of("error", "Already friends"));
            }
            if (f.getStatus() == Friendship.FriendshipStatus.PENDING) {
                return ResponseEntity.badRequest().body(Map.of("error", "Request already pending"));
            }
            if (f.getStatus() == Friendship.FriendshipStatus.BLOCKED) {
                return ResponseEntity.badRequest().body(Map.of("error", "Cannot send request"));
            }
        }

        User requester = userRepository.findById(requesterId)
                .orElseThrow(() -> new RuntimeException("Requester not found"));
        User addressee = userRepository.findById(addresseeId)
                .orElseThrow(() -> new RuntimeException("Addressee not found"));

        Friendship friendship = Friendship.builder()
                .requester(requester)
                .addressee(addressee)
                .status(Friendship.FriendshipStatus.PENDING)
                .build();

        return ResponseEntity.ok(friendshipRepository.save(friendship));
    }

    @PostMapping("/accept/{requestId}")
    public ResponseEntity<Friendship> acceptRequest(@PathVariable Long requestId) {
        return friendshipRepository.findById(requestId)
                .map(friendship -> {
                    friendship.setStatus(Friendship.FriendshipStatus.ACCEPTED);
                    return ResponseEntity.ok(friendshipRepository.save(friendship));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/reject/{requestId}")
    public ResponseEntity<Void> rejectRequest(@PathVariable Long requestId) {
        if (friendshipRepository.existsById(requestId)) {
            friendshipRepository.deleteById(requestId);
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.notFound().build();
    }

    @DeleteMapping("/{friendId}")
    public ResponseEntity<Void> unfriend(
            @PathVariable Long friendId,
            @RequestParam Long userId) {
        friendshipRepository.findBetweenUsers(userId, friendId)
                .ifPresent(friendshipRepository::delete);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/suggestions")
    public ResponseEntity<List<User>> getSuggestions(
            @RequestParam Long userId,
            @RequestParam(defaultValue = "10") int limit) {
        // Get user's friends (only ACCEPTED status) - create a new ArrayList to avoid
        // UnsupportedOperationException
        List<Long> excludeIds = new java.util.ArrayList<>(friendshipRepository.findFriendIdsByUserId(userId));
        excludeIds.add(userId); // Exclude self

        // Get users who are not friends (pending users are still shown with different
        // icon in frontend)
        List<User> suggestions = userRepository.findAll().stream()
                .filter(u -> !excludeIds.contains(u.getId()))
                .filter(u -> u.getRole() != UserRole.SYSTEM_ADMIN)
                .limit(limit)
                .collect(Collectors.toList());

        return ResponseEntity.ok(suggestions);
    }
}
