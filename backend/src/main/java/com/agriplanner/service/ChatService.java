package com.agriplanner.service;

import com.agriplanner.model.*;
import com.agriplanner.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
@SuppressWarnings("null")
public class ChatService {

    private final ChatRoomRepository chatRoomRepository;
    private final ChatRoomMemberRepository memberRepository;
    private final CooperativeRepository cooperativeRepository;

    @Transactional
    public ChatRoom createRoom(String name, ChatRoom.ChatRoomType type, User owner, List<User> members) {
        ChatRoom room = ChatRoom.builder()
                .name(name)
                .type(type)
                .owner(owner)
                .build();
        room = chatRoomRepository.save(room);

        // Add owner as admin
        memberRepository.save(ChatRoomMember.builder()
                .chatRoom(room)
                .user(owner)
                .role(ChatRoomMember.MemberRole.ADMIN)
                .build());

        // Add members
        if (members != null) {
            for (User member : members) {
                if (!member.getId().equals(owner.getId())) {
                    memberRepository.save(ChatRoomMember.builder()
                            .chatRoom(room)
                            .user(member)
                            .role(ChatRoomMember.MemberRole.MEMBER)
                            .build());
                }
            }
        }

        return room;
    }

    @Transactional
    public ChatRoom createCooperativeChat(Long cooperativeId) {
        Cooperative cooperative = cooperativeRepository.findById(cooperativeId)
                .orElseThrow(() -> new RuntimeException("Cooperative not found"));

        // Check if exists
        Optional<ChatRoom> existing = chatRoomRepository.findByCooperative_IdAndType(
                cooperativeId, ChatRoom.ChatRoomType.COOPERATIVE);
        if (existing.isPresent()) {
            return existing.get();
        }

        ChatRoom room = ChatRoom.builder()
                .name("Nhóm " + cooperative.getName())
                .type(ChatRoom.ChatRoomType.COOPERATIVE)
                .cooperative(cooperative)
                .owner(cooperative.getLeader())
                .build();
        room = chatRoomRepository.save(room);

        // Add leader as ADMIN
        memberRepository.save(ChatRoomMember.builder()
                .chatRoom(room)
                .user(cooperative.getLeader())
                .role(ChatRoomMember.MemberRole.ADMIN)
                .build());

        // Add existing members
        for (CooperativeMember cm : cooperative.getMembers()) {
            if (!cm.getUser().getId().equals(cooperative.getLeader().getId())) {
                memberRepository.save(ChatRoomMember.builder()
                        .chatRoom(room)
                        .user(cm.getUser())
                        .role(ChatRoomMember.MemberRole.MEMBER)
                        .build());
            }
        }

        log.info("Created chat room for cooperative: {}", cooperative.getName());
        return room;
    }

    @Transactional
    public void addMemberToCooperativeChat(Long cooperativeId, User user) {
        chatRoomRepository.findByCooperative_IdAndType(cooperativeId, ChatRoom.ChatRoomType.COOPERATIVE)
                .ifPresent(room -> {
                    if (!memberRepository.existsByChatRoom_IdAndUser_Id(room.getId(), user.getId())) {
                        memberRepository.save(ChatRoomMember.builder()
                                .chatRoom(room)
                                .user(user)
                                .role(ChatRoomMember.MemberRole.MEMBER)
                                .build());
                        log.info("Added user {} to cooperative chat {}", user.getEmail(), room.getName());
                    }
                });
    }

    @Transactional
    public void dissolveCooperativeChat(Long cooperativeId) {
        chatRoomRepository.findByCooperative_IdAndType(cooperativeId, ChatRoom.ChatRoomType.COOPERATIVE)
                .ifPresent(room -> {
                    // Soft delete or just leave it? Usually dissolve implementation might differ.
                    // For now, let's delete the room and messages/members cascade if configured,
                    // or we can manually delete members.
                    // Assuming CascadeType.ALL on OneToMany relationships in ChatRoom entity
                    chatRoomRepository.delete(room);
                    log.info("Dissolved chat room for cooperative ID: {}", cooperativeId);
                });
    }

    @Transactional(readOnly = true)
    public List<ChatRoom> getUserRooms(Long userId) {
        return chatRoomRepository.findByMemberUserId(userId);
    }
}
