package com.agriplanner.dto;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CartItemDTO {
    private Long id;
    private Long shopItemId;
    private String itemName;
    private String itemCategory;
    private String itemUnit;
    private String imageUrl;
    private String iconName;
    private BigDecimal unitPrice;
    private Integer quantity;
    private BigDecimal subtotal;
    private LocalDateTime addedAt;
}
