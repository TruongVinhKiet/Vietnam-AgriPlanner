package com.agriplanner.dto;

import lombok.*;
import java.math.BigDecimal;
import java.time.ZonedDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateAdminBuySessionRequest {
    private Long shopItemId;
    private String title;
    private Integer targetQuantity;
    private BigDecimal wholesalePrice;
    private ZonedDateTime deadline;
    private String note;
}
