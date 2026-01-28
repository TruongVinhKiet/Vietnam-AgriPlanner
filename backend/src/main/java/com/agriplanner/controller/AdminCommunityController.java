package com.agriplanner.controller;

import com.agriplanner.dto.CommentDTO;

import com.agriplanner.dto.PostFeedDTO;
import com.agriplanner.model.*;
import com.agriplanner.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.ZonedDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/community")
@RequiredArgsConstructor
@SuppressWarnings("null")
public class AdminCommunityController {

    private final GuideRepository guideRepository;
    private final GuideCategoryRepository categoryRepository;
    private final PostRepository postRepository;
    private final PostReactionRepository reactionRepository;
    private final CommentRepository commentRepository;
    private final UserRepository userRepository;

    // ==================== GUIDE CATEGORIES ====================

    @GetMapping("/categories")
    public ResponseEntity<List<GuideCategory>> getAllCategories() {
        return ResponseEntity.ok(categoryRepository.findAll());
    }

    @PostMapping("/categories")
    public ResponseEntity<GuideCategory> createCategory(@RequestBody Map<String, Object> request) {
        String name = (String) request.get("name");
        String slug = (String) request.get("slug");
        String description = (String) request.get("description");
        String icon = (String) request.get("icon");
        Integer sortOrder = request.get("sortOrder") != null
                ? Integer.parseInt(request.get("sortOrder").toString())
                : 0;

        GuideCategory category = GuideCategory.builder()
                .name(name)
                .slug(slug)
                .description(description)
                .icon(icon)
                .sortOrder(sortOrder)
                .build();

        if (request.get("parentId") != null) {
            Long parentId = Long.parseLong(request.get("parentId").toString());
            categoryRepository.findById(parentId).ifPresent(category::setParent);
        }

        return ResponseEntity.ok(categoryRepository.save(category));
    }

