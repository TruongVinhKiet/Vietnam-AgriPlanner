package com.agriplanner.dto;

import lombok.*;
import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductReviewSummaryDTO {
    private Double averageRating;
    private int totalReviews;
    private Map<Integer, Integer> ratingDistribution; // 5->count, 4->count, etc.
    private List<ProductReviewDTO> recentReviews;
}
