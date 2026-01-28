package com.agriplanner.dto;

import lombok.*;
import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminBuySessionResponse {
    private Long id;
    private String title;
    private Long shopItemId;
    private String shopItemName;
    private String shopItemImage;
    private Integer targetQuantity;
    private Integer currentQuantity;
    private BigDecimal wholesalePrice;
    private BigDecimal retailPrice;
    private BigDecimal marketPrice;
    private Integer discountPercent;
    private Integer progressPercent;
    private ZonedDateTime deadline;
    private String status;
    private String note;
    private ZonedDateTime createdAt;
    private List<String> participatingCoops;
}
