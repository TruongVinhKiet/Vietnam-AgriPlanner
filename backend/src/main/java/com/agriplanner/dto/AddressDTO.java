package com.agriplanner.dto;

import lombok.*;
import java.math.BigDecimal;
import java.time.ZonedDateTime;

public class AddressDTO {
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateAddressRequest {
        private String fullAddress;
        private BigDecimal latitude;
        private BigDecimal longitude;
        private Boolean isDefault;
        private String label;
        private String receiverName;
        private String receiverPhone;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UpdateAddressRequest {
        private String fullAddress;
        private BigDecimal latitude;
        private BigDecimal longitude;
        private Boolean isDefault;
        private String label;
        private String receiverName;
        private String receiverPhone;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AddressResponse {
        private Long id;
        private String fullAddress;
        private BigDecimal latitude;
        private BigDecimal longitude;
        private Boolean isDefault;
        private String label;
        private String receiverName;
        private String receiverPhone;
        private ZonedDateTime createdAt;
    }
}
