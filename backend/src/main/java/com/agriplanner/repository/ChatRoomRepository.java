package com.agriplanner.repository;

import com.agriplanner.model.ChatRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {

    // Find rooms where user is a member
    @Query("SELECT cr FROM ChatRoom cr JOIN cr.members m WHERE m.user.id = :userId ORDER BY cr.lastMessageAt DESC")
    List<ChatRoom> findByMemberUserId(Long userId);

    // Find private chat between two users
    @Query("SELECT cr FROM ChatRoom cr WHERE cr.type = 'PRIVATE' AND " +
            "EXISTS (SELECT m1 FROM ChatRoomMember m1 WHERE m1.chatRoom = cr AND m1.user.id = :userId1) AND " +
            "EXISTS (SELECT m2 FROM ChatRoomMember m2 WHERE m2.chatRoom = cr AND m2.user.id = :userId2)")
    Optional<ChatRoom> findPrivateChatBetween(Long userId1, Long userId2);

    // Find cooperative chat room
    Optional<ChatRoom> findByCooperative_IdAndType(Long cooperativeId, ChatRoom.ChatRoomType type);

    // Find all group chats owned by user
    List<ChatRoom> findByOwner_IdAndTypeOrderByCreatedAtDesc(Long ownerId, ChatRoom.ChatRoomType type);

    // Find rooms by type and owner
    List<ChatRoom> findByTypeAndOwner_Id(ChatRoom.ChatRoomType type, Long ownerId);
}
