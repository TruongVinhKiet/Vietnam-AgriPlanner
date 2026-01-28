package com.agriplanner.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;

    /**
     * Send OTP email with professional template
     */
    @Async
    public void sendOtpEmail(String to, String otp, String type) {
        String subject = "AgriPlanner - Mã xác thực bảo mật";
        String actionText = type.equals("PASSWORD_CHANGE") ? "đổi mật khẩu"
                : (type.equals("EMAIL_CHANGE") ? "đổi email"
                        : (type.equals("UNLOCK_ACCOUNT") ? "mở khóa tài khoản" : "xác thực"));

        String htmlContent = String.format(
                """
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <style>
                                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
                                .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
                                .header { background-color: #2E7D32; color: #fff; padding: 20px; text-align: center; }
                                .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
                                .content { padding: 30px; text-align: center; }
                                .otp-box { background-color: #e8f5e9; border: 2px dashed #2E7D32; border-radius: 8px; padding: 15px; margin: 20px 0; display: inline-block; }
                                .otp-code { font-size: 32px; font-weight: bold; color: #2E7D32; letter-spacing: 5px; margin: 0; }
                                .footer { background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 13px; color: #777; border-top: 1px solid #eee; }
                                .warning { color: #d32f2f; font-size: 13px; margin-top: 10px; }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <div class="header">
                                    <h1>AgriPlanner Security</h1>
                                </div>
                                <div class="content">
                                    <p>Xin chào,</p>
                                    <p>Bạn vừa yêu cầu mã OTP để <strong>%s</strong>.</p>
                                    <p>Dưới đây là mã xác thực của bạn:</p>

                                    <div class="otp-box">
                                        <p class="otp-code">%s</p>
                                    </div>

                                    <p>Mã này sẽ hết hạn trong <strong>5 phút</strong>.</p>
                                    <p class="warning">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này hoặc liên hệ với bộ phận hỗ trợ ngay lập tức.</p>
                                </div>
                                <div class="footer">
                                    <p>&copy; 2024 AgriPlanner. All rights reserved.</p>
                                    <p>Đây là email tự động, vui lòng không trả lời.</p>
                                </div>
                            </div>
                        </body>
                        </html>
                        """,
                actionText, otp);

        sendHtmlEmail(to, subject, htmlContent);
    }

    /**
     * Send simple HTML email
     */
    @Async
    @SuppressWarnings("null")
    public void sendHtmlEmail(String to, String subject, String htmlContent) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(fromEmail);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlContent, true);

            mailSender.send(message);
            log.info("Email sent successfully to: {}", to);
        } catch (MessagingException e) {
            log.error("Failed to send email to: {}", to, e);
        }
    }
}
