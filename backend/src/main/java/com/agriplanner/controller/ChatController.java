package com.agriplanner.controller;

import com.agriplanner.model.*;
import com.agriplanner.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
@SuppressWarnings("null")
public class ChatController {

        private final ChatRoomRepository chatRoomRepository;
        private final ChatRoomMemberRepository memberRepository;
        private final ChatMessageRepository messageRepository;
        private final UserRepository userRepository;
        private final com.agriplanner.service.ChatService chatService;

        // ==================== CHAT ROOMS ====================

        @GetMapping("/rooms")
        public ResponseEntity<List<ChatRoom>> getUserRooms(@RequestParam Long userId) {
                return ResponseEntity.ok(chatRoomRepository.findByMemberUserId(userId));
        }

        @GetMapping("/rooms/{roomId}")
        public ResponseEntity<ChatRoom> getRoom(@PathVariable Long roomId) {
                return chatRoomRepository.findById(roomId)
                                .map(ResponseEntity::ok)
                                .orElse(ResponseEntity.notFound().build());
        }

        @PostMapping("/rooms")
        public ResponseEntity<ChatRoom> createRoom(@RequestBody Map<String, Object> request) {
                Long ownerId = Long.parseLong(request.get("ownerId").toString());
                String name = (String) request.get("name");
                String typeStr = request.get("type") != null
                                ? request.get("type").toString()
                                : "GROUP";

                User owner = userRepository.findById(ownerId)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                ChatRoom room = ChatRoom.builder()
                                .name(name)
                                .type(ChatRoom.ChatRoomType.valueOf(typeStr))
                                .owner(owner)
                                .build();

                room = chatRoomRepository.save(room);
                final ChatRoom savedRoom = room;

                // Add owner as admin member
                ChatRoomMember ownerMember = ChatRoomMember.builder()
                                .chatRoom(savedRoom)
                                .user(owner)
                                .role(ChatRoomMember.MemberRole.ADMIN)
                                .build();
                memberRepository.save(ownerMember);

                // Add other members if specified
                if (request.containsKey("memberIds")) {
                        @SuppressWarnings("unchecked")
                        List<Integer> memberIds = (List<Integer>) request.get("memberIds");
                        for (Integer memberId : memberIds) {
                                if (memberId.longValue() != ownerId) {
                                        userRepository.findById(memberId.longValue()).ifPresent(user -> {
                                                ChatRoomMember member = ChatRoomMember.builder()
                                                                .chatRoom(savedRoom)
                                                                .user(user)
                                                                .role(ChatRoomMember.MemberRole.MEMBER)
                                                                .build();
                                                memberRepository.save(member);
                                        });
                                }
                        }
                }

                return ResponseEntity.ok(chatRoomRepository.findById(savedRoom.getId()).orElse(savedRoom));
        }

        // Start private chat
        @PostMapping("/rooms/private")
        public ResponseEntity<ChatRoom> startPrivateChat(@RequestBody Map<String, Long> request) {
                Long userId1 = request.get("userId1");
                Long userId2 = request.get("userId2");

                // Check if chat already exists
                var existing = chatRoomRepository.findPrivateChatBetween(userId1, userId2);
                if (existing.isPresent()) {
                        return ResponseEntity.ok(existing.get());
                }

                User user1 = userRepository.findById(userId1)
                                .orElseThrow(() -> new RuntimeException("User 1 not found"));
                User user2 = userRepository.findById(userId2)
                                .orElseThrow(() -> new RuntimeException("User 2 not found"));

                ChatRoom room = ChatRoom.builder()
                                .type(ChatRoom.ChatRoomType.PRIVATE)
                                .build();
                room = chatRoomRepository.save(room);

                memberRepository.save(ChatRoomMember.builder()
                                .chatRoom(room).user(user1).build());
                memberRepository.save(ChatRoomMember.builder()
                                .chatRoom(room).user(user2).build());

                return ResponseEntity.ok(chatRoomRepository.findById(room.getId()).orElse(room));
        }

        // Get or create admin support chat for a user
        @GetMapping("/admin")
        public ResponseEntity<ChatRoom> getOrCreateAdminChat(@RequestParam Long userId) {
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                // Try to find existing admin chat for this user
                var existing = chatRoomRepository.findByTypeAndOwner_Id(
                                ChatRoom.ChatRoomType.PRIVATE, userId);

                // Look for admin chat (room name contains "Admin Support")
                for (ChatRoom room : existing) {
                        if (room.getName() != null && room.getName().contains("Admin Support")) {
                                return ResponseEntity.ok(room);
                        }
                }

                // Create new admin support chat
                ChatRoom room = ChatRoom.builder()
                                .name("Admin Support - " + user.getFullName())
                                .type(ChatRoom.ChatRoomType.PRIVATE)
                                .owner(user)
                                .build();
                final ChatRoom savedRoom = chatRoomRepository.save(room);

                // Add user as member
                memberRepository.save(ChatRoomMember.builder()
                                .chatRoom(savedRoom).user(user).role(ChatRoomMember.MemberRole.MEMBER).build());

                // Add system admin as member (find first admin)
                userRepository.findByRole(UserRole.SYSTEM_ADMIN).stream().findFirst().ifPresent(admin -> {
                        memberRepository.save(ChatRoomMember.builder()
                                        .chatRoom(savedRoom).user(admin).role(ChatRoomMember.MemberRole.ADMIN).build());
                });

                return ResponseEntity.ok(chatRoomRepository.findById(savedRoom.getId()).orElse(savedRoom));
        }

