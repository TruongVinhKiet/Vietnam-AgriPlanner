package com.agriplanner.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ForceCloseRequest {
    private String reason;
}
