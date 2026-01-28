package com.agriplanner.dto;

import lombok.*;
import java.math.BigDecimal;
import java.time.ZonedDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateAdminSellSessionRequest {
    private String productName;
    private String description;
    private Long cropDefinitionId;
    private Long animalDefinitionId;
    private Integer targetQuantity;
    private BigDecimal minPrice;
    private BigDecimal marketPrice;
    private String unit;
    private ZonedDateTime deadline;
}
