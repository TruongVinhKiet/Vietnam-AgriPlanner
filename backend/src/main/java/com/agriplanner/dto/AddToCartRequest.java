package com.agriplanner.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AddToCartRequest {
    private Long shopItemId;
    private Integer quantity;
    private String userEmail;
}
