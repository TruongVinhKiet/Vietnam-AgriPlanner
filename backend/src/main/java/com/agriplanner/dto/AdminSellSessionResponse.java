package com.agriplanner.dto;

import lombok.*;
import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminSellSessionResponse {
    private Long id;
    private String productName;
    private String description;
    private Integer targetQuantity;
    private Integer currentQuantity;
    private BigDecimal minPrice;
    private BigDecimal marketPrice;
    private String unit;
    private Integer progressPercent;
    private ZonedDateTime deadline;
    private String status;
    private ZonedDateTime createdAt;
    private List<String> participatingCoops;
}
