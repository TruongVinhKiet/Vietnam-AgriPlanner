package com.agriplanner.repository;

import com.agriplanner.model.ChatMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    // Get messages for a chat room (paginated, newest first for loading history)
    Page<ChatMessage> findByChatRoom_IdAndIsDeletedFalseOrderByCreatedAtDesc(Long chatRoomId, Pageable pageable);

    // Get latest messages (for display, oldest first)
    List<ChatMessage> findTop50ByChatRoom_IdAndIsDeletedFalseOrderByCreatedAtAsc(Long chatRoomId);

    // Get latest message for a room (for preview)
    ChatMessage findFirstByChatRoom_IdAndIsDeletedFalseOrderByCreatedAtDesc(Long chatRoomId);

    // Count unread messages
    long countByChatRoom_IdAndIsDeletedFalse(Long chatRoomId);
}
