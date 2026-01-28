package com.agriplanner.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateReviewRequest {
    private Long purchaseId;
    private Integer rating;
    private String comment;
    private String userEmail;
}
