package com.agriplanner.dto;

import lombok.*;
import java.time.ZonedDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SessionContributionDTO {
    private Long id;
    private Long cooperativeId;
    private String cooperativeName;
    private String memberName;
    private Integer quantity;
    private String notes;
    private ZonedDateTime createdAt;
}
