package com.agriplanner.dto;

import lombok.*;
import java.math.BigDecimal;
import java.time.ZonedDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CooperativeInventoryDTO {
    private Long id;
    private String productName;
    private String productType;
    private BigDecimal quantity;
    private String unit;
    private BigDecimal totalValue;
    private Integer contributorCount;
    private ZonedDateTime updatedAt;
}
