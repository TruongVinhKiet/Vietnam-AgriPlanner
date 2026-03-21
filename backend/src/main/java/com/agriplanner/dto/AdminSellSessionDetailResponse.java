package com.agriplanner.dto;

import lombok.*;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminSellSessionDetailResponse {
    private AdminSellSessionResponse session;
    private List<SessionContributionDTO> contributions;
}
