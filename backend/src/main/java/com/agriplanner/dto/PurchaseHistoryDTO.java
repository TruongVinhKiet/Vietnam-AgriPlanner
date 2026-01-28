package com.agriplanner.dto;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PurchaseHistoryDTO {
    private Long id;
    private Long shopItemId;
    private String itemName;
    private String itemCategory;
    private String imageUrl;
    private String iconName;
    private Integer quantity;
    private String unit;
    private BigDecimal unitPrice;
    private BigDecimal totalPrice;
    private LocalDateTime purchasedAt;
    private Boolean isReviewed;
    private ProductReviewDTO review;
}
