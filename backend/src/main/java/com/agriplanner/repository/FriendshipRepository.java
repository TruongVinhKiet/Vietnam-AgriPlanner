package com.agriplanner.repository;

import com.agriplanner.model.Friendship;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FriendshipRepository extends JpaRepository<Friendship, Long> {

        // Check if a friendship exists (either direction)
        @Query("SELECT f FROM Friendship f WHERE " +
                        "(f.requester.id = :userId1 AND f.addressee.id = :userId2) OR " +
                        "(f.requester.id = :userId2 AND f.addressee.id = :userId1)")
        Optional<Friendship> findBetweenUsers(Long userId1, Long userId2);

        // Get pending requests received by user
        List<Friendship> findByAddresseeIdAndStatusOrderByCreatedAtDesc(Long addresseeId,
                        Friendship.FriendshipStatus status);

        // Get pending requests sent by user
        List<Friendship> findByRequesterIdAndStatusOrderByCreatedAtDesc(Long requesterId,
                        Friendship.FriendshipStatus status);

        // Get all friends of a user (accepted status, both directions)
        @Query("SELECT f FROM Friendship f WHERE f.status = 'ACCEPTED' AND " +
                        "(f.requester.id = :userId OR f.addressee.id = :userId)")
        List<Friendship> findFriendsByUserId(Long userId);

        // Get friend IDs for a user
        @Query("SELECT CASE WHEN f.requester.id = :userId THEN f.addressee.id ELSE f.requester.id END " +
                        "FROM Friendship f WHERE f.status = 'ACCEPTED' AND " +
                        "(f.requester.id = :userId OR f.addressee.id = :userId)")
        List<Long> findFriendIdsByUserId(Long userId);

        // Count pending requests
        long countByAddresseeIdAndStatus(Long addresseeId, Friendship.FriendshipStatus status);

        // Check if they are already friends
        @Query("SELECT COUNT(f) > 0 FROM Friendship f WHERE f.status = 'ACCEPTED' AND " +
                        "((f.requester.id = :userId1 AND f.addressee.id = :userId2) OR " +
                        "(f.requester.id = :userId2 AND f.addressee.id = :userId1))")
        boolean areFriends(Long userId1, Long userId2);

        // Get user IDs with pending requests (both sent to and received from)
        @Query("SELECT CASE WHEN f.requester.id = :userId THEN f.addressee.id ELSE f.requester.id END " +
                        "FROM Friendship f WHERE f.status = 'PENDING' AND " +
                        "(f.requester.id = :userId OR f.addressee.id = :userId)")
        List<Long> findPendingUserIds(Long userId);
}
