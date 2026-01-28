package com.agriplanner.controller;

import com.agriplanner.model.Notification;
import com.agriplanner.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST Controller for Notifications
 */
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@SuppressWarnings("null")
public class NotificationController {

    private final NotificationRepository notificationRepository;

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<Notification>> getByUser(@PathVariable Long userId) {
        return ResponseEntity.ok(notificationRepository.findByUserIdOrderByCreatedAtDesc(userId));
    }

    @GetMapping("/user/{userId}/unread")
    public ResponseEntity<List<Notification>> getUnreadByUser(@PathVariable Long userId) {
        return ResponseEntity.ok(notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(userId));
    }

    @GetMapping("/user/{userId}/count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(@PathVariable Long userId) {
        long count = notificationRepository.countByUserIdAndIsReadFalse(userId);
        return ResponseEntity.ok(Map.of("unreadCount", count));
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<?> markAsRead(@PathVariable Long id) {
        return notificationRepository.findById(id)
                .map(n -> {
                    n.setIsRead(true);
                    notificationRepository.save(n);
                    return ResponseEntity.ok(n);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/user/{userId}/read-all")
    public ResponseEntity<?> markAllAsRead(@PathVariable Long userId) {
        List<Notification> unread = notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(userId);
        unread.forEach(n -> n.setIsRead(true));
        notificationRepository.saveAll(unread);
        return ResponseEntity.ok(Map.of("message", "Marked " + unread.size() + " notifications as read"));
    }

    @PostMapping
    public ResponseEntity<Notification> create(@RequestBody Notification notification) {
        if (notification.getUserId() == null) {
            // Default to user 1 if not provided (for this phase)
            notification.setUserId(1L);
        }
        notification.setCreatedAt(java.time.LocalDateTime.now());
        notification.setIsRead(false); // Default unread

        Notification saved = notificationRepository.save(notification);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        notificationRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Deleted successfully"));
    }
}