        // Send system notification to user's admin chat
        @PostMapping("/admin/notify")
        public ResponseEntity<?> sendAdminNotification(@RequestBody Map<String, Object> request) {
                Long userId = Long.parseLong(request.get("userId").toString());
                String content = (String) request.get("content");

                // Get or create admin chat
                var adminChatResponse = getOrCreateAdminChat(userId);
                ChatRoom room = adminChatResponse.getBody();
                if (room == null) {
                        return ResponseEntity.badRequest().body(Map.of("error", "Could not create admin chat"));
                }

                // Get system admin as sender
                User sender = userRepository.findByRole(UserRole.SYSTEM_ADMIN).stream().findFirst()
                                .orElseThrow(() -> new RuntimeException("No admin found"));

                ChatMessage message = ChatMessage.builder()
                                .chatRoom(room)
                                .sender(sender)
                                .content(content)
                                .messageType(ChatMessage.MessageType.SYSTEM)
                                .build();
                messageRepository.save(message);

                return ResponseEntity.ok(Map.of("success", true));
        }

        // ==================== MEMBERS ====================

        @GetMapping("/rooms/{roomId}/members")
        public ResponseEntity<List<ChatRoomMember>> getRoomMembers(@PathVariable Long roomId) {
                return ResponseEntity.ok(memberRepository.findByChatRoom_Id(roomId));
        }

        @PostMapping("/rooms/{roomId}/members")
        public ResponseEntity<ChatRoomMember> addMember(
                        @PathVariable Long roomId,
                        @RequestBody Map<String, Long> request) {
                Long userId = request.get("userId");

                ChatRoom room = chatRoomRepository.findById(roomId)
                                .orElseThrow(() -> new RuntimeException("Room not found"));

                // Cannot add members to cooperative rooms manually
                if (room.getType() == ChatRoom.ChatRoomType.COOPERATIVE) {
                        return ResponseEntity.badRequest().build();
                }

                if (memberRepository.existsByChatRoom_IdAndUser_Id(roomId, userId)) {
                        return ResponseEntity.badRequest().build();
                }

                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                ChatRoomMember member = ChatRoomMember.builder()
                                .chatRoom(room)
                                .user(user)
                                .build();

                return ResponseEntity.ok(memberRepository.save(member));
        }

        @DeleteMapping("/rooms/{roomId}/members/{userId}")
        public ResponseEntity<Void> kickMember(
                        @PathVariable Long roomId,
                        @PathVariable Long userId,
                        @RequestParam Long requesterId) {
                ChatRoom room = chatRoomRepository.findById(roomId)
                                .orElseThrow(() -> new RuntimeException("Room not found"));

                // Cannot kick from cooperative rooms
                if (room.getType() == ChatRoom.ChatRoomType.COOPERATIVE) {
                        return ResponseEntity.badRequest().build();
                }

                // Check if requester is admin
                var requesterMember = memberRepository.findByChatRoom_IdAndUser_Id(roomId, requesterId);
                if (requesterMember.isEmpty() || requesterMember.get().getRole() != ChatRoomMember.MemberRole.ADMIN) {
                        return ResponseEntity.status(403).build();
                }

                memberRepository.findByChatRoom_IdAndUser_Id(roomId, userId)
                                .ifPresent(memberRepository::delete);

                return ResponseEntity.ok().build();
        }

        // ==================== MESSAGES ====================

        @GetMapping("/rooms/{roomId}/messages")
        public ResponseEntity<Page<ChatMessage>> getMessages(
                        @PathVariable Long roomId,
                        @RequestParam(defaultValue = "0") int page,
                        @RequestParam(defaultValue = "50") int size) {
                return ResponseEntity.ok(
                                messageRepository.findByChatRoom_IdAndIsDeletedFalseOrderByCreatedAtDesc(
                                                roomId, PageRequest.of(page, size)));
        }

