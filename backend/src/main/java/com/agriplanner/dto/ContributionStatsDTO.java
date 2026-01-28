package com.agriplanner.dto;

import lombok.*;
import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ContributionStatsDTO {
    private Long memberId;
    private String memberName;
    private BigDecimal quantity;
    private BigDecimal earnings;
    private BigDecimal percent;
    private Boolean isClaimed;
}
