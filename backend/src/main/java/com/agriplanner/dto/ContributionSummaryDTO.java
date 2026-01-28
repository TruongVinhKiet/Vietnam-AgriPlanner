package com.agriplanner.dto;

import lombok.*;
import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ContributionSummaryDTO {
    private Integer totalProducts;
    private Integer totalContributions;
    private BigDecimal totalValue;
}
