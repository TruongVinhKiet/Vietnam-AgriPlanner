package com.agriplanner.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Discord OTP Service
 * Generates OTP codes and sends them to a Discord channel via Bot API
 * Used for withdrawal verification
 */
@Service
@Slf4j
public class DiscordOtpService {

    @Value("${discord.bot.token:}")
    private String botToken;

    @Value("${discord.channel.id:}")
    private String channelId;

    // Store OTP codes with expiry (email -> OtpEntry)
    private final Map<String, OtpEntry> otpStore = new ConcurrentHashMap<>();
    private final SecureRandom secureRandom = new SecureRandom();
    private final HttpClient httpClient = HttpClient.newHttpClient();

    private static final int OTP_EXPIRY_MINUTES = 5;

    /**
     * Generate and send OTP to Discord channel
     */
    public String generateAndSendOtp(String email, String fullName, double amount) {
        // Generate 6-digit OTP
        String otp = generateOtp();

        // Store OTP with expiry
        otpStore.put(email, new OtpEntry(otp, LocalDateTime.now().plusMinutes(OTP_EXPIRY_MINUTES), amount));

        // Send OTP to Discord
        sendToDiscord(email, fullName, otp, amount);

        log.info("[DISCORD-OTP] OTP generated for {} (amount: {})", email, amount);
        return otp;
    }

    /**
     * Verify OTP code
     */
    public boolean verifyOtp(String email, String code) {
        OtpEntry entry = otpStore.get(email);
        if (entry == null) {
            log.warn("[DISCORD-OTP] No OTP found for {}", email);
            return false;
        }

        // Check expiry
        if (LocalDateTime.now().isAfter(entry.expiry)) {
            otpStore.remove(email);
            log.warn("[DISCORD-OTP] OTP expired for {}", email);
            return false;
        }

        // Verify code
        if (entry.code.equals(code.trim())) {
            otpStore.remove(email); // One-time use
            log.info("[DISCORD-OTP] OTP verified successfully for {}", email);
            return true;
        }

        log.warn("[DISCORD-OTP] Invalid OTP for {}", email);
        return false;
    }

    /**
     * Get stored withdrawal amount for email (used after OTP verification)
     */
    public Double getStoredAmount(String email) {
        OtpEntry entry = otpStore.get(email);
        return entry != null ? entry.amount : null;
    }

    /**
     * Generate a random 6-digit OTP
     */
    private String generateOtp() {
        int otp = secureRandom.nextInt(900000) + 100000; // 100000-999999
        return String.valueOf(otp);
    }

    /**
     * Send OTP message to Discord channel via Bot API
     */
    private void sendToDiscord(String email, String fullName, String otp, double amount) {
        if (botToken == null || botToken.isEmpty() || channelId == null || channelId.isEmpty()) {
            log.error("[DISCORD-OTP] Discord bot token or channel ID not configured!");
            return;
        }

        try {
            String formattedAmount = String.format("%,.0f", amount);

            // Build Discord embed message
            String jsonBody = """
                {
                    "embeds": [{
                        "title": "🔐 Mã OTP Rút Tiền - AgriPlanner",
                        "description": "Yêu cầu rút tiền cần xác thực OTP",
                        "color": 3066993,
                        "fields": [
                            {
                                "name": "👤 Người yêu cầu",
                                "value": "%s",
                                "inline": true
                            },
                            {
                                "name": "📧 Email",
                                "value": "%s",
                                "inline": true
                            },
                            {
                                "name": "💰 Số tiền rút",
                                "value": "%s VNĐ",
                                "inline": false
                            },
                            {
                                "name": "🔑 Mã OTP",
                                "value": "```%s```",
                                "inline": false
                            },
                            {
                                "name": "⏰ Hiệu lực",
                                "value": "%d phút",
                                "inline": true
                            }
                        ],
                        "footer": {
                            "text": "AgriPlanner Security System"
                        },
                        "timestamp": "%s"
                    }]
                }
                """.formatted(
                    fullName != null ? fullName : "N/A",
                    email,
                    formattedAmount,
                    otp,
                    OTP_EXPIRY_MINUTES,
                    java.time.Instant.now().toString()
                );

            String url = "https://discord.com/api/v10/channels/" + channelId + "/messages";

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Authorization", "Bot " + botToken)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200 || response.statusCode() == 201) {
                log.info("[DISCORD-OTP] OTP sent to Discord channel successfully");
            } else {
                log.error("[DISCORD-OTP] Failed to send to Discord. Status: {}, Body: {}",
                        response.statusCode(), response.body());
            }
        } catch (Exception e) {
            log.error("[DISCORD-OTP] Error sending OTP to Discord: {}", e.getMessage(), e);
        }
    }

    /**
     * Inner class to store OTP entries
     */
    private static class OtpEntry {
        final String code;
        final LocalDateTime expiry;
        final double amount;

        OtpEntry(String code, LocalDateTime expiry, double amount) {
            this.code = code;
            this.expiry = expiry;
            this.amount = amount;
        }
    }
}
