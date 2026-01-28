package com.agriplanner.repository;

import com.agriplanner.model.ChatRoomMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChatRoomMemberRepository extends JpaRepository<ChatRoomMember, Long> {

    List<ChatRoomMember> findByChatRoom_Id(Long chatRoomId);

    Optional<ChatRoomMember> findByChatRoom_IdAndUser_Id(Long chatRoomId, Long userId);

    boolean existsByChatRoom_IdAndUser_Id(Long chatRoomId, Long userId);

    void deleteByChatRoom_IdAndUser_Id(Long chatRoomId, Long userId);

    long countByChatRoom_Id(Long chatRoomId);

    // Find all chat rooms this user is a member of
    List<ChatRoomMember> findByUser_Id(Long userId);
}
