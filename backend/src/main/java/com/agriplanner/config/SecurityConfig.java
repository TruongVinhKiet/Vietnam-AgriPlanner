package com.agriplanner.config;

import com.agriplanner.security.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

/**
 * Security configuration for Spring Security
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthFilter;

    @Value("${cors.allowed-origins}")
    private String allowedOrigins;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .authorizeHttpRequests(auth -> auth
                        // Allow all OPTIONS requests for CORS preflight
                        .requestMatchers(org.springframework.http.HttpMethod.OPTIONS, "/**").permitAll()
                        // Public endpoints
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/api/public/**").permitAll()
                        .requestMatchers("/error").permitAll()
                        .requestMatchers("/api/farms/list").permitAll()
                        .requestMatchers("/api/farms/**").permitAll()
                        .requestMatchers("/api/user/**").permitAll()
                        .requestMatchers("/api/security/unlock/**").permitAll()
                        .requestMatchers("/api/fields/**").permitAll()
                        .requestMatchers("/api/fields").permitAll()
                        .requestMatchers("/api/crops/**").permitAll()
                        .requestMatchers("/api/fertilizers/**").permitAll()
                        .requestMatchers("/api/machinery/**").permitAll()
                        // New feature endpoints
                        .requestMatchers("/api/marketplace/**").permitAll()
                        .requestMatchers("/api/pests/**").permitAll()
                        .requestMatchers("/api/notifications/**").permitAll()
                        .requestMatchers("/api/irrigation/**").permitAll()
                        .requestMatchers("/api/analytics/**").permitAll()
                        .requestMatchers("/api/harvest-records/**").permitAll()
                        .requestMatchers("/api/assets/**").permitAll()
                        .requestMatchers("/api/dashboard/**").permitAll()
                        // New Advanced Features
                        .requestMatchers("/api/ai/**").permitAll()
                        .requestMatchers("/api/inventory/**").permitAll()
                        .requestMatchers("/api/weather/**").permitAll()
                        .requestMatchers("/api/traceability/**").permitAll()
                        // Livestock management
                        .requestMatchers("/api/livestock/**").permitAll()
                        .requestMatchers("/api/feeding/**").permitAll()
                        // Shop & Inventory
                        .requestMatchers("/api/shop/**").permitAll()
                        // Cart & Reviews
                        .requestMatchers("/api/cart/**").permitAll()
                        .requestMatchers("/api/reviews/**").permitAll()
                        // Orders & Addresses
                        .requestMatchers("/api/orders/**").permitAll()
                        .requestMatchers("/api/addresses/**").permitAll()
                        // Cooperatives
                        .requestMatchers("/api/cooperatives/**").permitAll()
                        // Community features
                        .requestMatchers("/api/guides/**").permitAll()
                        .requestMatchers("/api/posts/**").permitAll()
                        .requestMatchers("/api/chat/**").permitAll()
                        .requestMatchers("/api/friends/**").permitAll()
                        // Money transfer
                        .requestMatchers("/api/money/**").permitAll()
                        // Static uploads (images, videos)
                        .requestMatchers("/uploads/**").permitAll()
                        // Debug
                        .requestMatchers("/api/debug/**").permitAll()
                        // Task Management
                        .requestMatchers("/api/tasks/worker/**").hasAnyRole("WORKER", "OWNER")
                        .requestMatchers("/api/tasks/*/complete").hasAnyRole("WORKER", "OWNER", "SYSTEM_ADMIN")
                        .requestMatchers("/api/tasks/**").hasAnyRole("OWNER", "SYSTEM_ADMIN")

                        // Payroll
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/payroll/settings/worker/**")
                        .hasAnyRole("WORKER", "OWNER", "SYSTEM_ADMIN")
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/payroll/payments/worker/**")
                        .hasAnyRole("WORKER", "OWNER", "SYSTEM_ADMIN")
                        .requestMatchers("/api/payroll/**").hasAnyRole("OWNER", "SYSTEM_ADMIN")

                        // Help/Feedback
                        .requestMatchers(org.springframework.http.HttpMethod.PUT, "/api/help/*/respond")
                        .hasAnyRole("OWNER", "SYSTEM_ADMIN")
                        .requestMatchers(org.springframework.http.HttpMethod.PUT, "/api/help/*/close")
                        .hasAnyRole("OWNER", "SYSTEM_ADMIN")
                        .requestMatchers("/api/help/**").hasAnyRole("WORKER", "OWNER", "SYSTEM_ADMIN")

                        // Work logs
                        .requestMatchers("/api/worklogs/**").hasAnyRole("WORKER", "OWNER", "SYSTEM_ADMIN")

                        // Admin only endpoints
                        .requestMatchers("/api/admin/**").hasRole("SYSTEM_ADMIN")
                        // All other endpoints require authentication
                        .anyRequest().authenticated())
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        // Use origin patterns to allow all origins with credentials
        configuration.setAllowedOriginPatterns(List.of("*"));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setExposedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}
