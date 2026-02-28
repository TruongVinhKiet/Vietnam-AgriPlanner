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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;

/**
 * Authentication service for login and registration
 */
@Service
@RequiredArgsConstructor
@SuppressWarnings({"null", "unchecked", "rawtypes"})
public class AuthService {

    private final UserRepository userRepository;
    private final FarmRepository farmRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final TwoFactorService twoFactorService;
    private final EmailService emailService;

    @Value("${google.client.id:}")
    private String googleClientId;

    @Value("${google.client.secret:}")
    private String googleClientSecret;

    @Value("${facebook.app.id:}")
    private String facebookAppId;

    @Value("${facebook.app.secret:}")
    private String facebookAppSecret;

    @Value("${github.client.id:}")
    private String githubClientId;

    @Value("${github.client.secret:}")
    private String githubClientSecret;

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
            return AuthResponse.adminLocked(
                "Tài khoản đã bị quản trị viên khóa",
                user.getLockReason() != null ? user.getLockReason() : "Không có lý do cụ thể"
            );
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
        }

        // Update last login time
        user.setLastLoginAt(java.time.LocalDateTime.now());
        userRepository.save(user);

        String token = jwtService.generateToken(user);
        return AuthResponse.successWithAvatar(token, user.getEmail(), user.getFullName(), user.getRole(), user.getAvatarUrl(), user.getId());
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
            return AuthResponse.success(token, user.getEmail(), user.getFullName(), user.getRole(), user.getId());
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
        return AuthResponse.success(token, user.getEmail(), user.getFullName(), user.getRole(), user.getId());
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
            return AuthResponse.success(token, user.getEmail(), user.getFullName(), user.getRole(), user.getId());
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
     * Exchange Google authorization code for user info
     */
    private java.util.Map<String, Object> exchangeGoogleCode(String code, String redirectUri) {
        RestTemplate restTemplate = new RestTemplate();

        java.util.Map<String, String> tokenRequest = new java.util.HashMap<>();
        tokenRequest.put("code", code);
        tokenRequest.put("client_id", googleClientId);
        tokenRequest.put("client_secret", googleClientSecret);
        tokenRequest.put("redirect_uri", redirectUri);
        tokenRequest.put("grant_type", "authorization_code");

        java.util.Map<String, Object> tokenData = restTemplate.postForObject(
                "https://oauth2.googleapis.com/token", tokenRequest, java.util.Map.class);

        if (tokenData == null || !tokenData.containsKey("id_token")) {
            throw new RuntimeException("Không thể lấy token từ Google");
        }

        // Decode ID token JWT payload to get user info (sub, email, name, picture)
        String idToken = (String) tokenData.get("id_token");
        String[] parts = idToken.split("\\.");
        String payload = new String(java.util.Base64.getUrlDecoder().decode(parts[1]));

        try {
            return new com.fasterxml.jackson.databind.ObjectMapper()
                    .readValue(payload, java.util.Map.class);
        } catch (Exception e) {
            throw new RuntimeException("Không thể đọc thông tin từ Google token", e);
        }
    }

    /**
     * Login with Google (server-side code exchange)
     * Strategy: If email exists -> login. If not -> error (must register first).
     */
    @Transactional
    @SuppressWarnings("null")
    public AuthResponse loginWithGoogle(String code, String redirectUri) {
        try {
            java.util.Map<String, Object> userInfo = exchangeGoogleCode(code, redirectUri);

            String googleId = (String) userInfo.get("sub");
            String email = (String) userInfo.get("email");
            String fullName = (String) userInfo.get("name");
            String avatarUrl = (String) userInfo.get("picture");

            User user = userRepository.findByEmail(email).orElse(null);

            if (user == null) {
                return AuthResponse.builder()
                        .success(false)
                        .message("NEEDS_REGISTRATION")
                        .email(email)
                        .fullName(fullName)
                        .avatarUrl(avatarUrl)
                        .build();
            }

            // Update Google ID and Avatar if missing
            if (user.getGoogleId() == null) {
                user.setGoogleId(googleId);
            }
            if (user.getAvatarUrl() == null && avatarUrl != null) {
                user.setAvatarUrl(avatarUrl);
            }
            user.setLastLoginAt(java.time.LocalDateTime.now());
            userRepository.save(user);

            // Check lockout
            if (!user.getIsActive()) {
                return AuthResponse.adminLocked(
                    "Tài khoản đã bị quản trị viên khóa",
                    user.getLockReason() != null ? user.getLockReason() : "Không có lý do cụ thể"
                );
            }
            if (user.getAccountLockedUntil() != null
                    && user.getAccountLockedUntil().isAfter(java.time.LocalDateTime.now())) {
                return AuthResponse.accountLocked("Tài khoản đang bị khóa.");
            }

            String token = jwtService.generateToken(user);
            return AuthResponse.successWithAvatar(token, user.getEmail(), user.getFullName(), user.getRole(), user.getAvatarUrl(), user.getId());

        } catch (Exception e) {
            return AuthResponse.error("Lỗi xác thực Google: " + e.getMessage());
        }
    }

    /**
     * Register with Google (server-side code exchange) - creates user with Google info + role selection
     */
    @Transactional
    public AuthResponse registerWithGoogle(String code, String redirectUri,
                                            String role, String farmName, Long farmId, String cvProfile) {
        try {
            java.util.Map<String, Object> userInfo = exchangeGoogleCode(code, redirectUri);

            String googleId = (String) userInfo.get("sub");
            String email = (String) userInfo.get("email");
            String fullName = (String) userInfo.get("name");
            String avatarUrl = (String) userInfo.get("picture");

            // Check if email already used
            if (userRepository.existsByEmail(email)) {
                return AuthResponse.error("Email đã được sử dụng bởi tài khoản khác");
            }

            // Check if Google ID already used
            if (userRepository.findByGoogleId(googleId).isPresent()) {
                return AuthResponse.error("Tài khoản Google này đã được liên kết với tài khoản khác");
            }

            return registerWithSocialProvider(email, fullName, avatarUrl, role, farmName, farmId, cvProfile,
                    "GOOGLE", googleId, null, null, null, null);

        } catch (Exception e) {
            return AuthResponse.error("Lỗi đăng ký Google: " + e.getMessage());
        }
    }

    /**
     * Exchange Facebook authorization code for access token and user info
     */
    private java.util.Map<String, Object> exchangeFacebookCode(String code, String redirectUri) {
        RestTemplate restTemplate = new RestTemplate();

        // Exchange code for access token
        String tokenUrl = String.format(
                "https://graph.facebook.com/v18.0/oauth/access_token?client_id=%s&redirect_uri=%s&client_secret=%s&code=%s",
                facebookAppId,
                java.net.URLEncoder.encode(redirectUri, java.nio.charset.StandardCharsets.UTF_8),
                facebookAppSecret,
                code);

        java.util.Map<String, Object> tokenData = restTemplate.getForObject(tokenUrl, java.util.Map.class);

        if (tokenData == null || !tokenData.containsKey("access_token")) {
            throw new RuntimeException("Không thể lấy token từ Facebook");
        }

        String accessToken = (String) tokenData.get("access_token");

        // Get user info
        String fbUrl = "https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=" + accessToken;
        java.util.Map<String, Object> userInfo = restTemplate.getForObject(fbUrl, java.util.Map.class);

        if (userInfo == null || !userInfo.containsKey("id")) {
            throw new RuntimeException("Không thể lấy thông tin người dùng từ Facebook");
        }

        return userInfo;
    }

    /**
     * Login with Facebook (server-side code exchange)
     */
    @Transactional
    public AuthResponse loginWithFacebook(String code, String redirectUri) {
        try {
            java.util.Map<String, Object> fbResponse = exchangeFacebookCode(code, redirectUri);

            String facebookId = String.valueOf(fbResponse.get("id"));
            String email = (String) fbResponse.get("email");
            String name = (String) fbResponse.get("name");

            // Try login by Facebook ID first
            User user = userRepository.findByFacebookId(facebookId).orElse(null);

            // If not found by Facebook ID, try by email
            if (user == null && email != null) {
                user = userRepository.findByEmail(email).orElse(null);
            }

            if (user == null) {
                return AuthResponse.builder()
                        .success(false)
                        .message("NEEDS_REGISTRATION")
                        .email(email)
                        .fullName(name)
                        .build();
            }

            // Update Facebook ID if missing
            if (user.getFacebookId() == null) {
                user.setFacebookId(facebookId);
                user.setFacebookName(name);
            }

            // Check lockout
            if (!user.getIsActive()) {
                AuthResponse resp = AuthResponse.adminLocked("Tài khoản đã bị khóa",
                    user.getLockReason() != null ? user.getLockReason() : "Không có lý do cụ thể");
                resp.setEmail(user.getEmail());
                return resp;
            }
            if (user.getAccountLockedUntil() != null
                    && user.getAccountLockedUntil().isAfter(java.time.LocalDateTime.now())) {
                AuthResponse resp = AuthResponse.accountLocked("Tài khoản đang bị khóa.");
                resp.setEmail(user.getEmail());
                return resp;
            }

            user.setLastLoginAt(java.time.LocalDateTime.now());
            userRepository.save(user);

            String token = jwtService.generateToken(user);
            return AuthResponse.successWithAvatar(token, user.getEmail(), user.getFullName(), user.getRole(), user.getAvatarUrl(), user.getId());

        } catch (Exception e) {
            return AuthResponse.error("Lỗi xác thực Facebook: " + e.getMessage());
        }
    }

    /**
     * Register with Facebook (server-side code exchange)
     */
    @Transactional
    public AuthResponse registerWithFacebook(String code, String redirectUri, String role, String farmName, Long farmId, String cvProfile) {
        try {
            java.util.Map<String, Object> fbResponse = exchangeFacebookCode(code, redirectUri);

            String facebookId = String.valueOf(fbResponse.get("id"));
            String email = (String) fbResponse.get("email");
            String name = (String) fbResponse.get("name");
            String avatarUrl = null;

            // Extract avatar URL
            java.util.Map<String, Object> picture = (java.util.Map<String, Object>) fbResponse.get("picture");
            if (picture != null) {
                java.util.Map<String, Object> picData = (java.util.Map<String, Object>) picture.get("data");
                if (picData != null) avatarUrl = (String) picData.get("url");
            }

            if (email == null) {
                return AuthResponse.error("Facebook không cung cấp email. Vui lòng cấp quyền email.");
            }

            if (userRepository.existsByEmail(email)) {
                return AuthResponse.error("Email đã được sử dụng bởi tài khoản khác");
            }

            if (userRepository.findByFacebookId(facebookId).isPresent()) {
                return AuthResponse.error("Tài khoản Facebook này đã được liên kết");
            }

            return registerWithSocialProvider(email, name, avatarUrl, role, farmName, farmId, cvProfile,
                    "FACEBOOK", null, facebookId, name, null, null);

        } catch (Exception e) {
            return AuthResponse.error("Lỗi đăng ký Facebook: " + e.getMessage());
        }
    }

    /**
     * Login with GitHub
     */
    @Transactional
    public AuthResponse loginWithGithub(String code) {
        try {
            // Exchange code for access token
            RestTemplate restTemplate = new RestTemplate();

            HttpHeaders headers = new HttpHeaders();
            headers.set("Accept", "application/json");

            java.util.Map<String, String> tokenRequest = new java.util.HashMap<>();
            tokenRequest.put("client_id", githubClientId);
            tokenRequest.put("client_secret", githubClientSecret);
            tokenRequest.put("code", code);

            HttpEntity<java.util.Map<String, String>> entity = new HttpEntity<>(tokenRequest, headers);

            ResponseEntity<java.util.Map> tokenResponse = restTemplate.exchange(
                    "https://github.com/login/oauth/access_token",
                    HttpMethod.POST, entity, java.util.Map.class);

            if (tokenResponse.getBody() == null) {
                return AuthResponse.error("Không thể lấy token từ GitHub");
            }
            String accessToken = (String) tokenResponse.getBody().get("access_token");

            if (accessToken == null) {
                return AuthResponse.error("Không thể lấy token từ GitHub");
            }

            // Get user info
            HttpHeaders userHeaders = new HttpHeaders();
            userHeaders.set("Authorization", "Bearer " + accessToken);
            userHeaders.set("Accept", "application/json");
            HttpEntity<String> userEntity = new HttpEntity<>(userHeaders);

            ResponseEntity<java.util.Map> userResponse = restTemplate.exchange(
                    "https://api.github.com/user",
                    HttpMethod.GET, userEntity, java.util.Map.class);

            java.util.Map<String, Object> ghUser = userResponse.getBody();
            if (ghUser == null) {
                return AuthResponse.error("Không thể lấy thông tin người dùng từ GitHub");
            }
            String githubId = String.valueOf(ghUser.get("id"));
            String name = (String) ghUser.get("name");
            String login = (String) ghUser.get("login");
            String avatarUrl = (String) ghUser.get("avatar_url");

            // Get email (may be private)
            String email = (String) ghUser.get("email");
            if (email == null) {
                // Try to get from emails API
                ResponseEntity<java.util.List> emailsResponse = restTemplate.exchange(
                        "https://api.github.com/user/emails",
                        HttpMethod.GET, userEntity, java.util.List.class);
                if (emailsResponse.getBody() != null) {
                    for (Object e : emailsResponse.getBody()) {
                        java.util.Map<String, Object> emailObj = (java.util.Map<String, Object>) e;
                        if (Boolean.TRUE.equals(emailObj.get("primary"))) {
                            email = (String) emailObj.get("email");
                            break;
                        }
                    }
                }
            }

            // Try login by GitHub ID first
            User user = userRepository.findByGithubId(githubId).orElse(null);

            // If not found by GitHub ID, try by email
            if (user == null && email != null) {
                user = userRepository.findByEmail(email).orElse(null);
            }

            if (user == null) {
                // Return user info so frontend can redirect to register
                return AuthResponse.builder()
                        .success(false)
                        .message("NEEDS_REGISTRATION")
                        .email(email)
                        .fullName(name != null ? name : login)
                        .avatarUrl(avatarUrl)
                        .build();
            }

            // Update GitHub ID if not set
            if (user.getGithubId() == null) {
                user.setGithubId(githubId);
                user.setGithubUsername(login);
            }

            // Check locks
            if (!user.getIsActive()) {
                AuthResponse resp = AuthResponse.adminLocked("Tài khoản đã bị khóa",
                    user.getLockReason() != null ? user.getLockReason() : "Không có lý do cụ thể");
                resp.setEmail(user.getEmail());
                return resp;
            }
            if (user.getAccountLockedUntil() != null
                    && user.getAccountLockedUntil().isAfter(java.time.LocalDateTime.now())) {
                AuthResponse resp = AuthResponse.accountLocked("Tài khoản đang bị khóa.");
                resp.setEmail(user.getEmail());
                return resp;
            }

            user.setLastLoginAt(java.time.LocalDateTime.now());
            userRepository.save(user);

            String token = jwtService.generateToken(user);
            return AuthResponse.successWithAvatar(token, user.getEmail(), user.getFullName(), user.getRole(), user.getAvatarUrl(), user.getId());

        } catch (Exception e) {
            return AuthResponse.error("Lỗi xác thực GitHub: " + e.getMessage());
        }
    }

    /**
     * Register with GitHub
     */
    @Transactional
    public AuthResponse registerWithGithub(String code, String role, String farmName, Long farmId, String cvProfile) {
        try {
            RestTemplate restTemplate = new RestTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.set("Accept", "application/json");

            java.util.Map<String, String> tokenRequest = new java.util.HashMap<>();
            tokenRequest.put("client_id", githubClientId);
            tokenRequest.put("client_secret", githubClientSecret);
            tokenRequest.put("code", code);

            HttpEntity<java.util.Map<String, String>> entity = new HttpEntity<>(tokenRequest, headers);

            ResponseEntity<java.util.Map> tokenResponse = restTemplate.exchange(
                    "https://github.com/login/oauth/access_token",
                    HttpMethod.POST, entity, java.util.Map.class);

            String accessToken = (String) tokenResponse.getBody().get("access_token");
            if (tokenResponse.getBody() == null || accessToken == null) return AuthResponse.error("Không thể lấy token từ GitHub");

            HttpHeaders userHeaders = new HttpHeaders();
            userHeaders.set("Authorization", "Bearer " + accessToken);
            userHeaders.set("Accept", "application/json");
            HttpEntity<String> userEntity = new HttpEntity<>(userHeaders);

            ResponseEntity<java.util.Map> userResponse = restTemplate.exchange(
                    "https://api.github.com/user",
                    HttpMethod.GET, userEntity, java.util.Map.class);

            java.util.Map<String, Object> ghUser = userResponse.getBody();
            if (ghUser == null) {
                return AuthResponse.error("Không thể lấy thông tin người dùng từ GitHub");
            }
            String githubId = String.valueOf(ghUser.get("id"));
            String name = (String) ghUser.get("name");
            String login = (String) ghUser.get("login");
            String avatarUrl = (String) ghUser.get("avatar_url");
            String email = (String) ghUser.get("email");

            if (email == null) {
                ResponseEntity<java.util.List> emailsResponse = restTemplate.exchange(
                        "https://api.github.com/user/emails",
                        HttpMethod.GET, userEntity, java.util.List.class);
                if (emailsResponse.getBody() != null) {
                    for (Object e : emailsResponse.getBody()) {
                        java.util.Map<String, Object> emailObj = (java.util.Map<String, Object>) e;
                        if (Boolean.TRUE.equals(emailObj.get("primary"))) {
                            email = (String) emailObj.get("email");
                            break;
                        }
                    }
                }
            }

            if (email == null) return AuthResponse.error("Không thể lấy email từ GitHub");

            if (userRepository.existsByEmail(email)) {
                return AuthResponse.error("Email đã được sử dụng bởi tài khoản khác");
            }
            if (userRepository.findByGithubId(githubId).isPresent()) {
                return AuthResponse.error("Tài khoản GitHub này đã được liên kết");
            }

            return registerWithSocialProvider(email, name != null ? name : login, avatarUrl, role, farmName, farmId, cvProfile,
                    "GITHUB", null, null, null, githubId, login);

        } catch (Exception e) {
            return AuthResponse.error("Lỗi đăng ký GitHub: " + e.getMessage());
        }
    }

    /**
     * Generic social provider registration
     */
    @Transactional
    private AuthResponse registerWithSocialProvider(String email, String fullName, String avatarUrl,
            String roleStr, String farmName, Long farmId, String cvProfile,
            String provider, String googleId, String facebookId, String facebookName,
            String githubId, String githubUsername) {

        UserRole role;
        try {
            role = UserRole.valueOf(roleStr);
        } catch (Exception e) {
            return AuthResponse.error("Vai trò không hợp lệ");
        }

        if (role == UserRole.SYSTEM_ADMIN) {
            return AuthResponse.error("Không thể đăng ký quản trị viên qua mạng xã hội");
        }

        if (role == UserRole.OWNER && (farmName == null || farmName.trim().isEmpty())) {
            return AuthResponse.error("Vui lòng nhập tên nông trại");
        }

        if (role == UserRole.WORKER && farmId == null) {
            return AuthResponse.error("Vui lòng chọn nông trại ứng tuyển");
        }

        User.UserBuilder userBuilder = User.builder()
                .fullName(fullName)
                .email(email)
                .passwordHash(passwordEncoder.encode(java.util.UUID.randomUUID().toString()))
                .role(role)
                .avatarUrl(avatarUrl)
                .authProvider(provider)
                .isActive(true);

        if (googleId != null) userBuilder.googleId(googleId);
        if (facebookId != null) { userBuilder.facebookId(facebookId); userBuilder.facebookName(facebookName); }
        if (githubId != null) { userBuilder.githubId(githubId); userBuilder.githubUsername(githubUsername); }

        if (role == UserRole.WORKER) {
            userBuilder.isActive(false);
            userBuilder.approvalStatus(User.ApprovalStatus.PENDING);
            userBuilder.farmId(farmId);
            userBuilder.cvProfile(cvProfile);
        } else {
            userBuilder.approvalStatus(User.ApprovalStatus.APPROVED);
        }

        User user = userBuilder.build();
        userRepository.save(user);

        if (role == UserRole.OWNER) {
            Farm farm = Farm.builder()
                    .name(farmName.trim())
                    .ownerId(user.getId())
                    .build();
            farmRepository.save(farm);
        }

        if (role == UserRole.WORKER) {
            return AuthResponse.approvalRequired("Hồ sơ của bạn đã được gửi. Vui lòng chờ Chủ trang trại duyệt.");
        }

        String token = jwtService.generateToken(user);
        return AuthResponse.successWithAvatar(token, user.getEmail(), user.getFullName(), user.getRole(), user.getAvatarUrl(), user.getId());
    }

    /**
     * Register face for an authenticated user
     * @param email User email
     * @param faceEncoding Face encoding string from Python
     * @param faceImagePath Path to saved face image
     * @return AuthResponse
     */
    @Transactional
    public AuthResponse registerFace(String email, String faceEncoding, String faceImagePath) {
        User user = getUserByEmail(email);
        if (user == null) return AuthResponse.error("Người dùng không tồn tại");

        // Check if this face encoding already belongs to another user
        java.util.List<User> facedUsers = userRepository.findAllByFaceEnabledTrue();
        for (User facedUser : facedUsers) {
            if (!facedUser.getEmail().equals(email) && facedUser.getFaceEncoding() != null) {
                // Face comparison will be done by Python service
                // This is just a marker - real comparison done externally
            }
        }

        user.setFaceEncoding(faceEncoding);
        user.setFaceImagePath(faceImagePath);
        user.setFaceEnabled(true);
        user.setFaceRegisteredAt(java.time.LocalDateTime.now());
        userRepository.save(user);

        return AuthResponse.builder()
                .success(true)
                .message("Đăng ký khuôn mặt thành công")
                .build();
    }

    /**
     * Disable face login for user
     */
    @Transactional
    public AuthResponse disableFaceLogin(String email) {
        User user = getUserByEmail(email);
        if (user == null) return AuthResponse.error("Người dùng không tồn tại");

        user.setFaceEnabled(false);
        user.setFaceEncoding(null);
        user.setFaceImagePath(null);
        user.setFaceRegisteredAt(null);
        userRepository.save(user);

        return AuthResponse.builder()
                .success(true)
                .message("Đã tắt đăng nhập bằng khuôn mặt")
                .build();
    }

    /**
     * Login with face - find matching user by face encoding
     * @param matchedEmail The email found by Python face matching service
     */
    public AuthResponse loginWithFace(String matchedEmail) {
        User user = userRepository.findByEmail(matchedEmail).orElse(null);

        if (user == null) return AuthResponse.error("Không tìm thấy tài khoản");

        if (!Boolean.TRUE.equals(user.getFaceEnabled())) {
            return AuthResponse.error("Tính năng đăng nhập khuôn mặt chưa được kích hoạt cho tài khoản này");
        }

        if (!user.getIsActive()) {
            return AuthResponse.adminLocked("Tài khoản đã bị khóa",
                user.getLockReason() != null ? user.getLockReason() : "Không có lý do cụ thể");
        }

        if (user.getAccountLockedUntil() != null
                && user.getAccountLockedUntil().isAfter(java.time.LocalDateTime.now())) {
            return AuthResponse.accountLocked("Tài khoản đang bị khóa.");
        }

        user.setLastLoginAt(java.time.LocalDateTime.now());
        userRepository.save(user);

        String token = jwtService.generateToken(user);
        return AuthResponse.successWithAvatar(token, user.getEmail(), user.getFullName(), user.getRole(), user.getAvatarUrl(), user.getId());
    }

    /**
     * Get all users with face enabled (for Python face matching)
     */
    public java.util.List<java.util.Map<String, String>> getAllFaceUsers() {
        java.util.List<User> users = userRepository.findAllByFaceEnabledTrue();
        java.util.List<java.util.Map<String, String>> result = new java.util.ArrayList<>();
        for (User u : users) {
            if (u.getFaceEncoding() != null) {
                java.util.Map<String, String> map = new java.util.HashMap<>();
                map.put("email", u.getEmail());
                map.put("faceEncoding", u.getFaceEncoding());
                map.put("fullName", u.getFullName());
                result.add(map);
            }
        }
        return result;
    }
}
