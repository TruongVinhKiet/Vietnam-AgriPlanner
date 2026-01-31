/*
 * watermark: AGRIPLANNER-TVK-2026-TNL-TK4L6
 * Copyright (c) 2026 Truong Vinh Kiet
 */
package com.agriplanner.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(@NonNull ResourceHandlerRegistry registry) {
        // Map /uploads/** URL to the local uploads directory
        // "file:uploads/" resolves relative to the working directory (backend)
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(
                        "file:./uploads/",
                        "file:uploads/",
                        "file:E:/Agriplanner/backend/uploads/",
                        "file:///E:/Agriplanner/backend/uploads/");
    }
}
