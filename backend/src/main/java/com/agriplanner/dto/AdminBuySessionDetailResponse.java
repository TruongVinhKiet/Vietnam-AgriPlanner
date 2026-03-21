package com.agriplanner.dto;

import lombok.*;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminBuySessionDetailResponse {
    private AdminBuySessionResponse session;
    private List<SessionContributionDTO> contributions;
}
