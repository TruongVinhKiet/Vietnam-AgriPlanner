package com.agriplanner.dto;

import lombok.*;
import java.math.BigDecimal;
import java.time.ZonedDateTime;

public class CooperativeDTO {

    // ==================== Cooperative ====================

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RegisterRequest {
        private String name;
        private String description;
        private String address;
        private String phone;
        private Integer maxMembers;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CooperativeResponse {
        private Long id;
        private String name;
        private String code;
        private String inviteCode;
        private String description;
        private String address;
        private String phone;
        private String status;
        private Integer maxMembers;
        private Integer memberCount;
        private BigDecimal balance;
        private ZonedDateTime createdAt;
        private ZonedDateTime approvedAt;
        private LeaderInfo leader;
        private String userRole; // Current user's role in this coop

        @Data
        @Builder
        @NoArgsConstructor
        @AllArgsConstructor
        public static class LeaderInfo {
            private Long id;
            private String name;
            private String email;
            private String phone;
        }
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class JoinRequest {
        private String inviteCode;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DepositRequest {
        private BigDecimal amount;
        private String description;
    }

    // ==================== Members ====================

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MemberResponse {
        private Long id;
        private Long userId;
        private String userName;
        private String userEmail;
        private String userPhone;
        private String role;
        private BigDecimal contribution;
        private ZonedDateTime joinedAt;
        private String avatarUrl;
    }

    // ==================== Group Buy ====================

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateGroupBuyRequest {
        private Long shopItemId;
        private String title;
        private Integer targetQuantity;
        private BigDecimal wholesalePrice;
        private ZonedDateTime deadline;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GroupBuyResponse {
        private Long id;
        private String title;
        private Long shopItemId;
        private String shopItemName;
        private String shopItemImage;
        private String shopItemUnit;
        private Integer targetQuantity;
        private Integer currentQuantity;
        private Integer progressPercent;
        private BigDecimal wholesalePrice;
        private BigDecimal retailPrice;
        private Integer discountPercent;
        private ZonedDateTime deadline;
        private String status;
        private ZonedDateTime createdAt;
        private String createdByName;
        private Integer contributorCount;
        private Integer myContribution; // Current user's contribution
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ContributeRequest {
        private Integer quantity;
        private Long shippingAddressId;
    }

    // ==================== Group Sell ====================

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateGroupSellRequest {
        private String productName;
        private String description;
        private Integer targetQuantity;
        private String unit;
        private BigDecimal minPrice;
        private ZonedDateTime deadline;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GroupSellResponse {
        private Long id;
        private String productName;
        private String description;
        private Integer targetQuantity;
        private Integer currentQuantity;
        private Integer progressPercent;
        private String unit;
        private BigDecimal minPrice;
        private BigDecimal finalPrice;
        private ZonedDateTime deadline;
        private String status;
        private String buyerInfo;
        private ZonedDateTime createdAt;
        private String createdByName;
        private Integer contributorCount;
        private Integer myContribution;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SellContributeRequest {
        private Integer quantity;
        private String notes;
    }

    // ==================== Transactions ====================

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TransactionResponse {
        private Long id;
        private String type;
        private BigDecimal amount;
        private BigDecimal balanceAfter;
        private String description;
        private String memberName;
        private ZonedDateTime createdAt;
    }

    // ==================== Admin ====================

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AdminCooperativeResponse {
        private Long id;
        private String name;
        private String code;
        private String description;
        private String address;
        private String phone;
        private String status;
        private Integer maxMembers;
        private Integer memberCount;
        private BigDecimal balance;
        private ZonedDateTime createdAt;
        private ZonedDateTime approvedAt;
        private String leaderName;
        private String leaderEmail;
        private String leaderPhone;
        private String leaderAvatarUrl;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CooperativeStats {
        private long pendingApprovals;
        private long dissolutionRequests;
        private long activeCooperatives;
        private long totalMembers;
        private BigDecimal totalFunds;
    }
}
