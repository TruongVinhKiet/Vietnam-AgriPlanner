package com.agriplanner.service;

import com.agriplanner.dto.AuthResponse;
import com.agriplanner.dto.LoginRequest;
import com.agriplanner.dto.RegisterRequest;
import com.agriplanner.model.Farm;
import com.agriplanner.model.User;
import com.agriplanner.model.UserRole;
import com.agriplanner.repository.FarmRepository;
import com.agriplanner.repository.UserRepository;
import com.agriplanner.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Authentication service for login and registration
 */
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class AuthService {

    private final UserRepository userRepository;
    private final FarmRepository farmRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final TwoFactorService twoFactorService;
    private final EmailService emailService;

    /**
     * Login with email and password
     */
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElse(null);

        if (user == null) {
            return AuthResponse.error("Email không tồn tại trong hệ thống");
        }

        // Check account lock
        if (user.getAccountLockedUntil() != null
                && user.getAccountLockedUntil().isAfter(java.time.LocalDateTime.now())) {
            return AuthResponse.accountLocked("Tài khoản đang bị khóa. Vui lòng thử lại sau hoặc mở khóa qua email.");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            increaseFailedAttempts(user);
            return AuthResponse.error("Mật khẩu không chính xác");
        }

        if (!user.getIsActive()) {
            return AuthResponse.error("Tài khoản đã bị khóa bởi quản trị viên");
        }

        // 2FA Check
        if (Boolean.TRUE.equals(user.getTwoFactorEnabled())) {
            if (request.getTwoFactorCode() == null || request.getTwoFactorCode().isEmpty()) {
                return AuthResponse.twoFactorRequired("Vui lòng nhập mã 2FA");
            }
            if (!twoFactorService.validateCode(user.getTwoFactorSecret(), request.getTwoFactorCode())) {
                return AuthResponse.error("Mã 2FA không chính xác");
            }
        }

        // Reset failed attempts on success
        if (user.getFailedLoginAttempts() > 0) {
            user.setFailedLoginAttempts(0);
            user.setAccountLockedUntil(null);
            userRepository.save(user);
        }

        String token = jwtService.generateToken(user);
        return AuthResponse.success(token, user.getEmail(), user.getFullName(), user.getRole());
    }

    private void increaseFailedAttempts(User user) {
        int newAttempts = user.getFailedLoginAttempts() + 1;
        user.setFailedLoginAttempts(newAttempts);
        if (newAttempts >= 5) {
            user.setAccountLockedUntil(java.time.LocalDateTime.now().plusMinutes(30));
        }
        userRepository.save(user);
    }

    /**
     * Generate OTP for action
     */
    public void generateOtp(String email, String type) {
        User user = getUserByEmail(email);
        if (user == null)
            return;

        String otp = String.valueOf((int) ((Math.random() * 900000) + 100000));
        user.setOtpCode(otp);
        user.setOtpExpiry(java.time.LocalDateTime.now().plusMinutes(5));
        userRepository.save(user);

        emailService.sendOtpEmail(email, otp, type);
    }

    /**
     * Verify OTP
     */
    public boolean verifyOtp(String email, String otp) {
        User user = getUserByEmail(email);
        if (user == null || user.getOtpCode() == null)
            return false;

        if (user.getOtpCode().equals(otp) &&
                user.getOtpExpiry().isAfter(java.time.LocalDateTime.now())) {
            // Valid OTP
            user.setOtpCode(null);
            user.setOtpExpiry(null);
            userRepository.save(user);
            return true;
        }
        return false;
    }

    /**
     * Unlock account
     */
    public boolean unlockAccount(String email, String otp) {
        if (verifyOtp(email, otp)) {
            User user = getUserByEmail(email);
            user.setAccountLockedUntil(null);
            user.setFailedLoginAttempts(0);
            userRepository.save(user);
            return true;
        }
        return false;
    }

    /**
     * Change password with OTP verification
     */
    public boolean changePassword(String email, String otp, String newPassword) {
        if (verifyOtp(email, otp)) {
            User user = getUserByEmail(email);
            user.setPasswordHash(passwordEncoder.encode(newPassword));
            userRepository.save(user);
            return true;
        }
        return false;
    }

    /**
     * Change email with OTP verification
     */
    public AuthResponse changeEmail(String currentEmail, String otp, String newEmail) {
        if (userRepository.existsByEmail(newEmail)) {
            return AuthResponse.error("Email mới đã được sử dụng");
        }

        if (verifyOtp(currentEmail, otp)) {
            User user = getUserByEmail(currentEmail);
            user.setEmail(newEmail);
            userRepository.save(user);

            // Re-generate token with new email
            String token = jwtService.generateToken(user);
            return AuthResponse.success(token, user.getEmail(), user.getFullName(), user.getRole());
        }
        return AuthResponse.error("Mã OTP không chính xác hoặc đã hết hạn");
    }

    /**
     * Initiate 2FA setup
     * Returns the secret key
     */
    @SuppressWarnings("null")
    public String initiateTwoFactorSetup(String email) {
        User user = getUserByEmail(email);
        String secret = twoFactorService.generateSecret();
        user.setTwoFactorSecret(secret);
        userRepository.save(user);
        return secret;
    }

    /**
     * Verify and enable 2FA
     */
    @SuppressWarnings("null")
    public boolean verifyAndEnableTwoFactor(String email, String code) {
        User user = getUserByEmail(email);
        if (user.getTwoFactorSecret() == null)
            return false;

        if (twoFactorService.validateCode(user.getTwoFactorSecret(), code)) {
            user.setTwoFactorEnabled(true);
            userRepository.save(user);
            return true;
        }
        return false;
    }

    /**
     * Disable 2FA
     */
    public void disableTwoFactor(String email) {
        User user = getUserByEmail(email);
        user.setTwoFactorEnabled(false);
        user.setTwoFactorSecret(null);
        userRepository.save(user);
    }

    /**
     * Register new user
     * Note: SYSTEM_ADMIN role cannot be registered
     * For OWNER: creates a new farm with given farmName
     * For WORKER: associates with existing farm by farmId
     */
    @Transactional
    @SuppressWarnings("null")
    public AuthResponse register(RegisterRequest request) {
        // Handle SYSTEM_ADMIN registration
        if (request.getRole() == UserRole.SYSTEM_ADMIN) {
            // Check invitation code
            if (!"123456".equals(request.getInvitationCode())) {
                return AuthResponse.error("Mã mời quản trị viên không chính xác");
            }
        }

        // Check if email already exists
        if (userRepository.existsByEmail(request.getEmail())) {
            return AuthResponse.error("Email đã được sử dụng");
        }

        // For OWNER: farmName is required
        if (request.getRole() == UserRole.OWNER &&
                (request.getFarmName() == null || request.getFarmName().trim().isEmpty())) {
            return AuthResponse.error("Vui lòng nhập tên nông trại");
        }

        // For WORKER: farmId is required
        if (request.getRole() == UserRole.WORKER) {
            if (request.getFarmId() == null) {
                return AuthResponse.error("Vui lòng chọn nông trại ứng tuyển");
            }
            // Optional: validate CV
            if (request.getCvProfile() == null || request.getCvProfile().trim().isEmpty()) {
                // Warning only or error? Let's make it optional for MVP but recommended
            }
        }

        // Create new user
        User.UserBuilder userBuilder = User.builder()
                .fullName(request.getFullName())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .phone(request.getPhone())
                .role(request.getRole())
                .isActive(true); // Default true for OWNER (will override for WORKER)

        // If WORKER, set pending approval
        if (request.getRole() == UserRole.WORKER) {
            userBuilder.isActive(false); // Inactive until approved
            userBuilder.approvalStatus(User.ApprovalStatus.PENDING);
            userBuilder.farmId(request.getFarmId());
            userBuilder.cvProfile(request.getCvProfile());
        } else {
            userBuilder.approvalStatus(User.ApprovalStatus.APPROVED);
        }

        User user = userBuilder.build();

        // If SYSTEM_ADMIN, set inactive and require verification
        if (request.getRole() == UserRole.SYSTEM_ADMIN) {
            user.setIsActive(false);
            // ... (keep existing admin logic)
            // Generate OTP for verification
            String otp = String.valueOf((int) ((Math.random() * 900000) + 100000));
            user.setOtpCode(otp);
            user.setOtpExpiry(java.time.LocalDateTime.now().plusMinutes(15));

            userRepository.save(user); // Save first

            // Send email
            emailService.sendOtpEmail(user.getEmail(), otp, "ADMIN_VERIFICATION");

            return AuthResponse.verificationRequired("Vui lòng kiểm tra email để lấy mã xác thực kích hoạt tài khoản");
        }

        userRepository.save(user);

        // If OWNER, create a new farm
        // ... (keep existing owner logic)

        // If OWNER, create a new farm
        if (request.getRole() == UserRole.OWNER) {
            Farm farm = Farm.builder()
                    .name(request.getFarmName().trim())
                    .ownerId(user.getId())
                    .build();
            farmRepository.save(farm);
        }

        // Return generic success for Worker
        if (request.getRole() == UserRole.WORKER) {
            return AuthResponse.approvalRequired("Hồ sơ của bạn đã được gửi. Vui lòng chờ Chủ trang trại duyệt.");
        }

        String token = jwtService.generateToken(user);
        return AuthResponse.success(token, user.getEmail(), user.getFullName(), user.getRole());
    }

    /**
     * Verify SYSTEM_ADMIN registration
     */
    public AuthResponse verifyRegistration(String email, String otp) {
        User user = getUserByEmail(email);
        if (user == null) {
            return AuthResponse.error("Email không tồn tại");
        }

        if (user.getIsActive() != null && user.getIsActive()) {
            return AuthResponse.error("Tài khoản đã được kích hoạt");
        }

        if (verifyOtp(email, otp)) {
            user.setIsActive(true);
            userRepository.save(user);

            String token = jwtService.generateToken(user);
            return AuthResponse.success(token, user.getEmail(), user.getFullName(), user.getRole());
        }

        return AuthResponse.error("Mã OTP không chính xác hoặc đã hết hạn");
    }

    /**
     * Get user info by email
     */
    public User getUserByEmail(String email) {
        return userRepository.findByEmail(email).orElse(null);
    }

    /**
     * Forgot Password: Generate OTP for password reset
     */
    public void forgotPassword(String email) {
        generateOtp(email, "PASSWORD_RESET");
    }

    /**
     * Reset Password with OTP
     */
    public boolean resetPassword(String email, String otp, String newPassword) {
        return changePassword(email, otp, newPassword);
    }

    /**
     * Login with Google
     * If user exists by email, link Google ID and return token.
     * If not exists, create new user (as OWNER by default or ask user? Defaulting
     * to OWNER for now or maybe just handle login for existing).
     * Strategy: If email exists -> login. If not -> create new user.
     */
    @Transactional
    @SuppressWarnings("null")
    public AuthResponse loginWithGoogle(String googleId, String email, String fullName, String avatarUrl) {
        User user = userRepository.findByEmail(email).orElse(null);

        if (user == null) {
            // Register new user via Google
            user = User.builder()
                    .email(email)
                    .fullName(fullName)
                    .googleId(googleId)
                    .avatarUrl(avatarUrl)
                    .passwordHash(passwordEncoder.encode(java.util.UUID.randomUUID().toString())) // Random password
                    .role(UserRole.OWNER) // Default role
                    .isActive(true)
                    .build();
            userRepository.save(user);

            // Create default farm for Google user
            Farm farm = Farm.builder()
                    .name("Nông trại của " + fullName)
                    .ownerId(user.getId())
                    .build();
            farmRepository.save(farm);
        } else {
            // Update Google ID and Avatar if missing
            if (user.getGoogleId() == null) {
                user.setGoogleId(googleId);
            }
            if (user.getAvatarUrl() == null && avatarUrl != null) {
                user.setAvatarUrl(avatarUrl);
            }
            userRepository.save(user);
        }

        // Check lockout
        if (user.getAccountLockedUntil() != null
                && user.getAccountLockedUntil().isAfter(java.time.LocalDateTime.now())) {
            return AuthResponse.accountLocked("Tài khoản đang bị khóa.");
        }

        String token = jwtService.generateToken(user);
        return AuthResponse.success(token, user.getEmail(), user.getFullName(), user.getRole());
    }
}
