package com.agriplanner.dto;

import com.agriplanner.model.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Register request DTO
 * Note: SYSTEM_ADMIN role cannot be selected during registration
 */
@Data
public class RegisterRequest {

    @NotBlank(message = "Full name is required")
    @Size(min = 2, max = 100, message = "Name must be between 2 and 100 characters")
    private String fullName;

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotBlank(message = "Password is required")
    @Size(min = 6, max = 100, message = "Password must be at least 6 characters")
    private String password;

    @Size(max = 20, message = "Phone number too long")
    private String phone;

    @NotNull(message = "Role is required")
    private UserRole role; // Only OWNER, WORKER allowed

    // Farm name for OWNER registration (will create new farm)
    private String farmName;

    // Farm ID for WORKER registration (existing farm to join)
    private Long farmId;

    // CV Profile for WORKER
    private String cvProfile;

    // Invitation code for SYSTEM_ADMIN registration
    private String invitationCode;
}
