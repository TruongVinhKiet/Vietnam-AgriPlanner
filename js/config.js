// =================================================
// AgriPlanner - Configuration File
// Frontend API Keys and Settings
// =================================================

const CONFIG = {
    // Backend API Base URL
    API_BASE_URL: 'http://localhost:8080/api',

    // OpenWeather API
    OPENWEATHER_API_KEY: 'b8af10f307905b21faeab50e5e2de08b',

    // OpenRouter API (for AI Chatbot with Gemini)
    OPENROUTER_API_KEY: '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',
    
    // OpenRouter Backup API (for Gemma 3 27B free model)
    OPENROUTER_BACKUP_API_KEY: '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',

    // Google Gemini API (direct)
    GEMINI_API_KEY: 'AIzaSyDLeX_tpJbj5Qh25b7-8zwRgCrbfMU32W0',

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

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
