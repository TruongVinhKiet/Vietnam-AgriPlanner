package com.agriplanner.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.ZonedDateTime;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PostFeedDTO {

    private Long id;
    private AuthorDTO author;
    private String content;
    private String images;
    private String videos;
    private Boolean isApproved;
    private Boolean isHidden;
    private Integer likeCount;
    private Integer commentCount;
    private Integer shareCount;
    private ZonedDateTime createdAt;
    private ZonedDateTime updatedAt;

    private Map<String, Long> reactionCounts;
    private String userReaction;

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
