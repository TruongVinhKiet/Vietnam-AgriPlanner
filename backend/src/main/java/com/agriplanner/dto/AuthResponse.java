package com.agriplanner.dto;

import com.agriplanner.model.UserRole;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Authentication response DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {

    private String token;
    private String email;
    private String fullName;
    private UserRole role;
    private String message;
    private boolean success;
    private boolean requiresTwoFactor;
    private boolean requiresVerification;
    private boolean requiresApproval; // For WORKER registration (pending owner approval)
    private boolean accountLocked;

    public static AuthResponse success(String token, String email, String fullName, UserRole role) {
        return AuthResponse.builder()
                .success(true)
                .token(token)
                .email(email)
                .fullName(fullName)
                .role(role)
                .message("Authentication successful")
                .build();
    }

    public static AuthResponse twoFactorRequired(String message) {
        return AuthResponse.builder()
                .success(false)
                .requiresTwoFactor(true)
                .message(message)
                .build();
    }

    public static AuthResponse accountLocked(String message) {
        return AuthResponse.builder()
                .success(false)
                .accountLocked(true)
                .message(message)
                .build();
    }

    public static AuthResponse error(String message) {
        return AuthResponse.builder()
                .success(false)
                .message(message)
                .build();
    }

    public static AuthResponse verificationRequired(String message) {
        return AuthResponse.builder()
                .success(true)
                .requiresVerification(true)
                .message(message)
                .build();
    }

    /**
     * For WORKER registration: application submitted, waiting for owner approval
     */
    public static AuthResponse approvalRequired(String message) {
        return AuthResponse.builder()
                .success(true)
                .requiresApproval(true)
                .message(message)
                .build();
    }
}