        @PostMapping("/rooms/{roomId}/messages")
        public ResponseEntity<ChatMessage> sendMessage(
                        @PathVariable Long roomId,
                        @RequestBody Map<String, Object> request) {
                Long senderId = Long.parseLong(request.get("senderId").toString());
                String content = (String) request.get("content");
                String messageTypeStr = request.get("messageType") != null
                                ? request.get("messageType").toString()
                                : "TEXT";
                String attachmentUrl = (String) request.get("attachmentUrl");

                ChatRoom room = chatRoomRepository.findById(roomId)
                                .orElseThrow(() -> new RuntimeException("Room not found"));
                User sender = userRepository.findById(senderId)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                // Check if sender is a member
                if (!memberRepository.existsByChatRoom_IdAndUser_Id(roomId, senderId)) {
                        return ResponseEntity.status(403).build();
                }

                ChatMessage message = ChatMessage.builder()
                                .chatRoom(room)
                                .sender(sender)
                                .content(content)
                                .messageType(ChatMessage.MessageType.valueOf(messageTypeStr))
                                .attachmentUrl(attachmentUrl)
                                .build();

                room.updateLastMessageTime();
                chatRoomRepository.save(room);

                return ResponseEntity.ok(messageRepository.save(message));
        }

        @DeleteMapping("/messages/{messageId}")
        public ResponseEntity<Void> deleteMessage(
                        @PathVariable Long messageId,
                        @RequestParam Long userId) {
                messageRepository.findById(messageId).ifPresent(message -> {
                        if (message.getSender().getId().equals(userId)) {
                                message.setIsDeleted(true);
                                messageRepository.save(message);
                        }
                });
                return ResponseEntity.ok().build();
        }

        // Like/React to a message with specific emoji
        @PostMapping("/messages/{messageId}/like")
        public ResponseEntity<?> likeMessage(@PathVariable Long messageId,
                        @RequestBody(required = false) Map<String, String> request) {
                String emoji = request != null && request.get("emoji") != null ? request.get("emoji") : "👍";
                return messageRepository.findById(messageId).map(message -> {
                        message.setLikeCount((message.getLikeCount() != null ? message.getLikeCount() : 0) + 1);
                        // Store emoji in metadata
                        String metadata = message.getMetadata();
                        if (metadata == null)
                                metadata = "{}";
                        try {
                                var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                                var node = mapper.readTree(metadata);
                                ((com.fasterxml.jackson.databind.node.ObjectNode) node).put("lastReaction", emoji);
                                message.setMetadata(mapper.writeValueAsString(node));
                        } catch (Exception e) {
                                message.setMetadata("{\"lastReaction\":\"" + emoji + "\"}");
                        }
                        messageRepository.save(message);
                        return ResponseEntity.ok(
                                        Map.of("success", true, "likeCount", message.getLikeCount(), "emoji", emoji));
                }).orElse(ResponseEntity.notFound().build());
        }

        // Unlike/Remove reaction from a message
        @PostMapping("/messages/{messageId}/unlike")
        public ResponseEntity<?> unlikeMessage(@PathVariable Long messageId) {
                return messageRepository.findById(messageId).map(message -> {
                        int currentLikes = message.getLikeCount() != null ? message.getLikeCount() : 0;
                        message.setLikeCount(Math.max(0, currentLikes - 1));
                        messageRepository.save(message);
                        return ResponseEntity.ok(Map.of("success", true, "likeCount", message.getLikeCount()));
                }).orElse(ResponseEntity.notFound().build());
        }

        // Update message metadata (used for marking transfer as completed)
        @PostMapping("/messages/{messageId}/metadata")
        public ResponseEntity<?> updateMessageMetadata(@PathVariable Long messageId,
                        @RequestBody Map<String, Object> metadataUpdate) {
                return messageRepository.findById(messageId).map(message -> {
                        try {
                                var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                                String existingMetadata = message.getMetadata();
                                java.util.Map<String, Object> metadata = existingMetadata != null
                                                ? mapper.readValue(existingMetadata,
                                                                new com.fasterxml.jackson.core.type.TypeReference<java.util.Map<String, Object>>() {
                                                                })
                                                : new java.util.HashMap<>();
                                metadata.putAll(metadataUpdate);
                                message.setMetadata(mapper.writeValueAsString(metadata));
                                messageRepository.save(message);
                                return ResponseEntity.ok(Map.of("success", true));
                        } catch (Exception e) {
                                return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
                        }
                }).orElse(ResponseEntity.notFound().build());
        }

        // ==================== COOPERATIVE CHAT ====================

        // Create cooperative chat room (called when cooperative is approved)
        // This endpoint might be redundant if service calls it directly, but strictly
        // keeping it API accessible if needed.
        @PostMapping("/cooperative/{cooperativeId}")
        public ResponseEntity<ChatRoom> createCooperativeChat(@PathVariable Long cooperativeId) {
                return ResponseEntity.ok(chatService.createCooperativeChat(cooperativeId));
        }

        // Mark messages as read
        @PostMapping("/rooms/{roomId}/read")
        public ResponseEntity<Void> markAsRead(
                        @PathVariable Long roomId,
                        @RequestParam Long userId) {
                memberRepository.findByChatRoom_IdAndUser_Id(roomId, userId).ifPresent(member -> {
                        member.setLastReadAt(ZonedDateTime.now());
                        memberRepository.save(member);
                });
                return ResponseEntity.ok().build();
        }
}
