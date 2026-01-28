package com.agriplanner.dto;

import lombok.*;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductReviewDTO {
    private Long id;
    private Long shopItemId;
    private Long purchaseId;
    private String userName;
    private String userAvatar;
    private Integer rating;
    private String comment;
    private Boolean isVerifiedPurchase;
    private LocalDateTime createdAt;
}