    @PutMapping("/categories/{id}")
    public ResponseEntity<GuideCategory> updateCategory(
            @PathVariable Long id,
            @RequestBody Map<String, Object> request) {
        return categoryRepository.findById(id)
                .map(category -> {
                    if (request.containsKey("name"))
                        category.setName((String) request.get("name"));
                    if (request.containsKey("slug"))
                        category.setSlug((String) request.get("slug"));
                    if (request.containsKey("description"))
                        category.setDescription((String) request.get("description"));
                    if (request.containsKey("icon"))
                        category.setIcon((String) request.get("icon"));
                    if (request.containsKey("sortOrder")) {
                        category.setSortOrder(Integer.parseInt(request.get("sortOrder").toString()));
                    }
                    return ResponseEntity.ok(categoryRepository.save(category));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/categories/{id}")
    public ResponseEntity<Void> deleteCategory(@PathVariable Long id) {
        categoryRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }

    // ==================== GUIDES ====================

    @GetMapping("/guides")
    public ResponseEntity<Page<Guide>> getAllGuides(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(guideRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(page, size)));
    }

    @GetMapping("/guides/{id}")
    public ResponseEntity<Guide> getGuide(@PathVariable Long id) {
        return guideRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/guides")
    public ResponseEntity<Guide> createGuide(@RequestBody Map<String, Object> request) {
        Long authorId = Long.parseLong(request.get("authorId").toString());
        String title = (String) request.get("title");
        String slug = (String) request.get("slug");
        String content = (String) request.get("content");
        String excerpt = (String) request.get("excerpt");
        String coverImage = (String) request.get("coverImage");
        Boolean isPublished = request.get("isPublished") != null
                ? Boolean.parseBoolean(request.get("isPublished").toString())
                : false;
        Boolean isFeatured = request.get("isFeatured") != null
                ? Boolean.parseBoolean(request.get("isFeatured").toString())
                : false;

        User author = userRepository.findById(authorId)
                .orElseThrow(() -> new RuntimeException("Author not found"));

        Guide.GuideBuilder builder = Guide.builder()
                .author(author)
                .title(title)
                .slug(slug)
                .content(content)
                .excerpt(excerpt)
                .coverImage(coverImage)
                .isPublished(isPublished)
                .isFeatured(isFeatured);

        if (isPublished) {
            builder.publishedAt(ZonedDateTime.now());
        }

        if (request.get("categoryId") != null) {
            Long categoryId = Long.parseLong(request.get("categoryId").toString());
            categoryRepository.findById(categoryId).ifPresent(builder::category);
        }

        return ResponseEntity.ok(guideRepository.save(builder.build()));
    }

    @PutMapping("/guides/{id}")
    public ResponseEntity<Guide> updateGuide(
            @PathVariable Long id,
            @RequestBody Map<String, Object> request) {
        return guideRepository.findById(id)
                .map(guide -> {
                    if (request.containsKey("title"))
                        guide.setTitle((String) request.get("title"));
                    if (request.containsKey("slug"))
                        guide.setSlug((String) request.get("slug"));
                    if (request.containsKey("content"))
                        guide.setContent((String) request.get("content"));
                    if (request.containsKey("excerpt"))
                        guide.setExcerpt((String) request.get("excerpt"));
                    if (request.containsKey("coverImage"))
                        guide.setCoverImage((String) request.get("coverImage"));

                    if (request.containsKey("isPublished")) {
                        boolean publish = Boolean.parseBoolean(request.get("isPublished").toString());
                        if (publish && !guide.getIsPublished()) {
                            guide.setPublishedAt(ZonedDateTime.now());
                        }
                        guide.setIsPublished(publish);
                    }

                    if (request.containsKey("isFeatured")) {
                        guide.setIsFeatured(Boolean.parseBoolean(request.get("isFeatured").toString()));
                    }

                    if (request.containsKey("categoryId")) {
                        Long categoryId = Long.parseLong(request.get("categoryId").toString());
                        categoryRepository.findById(categoryId).ifPresent(guide::setCategory);
                    }

                    return ResponseEntity.ok(guideRepository.save(guide));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/guides/{id}")
    public ResponseEntity<Void> deleteGuide(@PathVariable Long id) {
        guideRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/guides/{id}/publish")
    public ResponseEntity<Guide> publishGuide(@PathVariable Long id) {
        return guideRepository.findById(id)
                .map(guide -> {
                    guide.setIsPublished(true);
                    guide.setPublishedAt(ZonedDateTime.now());
                    return ResponseEntity.ok(guideRepository.save(guide));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/guides/{id}/unpublish")
    public ResponseEntity<Guide> unpublishGuide(@PathVariable Long id) {
        return guideRepository.findById(id)
                .map(guide -> {
                    guide.setIsPublished(false);
                    return ResponseEntity.ok(guideRepository.save(guide));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // ==================== POST MODERATION ====================

    @GetMapping("/posts")
    @Transactional(readOnly = true)
    public ResponseEntity<Page<PostFeedDTO>> getAllPosts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<Post> postsPage = postRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(page, size));
        Page<PostFeedDTO> dtoPage = postsPage.map(post -> toPostFeedDTO(post, null));
        return ResponseEntity.ok(dtoPage);
    }

    @GetMapping("/posts/pending")
    public ResponseEntity<Page<Post>> getPendingPosts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(postRepository.findByIsApprovedFalseOrderByCreatedAtDesc(PageRequest.of(page, size)));
    }

    @PostMapping("/posts/{id}/approve")
    public ResponseEntity<Post> approvePost(@PathVariable Long id) {
        return postRepository.findById(id)
                .map(post -> {
                    post.setIsApproved(true);
                    return ResponseEntity.ok(postRepository.save(post));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/posts/{id}/hide")
    public ResponseEntity<Post> hidePost(@PathVariable Long id) {
        return postRepository.findById(id)
                .map(post -> {
                    post.setIsHidden(true);
                    return ResponseEntity.ok(postRepository.save(post));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/posts/{id}/unhide")
    public ResponseEntity<Post> unhidePost(@PathVariable Long id) {
        return postRepository.findById(id)
                .map(post -> {
                    post.setIsHidden(false);
                    return ResponseEntity.ok(postRepository.save(post));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/posts/{id}")
    @Transactional
    public ResponseEntity<?> deletePost(@PathVariable Long id) {
        try {
            // Manually delete related entities to avoid ConstraintViolationException
            // if CascadeType.REMOVE doesn't work as expected (e.g. strict DB constraints
            // w/o cascade)
            commentRepository.deleteByPostId(id);
            reactionRepository.deleteByPost_Id(id);
            postRepository.deleteById(id);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Không thể xóa bài đăng: " + e.getMessage());
        }
    }

    // ==================== COMMENT MODERATION ====================

    @GetMapping("/posts/{postId}/comments")
    @Transactional(readOnly = true)
    public ResponseEntity<List<CommentDTO>> getPostComments(@PathVariable Long postId) {
        List<Comment> comments = commentRepository.findByPostIdAndParentIsNullOrderByCreatedAtDesc(postId);
        return ResponseEntity.ok(comments.stream()
                .map(this::toCommentDTO)
                .toList());
    }

    @DeleteMapping("/comments/{id}")
    public ResponseEntity<Void> deleteComment(@PathVariable Long id) {
        commentRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }

    // ==================== STATS ====================

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        long totalGuides = guideRepository.count();
        long publishedGuides = guideRepository.findByIsPublishedTrueOrderByCreatedAtDesc(PageRequest.of(0, 1))
                .getTotalElements();
        long totalPosts = postRepository.count();
        long pendingPosts = postRepository.findByIsApprovedFalseOrderByCreatedAtDesc(PageRequest.of(0, 1))
                .getTotalElements();
        long totalCategories = categoryRepository.count();

        return ResponseEntity.ok(Map.of(
                "totalGuides", totalGuides,
                "publishedGuides", publishedGuides,
                "totalPosts", totalPosts,
                "pendingPosts", pendingPosts,
                "totalCategories", totalCategories));
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

    private CommentDTO toCommentDTO(Comment comment) {
        CommentDTO.AuthorDTO authorDTO = null;
        if (comment.getAuthor() != null) {
            authorDTO = CommentDTO.AuthorDTO.builder()
                    .id(comment.getAuthor().getId())
                    .fullName(comment.getAuthor().getFullName())
                    .avatarUrl(comment.getAuthor().getAvatarUrl())
                    .build();
        }

        List<CommentDTO> replies = null;
        if (comment.getReplies() != null) {
            replies = comment.getReplies().stream()
                    .map(this::toCommentDTO)
                    .toList();
        }

        return CommentDTO.builder()
                .id(comment.getId())
                .postId(comment.getPost().getId())
                .parentId(comment.getParent() != null ? comment.getParent().getId() : null)
                .author(authorDTO)
                .content(comment.getContent())
                .likeCount(comment.getLikeCount() != null ? comment.getLikeCount() : 0)
                .createdAt(comment.getCreatedAt())
                .replies(replies)
                .build();
    }
}
