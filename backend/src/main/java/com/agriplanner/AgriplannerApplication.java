package com.agriplanner;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Main Spring Boot Application class for AgriPlanner
 * Agricultural Management System
 */
@SpringBootApplication
@EnableScheduling
public class AgriplannerApplication {

    public static void main(String[] args) {
        SpringApplication.run(AgriplannerApplication.class, args);
    }

}
