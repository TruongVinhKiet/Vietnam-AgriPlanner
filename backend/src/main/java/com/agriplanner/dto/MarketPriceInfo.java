package com.agriplanner.dto;

import lombok.*;
import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MarketPriceInfo {
    private Long id;
    private String name;
    private String category;
    private BigDecimal price;
    private Integer stock;
    private String unit;
    private String imageUrl;
    private String productType; // "SHOP_ITEM", "CROP", "ANIMAL"
}
