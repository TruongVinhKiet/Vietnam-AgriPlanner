package com.agriplanner.service;

import com.warrenstrange.googleauth.GoogleAuthenticator;
import com.warrenstrange.googleauth.GoogleAuthenticatorKey;
import org.springframework.stereotype.Service;

@Service
public class TwoFactorService {

    private final GoogleAuthenticator gAuth = new GoogleAuthenticator();

    public String generateSecret() {
        final GoogleAuthenticatorKey key = gAuth.createCredentials();
        return key.getKey();
    }

    /**
     * Get the OTP Auth URI for generating QR code on client side
     */
    public String getOtpAuthUri(String secret, String account) {
        String issuer = "AgriPlanner";
        return String.format("otpauth://totp/%s:%s?secret=%s&issuer=%s",
                issuer, account, secret, issuer);
    }

    public boolean validateCode(String secret, int code) {
        return gAuth.authorize(secret, code);
    }

    /**
     * Validate code with scratch codes support (if implemented later)
     * For now just strict totp validation
     */
    public boolean validateCode(String secret, String codeStr) {
        try {
            int code = Integer.parseInt(codeStr.trim());
            return validateCode(secret, code);
        } catch (NumberFormatException e) {
            return false;
        }
    }
}
