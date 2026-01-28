package com.agriplanner.dto;

import lombok.*;
import java.math.BigDecimal;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CartDTO {
    private List<CartItemDTO> items;
    private int totalItems;
    private int totalQuantity;
    private BigDecimal totalValue;
}
