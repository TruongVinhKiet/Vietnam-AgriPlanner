package com.agriplanner.controller;

import com.agriplanner.dto.CommentDTO;
import com.agriplanner.dto.PostFeedDTO;
import com.agriplanner.model.*;
import com.agriplanner.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/posts")
@RequiredArgsConstructor
@SuppressWarnings("null")
public class PostController {

    private final PostRepository postRepository;
    private final PostReactionRepository reactionRepository;
    private final CommentRepository commentRepository;
    private final CommentReactionRepository commentReactionRepository;
    private final UserRepository userRepository;

    // ==================== POSTS ====================

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<Page<PostFeedDTO>> getFeed(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal User currentUser) {
        Page<Post> postsPage = postRepository
                .findByIsApprovedTrueAndIsHiddenFalseOrderByCreatedAtDesc(PageRequest.of(page, size));

        Long currentUserId = currentUser != null ? currentUser.getId() : null;
        Page<PostFeedDTO> dtoPage = postsPage.map(post -> toPostFeedDTO(post, currentUserId));
        return ResponseEntity.ok(dtoPage);
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<Page<Post>> getUserPosts(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(
                postRepository.findByAuthorIdOrderByCreatedAtDesc(userId, PageRequest.of(page, size)));
    }

    @PostMapping
    public ResponseEntity<Post> createPost(@RequestBody Map<String, Object> request) {
        Long userId = Long.parseLong(request.get("userId").toString());
        String content = (String) request.get("content");
        String images = request.get("images") != null ? request.get("images").toString() : null;
        String videos = request.get("videos") != null ? request.get("videos").toString() : null;

        User author = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Posts require admin approval before showing in feed (except for admins)
        boolean needsApproval = !UserRole.SYSTEM_ADMIN.equals(author.getRole());

        Post post = Post.builder()
                .author(author)
                .content(content)
                .images(images)
                .videos(videos)
                .isApproved(!needsApproval)
                .build();

        return ResponseEntity.ok(postRepository.save(post));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Post> updatePost(
            @PathVariable Long id,
            @RequestBody Map<String, Object> request) {
        return postRepository.findById(id)
                .map(post -> {
                    if (request.containsKey("content")) {
                        post.setContent((String) request.get("content"));
                    }
                    if (request.containsKey("images")) {
                        post.setImages(request.get("images").toString());
                    }
                    if (request.containsKey("videos")) {
                        post.setVideos(request.get("videos").toString());
                    }
                    return ResponseEntity.ok(postRepository.save(post));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/upload-video")
    public ResponseEntity<Map<String, String>> uploadVideo(
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        try {
            // Check if file is empty
            if (file.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "File is empty"));
            }

            // Validate file type
            String contentType = file.getContentType();
            String type = "videos";
            if (contentType != null && contentType.startsWith("image/")) {
                type = "images";
            } else if (contentType == null || !contentType.startsWith("video/")) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Invalid file type. Only videos and images are allowed."));
            }

            // Create upload directory if not exists
            String uploadDir = "uploads/" + type + "/";
            java.io.File directory = new java.io.File(uploadDir);
            if (!directory.exists()) {
                directory.mkdirs();
            }

            // Generate unique filename
            String originalFilename = file.getOriginalFilename();
            String extension = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                extension = originalFilename.substring(originalFilename.lastIndexOf("."));
            }
            String filename = java.util.UUID.randomUUID().toString() + extension;
            String filepath = uploadDir + filename;

            // Save file
            java.nio.file.Path path = java.nio.file.Paths.get(filepath);
            java.nio.file.Files.copy(file.getInputStream(), path, java.nio.file.StandardCopyOption.REPLACE_EXISTING);

            // Return URL
            String fileUrl = "/uploads/" + type + "/" + filename;

            return ResponseEntity.ok(Map.of("url", fileUrl));
        } catch (java.io.IOException e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to upload video: " + e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePost(@PathVariable Long id) {
        postRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }

    // ==================== REACTIONS ====================

    @PostMapping("/{postId}/react")
    public ResponseEntity<?> addReaction(
            @PathVariable Long postId,
            @RequestBody Map<String, Object> request) {
        Long userId = Long.parseLong(request.get("userId").toString());
        String reactionTypeStr = request.get("reactionType") != null
                ? request.get("reactionType").toString()
                : "LIKE";

        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new RuntimeException("Post not found"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Check if already reacted
        var existing = reactionRepository.findByPost_IdAndUser_Id(postId, userId);
        if (existing.isPresent()) {
            // Update reaction type
            PostReaction reaction = existing.get();
            reaction.setReactionType(PostReaction.ReactionType.valueOf(reactionTypeStr));
            return ResponseEntity.ok(reactionRepository.save(reaction));
        }

        // Create new reaction
        PostReaction reaction = PostReaction.builder()
                .post(post)
                .user(user)
                .reactionType(PostReaction.ReactionType.valueOf(reactionTypeStr))
                .build();

        post.incrementLikeCount();
        postRepository.save(post);

        return ResponseEntity.ok(reactionRepository.save(reaction));
    }

    @DeleteMapping("/{postId}/react")
    public ResponseEntity<Void> removeReaction(
            @PathVariable Long postId,
            @RequestParam Long userId) {
        var existing = reactionRepository.findByPost_IdAndUser_Id(postId, userId);
        if (existing.isPresent()) {
            reactionRepository.delete(existing.get());
            postRepository.findById(postId).ifPresent(post -> {
                post.decrementLikeCount();
                postRepository.save(post);
            });
        }
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{postId}/reactions")
    public ResponseEntity<List<PostReaction>> getReactions(@PathVariable Long postId) {
        return ResponseEntity.ok(reactionRepository.findByPost_Id(postId));
    }

    // ==================== COMMENTS ====================

    @GetMapping("/{postId}/comments")
    @Transactional(readOnly = true)
    public ResponseEntity<Page<CommentDTO>> getComments(
            @PathVariable Long postId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal User currentUser) {
        Page<Comment> commentsPage = commentRepository.findByPostIdAndParentIsNullAndIsHiddenFalseOrderByCreatedAtDesc(
                postId, PageRequest.of(page, size));

        Long currentUserId = currentUser != null ? currentUser.getId() : null;
        Page<CommentDTO> dtoPage = commentsPage.map(comment -> toCommentDTO(comment, currentUserId));
        return ResponseEntity.ok(dtoPage);
    }

    @PostMapping("/comments/{commentId}/react")
    @Transactional
    public ResponseEntity<?> addCommentReaction(
            @PathVariable Long commentId,
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal User currentUser) {
        Long userId = null;
        if (request != null && request.get("userId") != null) {
            userId = Long.parseLong(request.get("userId").toString());
        } else if (currentUser != null) {
            userId = currentUser.getId();
        }
        if (userId == null) {
            return ResponseEntity.badRequest().body("Missing userId");
        }

        String reactionTypeStr = request != null && request.get("reactionType") != null
                ? request.get("reactionType").toString()
                : "LIKE";

        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new RuntimeException("Comment not found"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        var existing = commentReactionRepository.findByComment_IdAndUser_Id(commentId, userId);
        if (existing.isPresent()) {
            CommentReaction reaction = existing.get();
            reaction.setReactionType(PostReaction.ReactionType.valueOf(reactionTypeStr));
            return ResponseEntity.ok(commentReactionRepository.save(reaction));
        }

        CommentReaction reaction = CommentReaction.builder()
                .comment(comment)
                .user(user)
                .reactionType(PostReaction.ReactionType.valueOf(reactionTypeStr))
                .build();

        Integer startCount = comment.getLikeCount() != null ? comment.getLikeCount() : 0;
        comment.setLikeCount(startCount + 1);
        commentRepository.save(comment);

        return ResponseEntity.ok(commentReactionRepository.save(reaction));
    }

    @DeleteMapping("/comments/{commentId}/react")
    @Transactional
    public ResponseEntity<Void> removeCommentReaction(
            @PathVariable Long commentId,
            @RequestParam(required = false) Long userId,
            @AuthenticationPrincipal User currentUser) {
        Long resolvedUserId = userId != null ? userId : (currentUser != null ? currentUser.getId() : null);
        if (resolvedUserId == null) {
            return ResponseEntity.badRequest().build();
        }

        var existing = commentReactionRepository.findByComment_IdAndUser_Id(commentId, resolvedUserId);
        if (existing.isPresent()) {
            commentReactionRepository.delete(existing.get());
            commentRepository.findById(commentId).ifPresent(comment -> {
                Integer startCount = comment.getLikeCount() != null ? comment.getLikeCount() : 0;
                if (startCount > 0) {
                    comment.setLikeCount(startCount - 1);
                    commentRepository.save(comment);
                }
            });
        }

        return ResponseEntity.ok().build();
    }

    @PostMapping("/{postId}/comments")
    public ResponseEntity<Comment> addComment(
            @PathVariable Long postId,
            @RequestBody Map<String, Object> request) {
        Long userId = Long.parseLong(request.get("userId").toString());
        String content = (String) request.get("content");
        String imageUrl = (String) request.get("imageUrl");
        String videoUrl = (String) request.get("videoUrl");
        Long parentId = request.get("parentId") != null
                ? Long.parseLong(request.get("parentId").toString())
                : null;

        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new RuntimeException("Post not found"));
        User author = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Comment.CommentBuilder builder = Comment.builder()
                .post(post)
                .author(author)
                .content(content)
                .imageUrl(imageUrl)
                .videoUrl(videoUrl);

        if (parentId != null) {
            Comment parent = commentRepository.findById(parentId)
                    .orElseThrow(() -> new RuntimeException("Parent comment not found"));
            builder.parent(parent);
        }

        Comment comment = builder.build();
        post.incrementCommentCount();
        postRepository.save(post);

        return ResponseEntity.ok(commentRepository.save(comment));
    }

    @DeleteMapping("/comments/{commentId}")
    public ResponseEntity<Void> deleteComment(@PathVariable Long commentId) {
        commentRepository.findById(commentId).ifPresent(comment -> {
            Post post = comment.getPost();
            post.decrementCommentCount();
            postRepository.save(post);
            commentRepository.delete(comment);
        });
        return ResponseEntity.ok().build();
    }

    private CommentDTO toCommentDTO(Comment comment, Long currentUserId) {
        CommentDTO.AuthorDTO authorDTO = null;
        User author = comment.getAuthor();
        if (author != null) {
            authorDTO = CommentDTO.AuthorDTO.builder()
                    .id(author.getId())
                    .fullName(author.getFullName())
                    .avatarUrl(author.getAvatarUrl())
                    .build();
        }

        Map<String, Long> reactionCounts = new HashMap<>();
        List<Object[]> counts = commentReactionRepository.countByReactionType(comment.getId());
        for (Object[] row : counts) {
            if (row == null || row.length < 2 || row[0] == null || row[1] == null) {
                continue;
            }
            reactionCounts.put(row[0].toString(), ((Number) row[1]).longValue());
        }

        String userReaction = null;
        if (currentUserId != null) {
            var existing = commentReactionRepository.findByComment_IdAndUser_Id(comment.getId(), currentUserId);
            if (existing.isPresent() && existing.get().getReactionType() != null) {
                userReaction = existing.get().getReactionType().name();
            }
        }

        List<Comment> replies = commentRepository.findByParentIdAndIsHiddenFalseOrderByCreatedAtAsc(comment.getId());
        List<CommentDTO> replyDTOs = new ArrayList<>();
        for (Comment reply : replies) {
            replyDTOs.add(toCommentDTO(reply, currentUserId));
        }

        return CommentDTO.builder()
                .id(comment.getId())
                .postId(comment.getPost() != null ? comment.getPost().getId() : null)
                .parentId(comment.getParent() != null ? comment.getParent().getId() : null)
                .author(authorDTO)
                .content(comment.getContent())
                .imageUrl(comment.getImageUrl())
                .videoUrl(comment.getVideoUrl())
                .likeCount(comment.getLikeCount() != null ? comment.getLikeCount() : 0)
                .isHidden(comment.getIsHidden())
                .createdAt(comment.getCreatedAt())
                .reactionCounts(reactionCounts)
                .userReaction(userReaction)
                .replies(replyDTOs)
                .build();
    }

    private PostFeedDTO toPostFeedDTO(Post post, Long currentUserId) {
        PostFeedDTO.AuthorDTO authorDTO = null;
        User author = post.getAuthor();
        if (author != null) {
            authorDTO = PostFeedDTO.AuthorDTO.builder()
                    .id(author.getId())
                    .fullName(author.getFullName())
                    .avatarUrl(author.getAvatarUrl())
                    .build();
        }

        Map<String, Long> reactionCounts = new HashMap<>();
        List<Object[]> counts = reactionRepository.countByReactionType(post.getId());
        for (Object[] row : counts) {
            if (row == null || row.length < 2 || row[0] == null || row[1] == null) {
                continue;
            }
            reactionCounts.put(row[0].toString(), ((Number) row[1]).longValue());
        }

        String userReaction = null;
        if (currentUserId != null) {
            var existing = reactionRepository.findByPost_IdAndUser_Id(post.getId(), currentUserId);
            if (existing.isPresent() && existing.get().getReactionType() != null) {
                userReaction = existing.get().getReactionType().name();
            }
        }

        return PostFeedDTO.builder()
                .id(post.getId())
                .author(authorDTO)
                .content(post.getContent())
                .images(post.getImages())
                .videos(post.getVideos())
                .isApproved(post.getIsApproved())
                .isHidden(post.getIsHidden())
                .likeCount(post.getLikeCount() != null ? post.getLikeCount() : 0)
                .commentCount(post.getCommentCount() != null ? post.getCommentCount() : 0)
                .shareCount(post.getShareCount() != null ? post.getShareCount() : 0)
                .createdAt(post.getCreatedAt())
                .updatedAt(post.getUpdatedAt())
                .reactionCounts(reactionCounts)
                .userReaction(userReaction)
                .build();
    }
}
