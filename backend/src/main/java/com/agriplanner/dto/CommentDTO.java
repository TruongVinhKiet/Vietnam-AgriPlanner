package com.agriplanner.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CommentDTO {

    private Long id;
    private Long postId;
    private Long parentId;
    private AuthorDTO author;
    private String content;
    private String imageUrl;
    private String videoUrl;
    private Integer likeCount;
    private Boolean isHidden;
    private ZonedDateTime createdAt;

    private Map<String, Long> reactionCounts;
    private String userReaction;

    private List<CommentDTO> replies;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AuthorDTO {
        private Long id;
        private String fullName;
        private String avatarUrl;
    }
}
