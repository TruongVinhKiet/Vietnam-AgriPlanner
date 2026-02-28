/*
 * watermark: AGRIPLANNER-TVK-2026-TNL-TK4L6
 * Copyright (c) 2026 Truong Vinh Kiet
 */
// =================================================
// AgriPlanner - Configuration File
// Frontend API Keys and Settings
// =================================================

const CONFIG = {
    // Backend API Base URL
    API_BASE_URL: 'http://localhost:8080/api',

    // OpenWeather API
    OPENWEATHER_API_KEY: 'YOUR_OPENWEATHER_API_KEY',

    // OpenRouter API (for AI Chatbot with Gemini)
    OPENROUTER_API_KEY: 'YOUR_OPENROUTER_API_KEY',

    // OpenRouter Backup API (for Gemma 3 27B free model)
    OPENROUTER_BACKUP_API_KEY: 'YOUR_OPENROUTER_BACKUP_API_KEY',

    // Google Gemini API (direct)
    GEMINI_API_KEY: 'YOUR_GEMINI_API_KEY',

    // Default farm location (Vietnam - Mekong Delta)
    DEFAULT_LOCATION: {
        lat: 10.045162,
        lng: 105.746857,
        name: 'Đồng bằng sông Cửu Long'
    },

    // Weather update interval (milliseconds)
    WEATHER_UPDATE_INTERVAL: 600000, // 10 minutes

    // Map default settings (for Leaflet)
    MAP_DEFAULT_ZOOM: 16,
    MAP_MIN_ZOOM: 10,
    MAP_MAX_ZOOM: 19,

    // Chatbot settings
    CHATBOT: {
        MAX_HISTORY_MESSAGES: 10,  // Limit context to save tokens
        MAX_TOKENS_PER_RESPONSE: 500,  // Limit response length
        MODEL: 'google/gemini-2.0-flash-001',  // Using Gemini via OpenRouter
        BACKUP_MODEL: 'google/gemma-3-27b-it:free'  // Free backup model via OpenRouter
    },

    // Smart Advisor AI settings
    SMART_ADVISOR: {
        GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
        OPENROUTER_API_URL: 'https://openrouter.ai/api/v1/chat/completions',
        PRIMARY_MODEL: 'gemini-1.5-flash',
        BACKUP_MODEL: 'google/gemma-3-27b-it:free',
        MAX_TOKENS: 1000
    },

    // Groq AI for Voice Search
    GROQ_API_KEY: 'YOUR_GROQ_API_KEY',
    GROQ_API_URL: 'https://api.groq.com/openai/v1/chat/completions',
    GROQ_MODEL: 'llama-3.3-70b-versatile',

    // Feature flags
    FEATURES: {
        USE_LEAFLET_MAP: true,
        USE_OPENWEATHER: true,
        USE_CHATBOT: true,
        ENABLE_OFFLINE_MODE: false
    }
};

// Freeze config to prevent modification
Object.freeze(CONFIG);
Object.freeze(CONFIG.DEFAULT_LOCATION);
Object.freeze(CONFIG.CHATBOT);
Object.freeze(CONFIG.FEATURES);
Object.freeze(CONFIG.SMART_ADVISOR);

// Export global constants for easy access
const API_BASE_URL = CONFIG.API_BASE_URL;

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
