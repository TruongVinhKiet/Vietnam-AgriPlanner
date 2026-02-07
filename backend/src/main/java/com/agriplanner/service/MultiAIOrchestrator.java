package com.agriplanner.service;

import com.agriplanner.model.PlanningZoneType;
import com.agriplanner.model.SoilType;
import com.agriplanner.service.GeminiVisionService.GeminiErrorType;
import com.agriplanner.service.GeminiVisionService.GeminiResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.stream.Stream;

/**
 * Hybrid Multi-AI Orchestrator Service (v2.1)
 * 
 * HỖ TRỢ 2 LOẠI BẢN ĐỒ:
 * - soil (Thổ nhưỡng): Mapping với bảng soil_types (Phèn, Mặn, Phù sa...)
 * - planning (Quy hoạch): Mapping với bảng planning_zone_types (LUC, ONT,
 * RSX...)
 * 
 * LUỒNG XỬ LÝ HYBRID:
 * ┌─────────────────────────────────────────────────────────────┐
 * │ Bước 1: GEMINI 1.5 PRO → Trích xuất tọa độ từ bản đồ │
 * │ (Fallback: GPT-4o nếu Gemini lỗi/hết quota) │
 * ├─────────────────────────────────────────────────────────────┤
 * │ Bước 2: OPENCV (Python) → Tách vùng màu, tạo polygon │
 * │ Trích xuất ảnh chú giải (legend) │
 * ├─────────────────────────────────────────────────────────────┤
 * │ Bước 3: GPT-4o → Đọc chú giải, gán nhãn loại đất │
 * │ Map với Database chuẩn (soil_types / planning_zone_types) │
 * └─────────────────────────────────────────────────────────────┘
 */
@Service
public class MultiAIOrchestrator {

    private static final Logger logger = LoggerFactory.getLogger(MultiAIOrchestrator.class);

    // AI-specific loggers for detailed tracking
    private static final Logger opencvLogger = LoggerFactory.getLogger("AI.OpenCV");
    private static final Logger gpt4oLogger = LoggerFactory.getLogger("AI.GPT4o");
    private static final Logger geminiLogger = LoggerFactory.getLogger("AI.Gemini");

    // Map type constants
    public static final String MAP_TYPE_SOIL = "soil"; // Bản đồ thổ nhưỡng
    public static final String MAP_TYPE_PLANNING = "planning"; // Bản đồ quy hoạch

    @Value("${ai.github.token:}")
    private String githubToken;

    @Value("${ai.github.model:gpt-4o}")
    private String githubModel;

    @Value("${python.path:python}")
    private String pythonPath;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    // Soil type mapping service for AI-to-DB mapping (Thổ nhưỡng)
    @Autowired
    private SoilTypeMappingService soilTypeMappingService;

    // Planning zone type mapping service for AI-to-DB mapping (Quy hoạch)
    @Autowired
    private PlanningZoneTypeMappingService planningZoneTypeMappingService;

    // Gemini Vision service for coordinate extraction
    @Autowired
    private GeminiVisionService geminiVisionService;

    // API Endpoints
    private static final String GITHUB_API_URL = "https://models.inference.ai.azure.com/chat/completions";

    // Known map coordinates (mock data for better accuracy)
    private static final Map<String, Map<String, Object>> KNOWN_MAP_COORDINATES = new HashMap<>();

    // Known color mappings for specific maps (mock data from chú giải)
    // Maps: filename_key -> Map of hex color -> soil type name
    private static final Map<String, Map<String, String>> KNOWN_COLOR_MAPPINGS = new HashMap<>();

    static {
        // ==================== CÀ MAU THỔ NHƯỠNG ====================
        // Coordinates based on actual map bounds (104°45' - 105°15', 8°35' - 9°35')
        // Tọa độ chính xác 4 điểm:
        // P1: x=105, y=9.25 | P2: x=105.25, y=9.25
        // P3: x=105, y=9 | P4: x=105.25, y=9
        Map<String, Object> caMauSoilCoords = new HashMap<>();
        caMauSoilCoords.put("sw", Map.of("lat", 9.0, "lng", 105.0)); // P3 - Southwest corner
        caMauSoilCoords.put("ne", Map.of("lat", 9.25, "lng", 105.25)); // P2 - Northeast corner
        caMauSoilCoords.put("center", Map.of("lat", 9.125, "lng", 105.125));
        caMauSoilCoords.put("scale", "1:100000");
        caMauSoilCoords.put("province", "Cà Mau");
        KNOWN_MAP_COORDINATES.put("ca_mau_tho_nhuong", caMauSoilCoords);
        KNOWN_MAP_COORDINATES.put("cà_mau_thổ_nhưỡng", caMauSoilCoords);
        KNOWN_MAP_COORDINATES.put("camau_soil", caMauSoilCoords);

        // Color mappings for Cà Mau Thổ Nhưỡng (from chú dẫn image)
        // Based on ACTUAL colors extracted from legend image using OpenCV
        // (analyze_legend_colors.py)
        // Date: Extracted from "Chú thích_thổ nhưỡng.jpeg"
        Map<String, String> caMauSoilColors = new LinkedHashMap<>();

        // === ĐẤT CÁT GIỒNG - Bright Yellow (missing in scan, added manually) ===
        caMauSoilColors.put("#ffff00", "Đất cát giồng");
        caMauSoilColors.put("#fdfb06", "Đất cát giồng"); // K-means detected
        caMauSoilColors.put("#fcfa18", "Đất cát giồng"); // K-means detected
        caMauSoilColors.put("#fff000", "Đất cát giồng");

        // === ĐẤT MẶN NHIỀU - Bright Yellow #fefd03 ===
        caMauSoilColors.put("#fefd03", "Đất mặn nhiều"); // OpenCV exact: RGB(254,253,3)
        caMauSoilColors.put("#ffff33", "Đất mặn nhiều");
        caMauSoilColors.put("#fffc00", "Đất mặn nhiều");

        // === ĐẤT MẶN TRUNG BÌNH - Light Purple #ca93fb ===
        caMauSoilColors.put("#ca93fb", "Đất mặn trung bình"); // OpenCV exact: RGB(202,147,251)
        caMauSoilColors.put("#cea2f7", "Đất mặn trung bình"); // K-means detected
        caMauSoilColors.put("#c090f8", "Đất mặn trung bình");
        caMauSoilColors.put("#d0a0fc", "Đất mặn trung bình");

        // === ĐẤT MẶN ÍT - Light Purple #cfa0fc ===
        caMauSoilColors.put("#cfa0fc", "Đất mặn ít"); // OpenCV exact: RGB(207,160,252)
        caMauSoilColors.put("#d0a8fc", "Đất mặn ít");
        caMauSoilColors.put("#c898f8", "Đất mặn ít");
        // Additional colors for Đất mặn ít (very light/white with slight pink)
        caMauSoilColors.put("#ffffff", "Đất mặn ít");
        caMauSoilColors.put("#fcfcfc", "Đất mặn ít"); // 6.9% - dominant
        caMauSoilColors.put("#fcf8fc", "Đất mặn ít"); // 5.0%
        caMauSoilColors.put("#f8f8f8", "Đất mặn ít"); // 2.5%
        caMauSoilColors.put("#f8fcfc", "Đất mặn ít"); // 1.5%
        caMauSoilColors.put("#f8f8fc", "Đất mặn ít"); // 1.5%
        caMauSoilColors.put("#f4f4f4", "Đất mặn ít");
        caMauSoilColors.put("#f4fcfc", "Đất mặn ít");
        caMauSoilColors.put("#fcf8f8", "Đất mặn ít");
        caMauSoilColors.put("#fcfcf8", "Đất mặn ít");

        // === ĐẤT PHÈN TIỀM TÀNG NÔNG dưới rừng ngập mặn - Very Light Purple #d8b2fd
        // ===
        // This is the DOMINANT soil type in Cà Mau (19.7%)
        caMauSoilColors.put("#d8b0fc", "Đất phèn tiềm tàng nông dưới rừng ngập mặn"); // 4.6% - dominant
        caMauSoilColors.put("#cca0fc", "Đất phèn tiềm tàng nông dưới rừng ngập mặn"); // 4.3%
        caMauSoilColors.put("#d8b2fd", "Đất phèn tiềm tàng nông dưới rừng ngập mặn"); // OpenCV exact
        caMauSoilColors.put("#d5b0fa", "Đất phèn tiềm tàng nông dưới rừng ngập mặn");
        caMauSoilColors.put("#dcb8fc", "Đất phèn tiềm tàng nông dưới rừng ngập mặn");
        caMauSoilColors.put("#dcb0fc", "Đất phèn tiềm tàng nông dưới rừng ngập mặn");
        caMauSoilColors.put("#d8acfc", "Đất phèn tiềm tàng nông dưới rừng ngập mặn");
        caMauSoilColors.put("#d4b0fc", "Đất phèn tiềm tàng nông dưới rừng ngập mặn");
        caMauSoilColors.put("#d0a0fc", "Đất phèn tiềm tàng nông dưới rừng ngập mặn");
        caMauSoilColors.put("#cca0f8", "Đất phèn tiềm tàng nông dưới rừng ngập mặn");
        caMauSoilColors.put("#cc9cf8", "Đất phèn tiềm tàng nông dưới rừng ngập mặn");
        caMauSoilColors.put("#c890fc", "Đất phèn tiềm tàng nông dưới rừng ngập mặn");
        caMauSoilColors.put("#c490fc", "Đất phèn tiềm tàng nông dưới rừng ngập mặn");
        caMauSoilColors.put("#d4acfc", "Đất phèn tiềm tàng nông dưới rừng ngập mặn");
        caMauSoilColors.put("#dcb4fc", "Đất phèn tiềm tàng nông dưới rừng ngập mặn");

        // === ĐẤT PHÈN TIỀM TÀNG NÔNG, MẶN NHIỀU - Light Blue-Purple #c3d6fe ===
        caMauSoilColors.put("#c3d6fe", "Đất phèn tiềm tàng nông, mặn nhiều"); // OpenCV exact
        caMauSoilColors.put("#c1cbfa", "Đất phèn tiềm tàng nông, mặn nhiều");
        caMauSoilColors.put("#c0d4fc", "Đất phèn tiềm tàng nông, mặn nhiều"); // 1.5% actual
        caMauSoilColors.put("#c0d0fc", "Đất phèn tiềm tàng nông, mặn nhiều");
        caMauSoilColors.put("#bcd0fc", "Đất phèn tiềm tàng nông, mặn nhiều");
        caMauSoilColors.put("#bcd4fc", "Đất phèn tiềm tàng nông, mặn nhiều");
        caMauSoilColors.put("#b8d0fc", "Đất phèn tiềm tàng nông, mặn nhiều");
        caMauSoilColors.put("#b8d4fc", "Đất phèn tiềm tàng nông, mặn nhiều");
        caMauSoilColors.put("#c4d0fc", "Đất phèn tiềm tàng nông, mặn nhiều");
        caMauSoilColors.put("#c4d4fc", "Đất phèn tiềm tàng nông, mặn nhiều");
        caMauSoilColors.put("#c0d8fc", "Đất phèn tiềm tàng nông, mặn nhiều");

        // === ĐẤT PHÈN TIỀM TÀNG NÔNG, MẶN TRUNG BÌNH - Bright Pink-Purple #fe84fd ===
        caMauSoilColors.put("#fc80fc", "Đất phèn tiềm tàng nông, mặn trung bình"); // 2.6% actual
        caMauSoilColors.put("#fe84fd", "Đất phèn tiềm tàng nông, mặn trung bình"); // OpenCV exact
        caMauSoilColors.put("#f97ef6", "Đất phèn tiềm tàng nông, mặn trung bình");
        caMauSoilColors.put("#fc84f8", "Đất phèn tiềm tàng nông, mặn trung bình");
        caMauSoilColors.put("#fc84fc", "Đất phèn tiềm tàng nông, mặn trung bình");
        caMauSoilColors.put("#fc80f8", "Đất phèn tiềm tàng nông, mặn trung bình");
        caMauSoilColors.put("#fc7cf8", "Đất phèn tiềm tàng nông, mặn trung bình");
        caMauSoilColors.put("#fc7cfc", "Đất phèn tiềm tàng nông, mặn trung bình");
        caMauSoilColors.put("#fc88f8", "Đất phèn tiềm tàng nông, mặn trung bình");
        caMauSoilColors.put("#fc88fc", "Đất phèn tiềm tàng nông, mặn trung bình");

        // === ĐẤT PHÈN TIỀM TÀNG NÔNG, MẶN ÍT - Light Pink #ffb1d9 ===
        caMauSoilColors.put("#ffb1d9", "Đất phèn tiềm tàng nông, mặn ít"); // OpenCV exact: RGB(255,177,217)
        caMauSoilColors.put("#f5b2db", "Đất phèn tiềm tàng nông, mặn ít"); // K-means detected
        caMauSoilColors.put("#fcb0d8", "Đất phèn tiềm tàng nông, mặn ít");

        // === ĐẤT PHÈN TIỀM TÀNG SÂU dưới rừng ngập mặn - Very Light Pink #ffcfff ===
        caMauSoilColors.put("#ffcfff", "Đất phèn tiềm tàng sâu dưới rừng ngập mặn"); // OpenCV exact: RGB(255,207,255)
        caMauSoilColors.put("#f9d2f9", "Đất phèn tiềm tàng sâu dưới rừng ngập mặn"); // K-means detected
        caMauSoilColors.put("#fcd0fc", "Đất phèn tiềm tàng sâu dưới rừng ngập mặn");

        // === ĐẤT PHÈN TIỀM TÀNG SÂU, MẶN NHIỀU - Blue-Purple #a4c1fd ===
        // Note: #a0c0fc is actually rivers, NOT this soil type
        caMauSoilColors.put("#a4c1fd", "Đất phèn tiềm tàng sâu, mặn nhiều"); // OpenCV exact: RGB(164,193,253)
        caMauSoilColors.put("#a3c0f7", "Đất phèn tiềm tàng sâu, mặn nhiều"); // K-means detected
        caMauSoilColors.put("#98b8f8", "Đất phèn tiềm tàng sâu, mặn nhiều"); // Darker blue-purple

        // === ĐẤT PHÈN TIỀM TÀNG SÂU, MẶN TRUNG BÌNH - Bright Magenta #ff73fa ===
        caMauSoilColors.put("#ff73fa", "Đất phèn tiềm tàng sâu, mặn trung bình"); // OpenCV exact: RGB(255,115,250)
        caMauSoilColors.put("#fc70f8", "Đất phèn tiềm tàng sâu, mặn trung bình");
        caMauSoilColors.put("#ff78fc", "Đất phèn tiềm tàng sâu, mặn trung bình");

        // === ĐẤT PHÈN TIỀM TÀNG SÂU, MẶN ÍT - Light Magenta #fea4fb ===
        caMauSoilColors.put("#fea4fb", "Đất phèn tiềm tàng sâu, mặn ít"); // OpenCV exact: RGB(254,164,251)
        caMauSoilColors.put("#fbabf8", "Đất phèn tiềm tàng sâu, mặn ít"); // K-means: 14.7%
        caMauSoilColors.put("#fca8f8", "Đất phèn tiềm tàng sâu, mặn ít");

        // === ĐẤT PHÈN HOẠT ĐỘNG NÔNG, MẶN NHIỀU - Light Pink-Magenta #feb3f8 ===
        caMauSoilColors.put("#feb3f8", "Đất phèn hoạt động nông, mặn nhiều"); // OpenCV exact: RGB(254,179,248)
        caMauSoilColors.put("#fcb0f8", "Đất phèn hoạt động nông, mặn nhiều");
        caMauSoilColors.put("#fbb4fa", "Đất phèn hoạt động nông, mặn nhiều");

        // === ĐẤT PHÈN HOẠT ĐỘNG NÔNG, MẶN TRUNG BÌNH - Hot Pink #ff65ae ===
        caMauSoilColors.put("#ff65ae", "Đất phèn hoạt động nông, mặn trung bình"); // OpenCV exact: RGB(255,101,174)
        caMauSoilColors.put("#f75daa", "Đất phèn hoạt động nông, mặn trung bình"); // K-means: 7.2%
        caMauSoilColors.put("#fc60a8", "Đất phèn hoạt động nông, mặn trung bình");

        // === ĐẤT PHÈN HOẠT ĐỘNG NÔNG, MẶN ÍT - Light Violet #c1c3fe ===
        caMauSoilColors.put("#c1c3fe", "Đất phèn hoạt động nông, mặn ít"); // OpenCV exact: RGB(193,195,254)
        caMauSoilColors.put("#c0c0fc", "Đất phèn hoạt động nông, mặn ít");
        caMauSoilColors.put("#c4c4fc", "Đất phèn hoạt động nông, mặn ít");

        // === ĐẤT PHÈN HOẠT ĐỘNG SÂU, MẶN NHIỀU - Light Pink #fbb4fa ===
        caMauSoilColors.put("#fbb4fa", "Đất phèn hoạt động sâu, mặn nhiều"); // OpenCV exact: RGB(251,180,250)
        caMauSoilColors.put("#f8b0f8", "Đất phèn hoạt động sâu, mặn nhiều");

        // === ĐẤT PHÈN HOẠT ĐỘNG SÂU, MẶN TRUNG BÌNH - Deep Pink #fc54a9 ===
        caMauSoilColors.put("#fc54a9", "Đất phèn hoạt động sâu, mặn trung bình"); // OpenCV exact: RGB(252,84,169)
        caMauSoilColors.put("#f850a8", "Đất phèn hoạt động sâu, mặn trung bình");
        caMauSoilColors.put("#ff58b0", "Đất phèn hoạt động sâu, mặn trung bình");

        // === ĐẤT PHÈN HOẠT ĐỘNG SÂU, MẶN ÍT - Purple-Blue #9292f2 ===
        caMauSoilColors.put("#9292f2", "Đất phèn hoạt động sâu, mặn ít"); // OpenCV exact: RGB(146,146,242)
        caMauSoilColors.put("#9191f3", "Đất phèn hoạt động sâu, mặn ít"); // K-means: 3.9%
        caMauSoilColors.put("#9090f0", "Đất phèn hoạt động sâu, mặn ít");

        // === ĐẤT THAN BÙN PHÈN MẶN - Dark Purple #27034b ===
        caMauSoilColors.put("#27034b", "Đất than bùn phèn mặn"); // OpenCV exact: RGB(39,3,75)
        caMauSoilColors.put("#25024a", "Đất than bùn phèn mặn"); // K-means: 3.4%
        caMauSoilColors.put("#2a0850", "Đất than bùn phèn mặn");
        caMauSoilColors.put("#300860", "Đất than bùn phèn mặn");
        caMauSoilColors.put("#1a1424", "Đất than bùn phèn mặn"); // K-means: 1.4%

        // === ĐẤT VÀNG ĐỎ trên đá Macma axit - Near White #fdf8f4 ===
        caMauSoilColors.put("#fdf8f4", "Đất vàng đỏ trên đá Macma axit"); // OpenCV exact: RGB(253,248,244)
        caMauSoilColors.put("#f9f8e7", "Đất vàng đỏ trên đá Macma axit"); // K-means: 1.7%
        caMauSoilColors.put("#faf6ca", "Đất vàng đỏ trên đá Macma axit"); // K-means: 0.6%
        caMauSoilColors.put("#f9b9a5", "Đất vàng đỏ trên đá Macma axit"); // K-means: 4.0% (salmon tone)

        // === SÔNG, SUỐI, AO HỒ - Light Blue Lavender (actual map colors) ===
        // Note: Actual map uses lavender blue, NOT pure cyan due to JPEG compression
        caMauSoilColors.put("#a0c0fc", "Sông, suối, ao hồ"); // Actual dominant - 0.8%
        caMauSoilColors.put("#a4c0fc", "Sông, suối, ao hồ"); // Actual - 0.5%
        caMauSoilColors.put("#9cc0fc", "Sông, suối, ao hồ"); // Variant
        caMauSoilColors.put("#a0bcfc", "Sông, suối, ao hồ"); // Variant
        caMauSoilColors.put("#a4c4fc", "Sông, suối, ao hồ"); // Variant
        caMauSoilColors.put("#a4bcfc", "Sông, suối, ao hồ"); // Variant
        caMauSoilColors.put("#a8c4fc", "Sông, suối, ao hồ"); // Variant
        caMauSoilColors.put("#9cbcfc", "Sông, suối, ao hồ"); // Variant
        caMauSoilColors.put("#a0c0f8", "Sông, suối, ao hồ"); // Variant
        // Legacy cyan colors (in case of different map versions)
        caMauSoilColors.put("#50fcfe", "Sông, suối, ao hồ"); // Pure cyan (legend)
        caMauSoilColors.put("#54fbfc", "Sông, suối, ao hồ");
        caMauSoilColors.put("#48f8fc", "Sông, suối, ao hồ");
        caMauSoilColors.put("#00ffff", "Sông, suối, ao hồ");

        // === BÃI BỒI VEN SÔNG, VEN BIỂN - Very Light Cyan/White ===
        caMauSoilColors.put("#f0fcfc", "Bãi bồi ven sông, ven biển"); // Actual - 0.1%
        caMauSoilColors.put("#ecfcfc", "Bãi bồi ven sông, ven biển"); // Actual - 0.1%
        caMauSoilColors.put("#e8fcfc", "Bãi bồi ven sông, ven biển"); // Variant
        caMauSoilColors.put("#f4fdfc", "Bãi bồi ven sông, ven biển"); // OpenCV exact
        caMauSoilColors.put("#defafd", "Bãi bồi ven sông, ven biển");

        // === KÝ HIỆU RỪNG/CÂY XANH - Bright Green (map symbols) ===
        caMauSoilColors.put("#04f400", "Ký hiệu rừng/cây xanh"); // Actual - 0.15%
        caMauSoilColors.put("#04f000", "Ký hiệu rừng/cây xanh"); // Actual - 0.12%
        caMauSoilColors.put("#00ff00", "Ký hiệu rừng/cây xanh");
        caMauSoilColors.put("#00f400", "Ký hiệu rừng/cây xanh");
        caMauSoilColors.put("#08f000", "Ký hiệu rừng/cây xanh");
        caMauSoilColors.put("#00f000", "Ký hiệu rừng/cây xanh");

        // === ĐẤT THAN BÙN PHÈN MẶN - Additional colors from actual analysis ===
        caMauSoilColors.put("#28004c", "Đất than bùn phèn mặn"); // Actual - 0.6%
        caMauSoilColors.put("#280050", "Đất than bùn phèn mặn"); // Actual - 0.4%
        caMauSoilColors.put("#2c0050", "Đất than bùn phèn mặn"); // Actual - 0.1%
        caMauSoilColors.put("#2c004c", "Đất than bùn phèn mặn"); // Actual - 0.1%
        caMauSoilColors.put("#24004c", "Đất than bùn phèn mặn"); // Actual - 0.1%
        caMauSoilColors.put("#240048", "Đất than bùn phèn mặn"); // Actual - 0.1%

        KNOWN_COLOR_MAPPINGS.put("ca_mau_tho_nhuong", caMauSoilColors);
        KNOWN_COLOR_MAPPINGS.put("cà_mau_thổ_nhưỡng", caMauSoilColors);

        // ==================== CÀ MAU QUY HOẠCH ====================
        Map<String, Object> caMauPlanningCoords = new HashMap<>();
        caMauPlanningCoords.put("sw", Map.of("lat", 8.58, "lng", 104.75));
        caMauPlanningCoords.put("ne", Map.of("lat", 9.58, "lng", 105.25));
        caMauPlanningCoords.put("center", Map.of("lat", 9.08, "lng", 105.0));
        caMauPlanningCoords.put("scale", "1:100000");
        caMauPlanningCoords.put("province", "Cà Mau");
        KNOWN_MAP_COORDINATES.put("ca_mau_quy_hoach", caMauPlanningCoords);
        KNOWN_MAP_COORDINATES.put("cà_mau_quy_hoạch", caMauPlanningCoords);
    }

    /**
     * Callback interface for progress updates with detailed error info
     */
    public interface ProgressCallback {
        void onProgress(String step, String status, String message);

        default void onProgress(String step, String status, String message, Map<String, Object> details) {
            onProgress(step, status, message);
        }
    }

    /**
     * Backwards-compatible method - defaults to soil map analysis
     */
    public Map<String, Object> analyzeMapImage(File imageFile, String province, String district,
            ProgressCallback callback) {
        return analyzeMapImage(imageFile, province, district, MAP_TYPE_SOIL, callback);
    }

    /**
     * Main orchestration method - HYBRID: Gemini + OpenCV + GPT-4o
     * Hỗ trợ 2 loại bản đồ: soil (Thổ nhưỡng) và planning (Quy hoạch)
     * 
     * Flow:
     * 1. Gemini 1.5 Pro: Extract coordinates (fallback: GPT-4o)
     * 2. OpenCV: Extract polygons and legend image
     * 3. GPT-4o: Read legend and map zone types
     * 
     * @param imageFile File ảnh bản đồ
     * @param province  Tên tỉnh
     * @param district  Tên huyện
     * @param mapType   Loại bản đồ: "soil" (Thổ nhưỡng) hoặc "planning" (Quy hoạch)
     * @param callback  Callback để cập nhật tiến trình
     */
    public Map<String, Object> analyzeMapImage(File imageFile, String province, String district,
            String mapType, ProgressCallback callback) {

        // Validate mapType - default to soil if not specified
        if (mapType == null || mapType.isEmpty()) {
            mapType = MAP_TYPE_SOIL;
        }
        boolean isPlanningMap = MAP_TYPE_PLANNING.equalsIgnoreCase(mapType);

        String mapTypeLabel = isPlanningMap ? "QUY HOẠCH" : "THỔ NHƯỠNG";
        logger.info("=== HYBRID AI ANALYSIS START ({}) ===", mapTypeLabel);
        logger.info("Image: {}, Province: {}, District: {}, MapType: {}",
                imageFile.getName(), province, district, mapType);

        Map<String, Object> result = new LinkedHashMap<>();
        List<Map<String, Object>> logs = new ArrayList<>();
        Map<String, Object> aiUsage = new LinkedHashMap<>(); // Track which AI was used

        // Store map type in result
        result.put("mapType", mapType);
        result.put("mapTypeLabel", mapTypeLabel);

        try {
            // ╔═══════════════════════════════════════════════════════════════╗
            // ║ BƯỚC 1: TRÍCH XUẤT TỌA ĐỘ (KNOWN DATA → GEMINI → GPT-4o) ║
            // ╚═══════════════════════════════════════════════════════════════╝
            callback.onProgress("step1_coords", "running", "Bước 1: Đang phân tích tọa độ bản đồ...");

            Map<String, Object> coordinatesResult = null;
            String coordsProvider = "none";

            // Priority 1: Check for known map coordinates first (most reliable)
            Map<String, Object> knownCoords = getKnownCoordinates(imageFile.getName());
            if (knownCoords != null) {
                coordinatesResult = new HashMap<>(knownCoords);
                coordsProvider = "known_data";
                addLog(logs, "System", "SUCCESS", "Sử dụng tọa độ đã biết cho bản đồ: " + province);
                callback.onProgress("step1_coords", "completed", "✓ Sử dụng tọa độ chuẩn cho " + province);
                logger.info("Using known coordinates for: {}", imageFile.getName());
            }

            // Priority 2: Try Gemini (better for OCR/coordinate reading)
            if (coordinatesResult == null && geminiVisionService.isConfigured()) {
                callback.onProgress("gemini", "running",
                        "Đang dùng Gemini " + geminiVisionService.getModelName() + " đọc tọa độ...");
                addLog(logs, "Gemini", "START",
                        "Bắt đầu phân tích tọa độ với Gemini " + geminiVisionService.getModelName());

                GeminiResult geminiResult = geminiVisionService.analyzeCoordinates(imageFile);

                if (geminiResult.isSuccess()) {
                    coordinatesResult = geminiResult.getData();
                    coordsProvider = "gemini";
                    addLog(logs, "Gemini", "SUCCESS", "Đã trích xuất tọa độ: " + coordinatesResult.get("center"));
                    callback.onProgress("gemini", "completed", "✓ Gemini: Đã trích xuất tọa độ thành công");
                    geminiLogger.info("Coordinate extraction successful via Gemini");
                } else {
                    // Gemini failed - log detailed error
                    String errorIcon = getErrorIcon(geminiResult.getErrorType());

                    addLog(logs, "Gemini", "ERROR", errorIcon + " " + geminiResult.getErrorMessage());
                    callback.onProgress("gemini", "error",
                            errorIcon + " Gemini lỗi: " + geminiResult.getErrorMessage(),
                            Map.of("errorType", geminiResult.getErrorType().name(),
                                    "details",
                                    geminiResult.getErrorDetails() != null ? geminiResult.getErrorDetails() : ""));

                    geminiLogger.warn("Gemini failed: {} - {}", geminiResult.getErrorType(),
                            geminiResult.getErrorMessage());

                    // Decide whether to fallback
                    if (geminiResult.shouldFallback()) {
                        addLog(logs, "System", "INFO", "🔄 Chuyển sang GPT-4o (fallback)...");
                        callback.onProgress("fallback", "running", "🔄 Đang chuyển sang GPT-4o...");
                    }
                }
            } else if (coordinatesResult == null) {
                addLog(logs, "Gemini", "SKIP", "Gemini không được cấu hình, sử dụng GPT-4o");
                callback.onProgress("gemini", "skipped", "Gemini chưa cấu hình, dùng GPT-4o");
            }

            // Fallback to GPT-4o if Gemini failed or not configured
            if (coordinatesResult == null) {
                callback.onProgress("gpt4o_coords", "running", "Đang dùng GPT-4o đọc tọa độ (fallback)...");
                addLog(logs, "GPT-4o", "START", "Bắt đầu phân tích tọa độ (fallback)");

                coordinatesResult = analyzeCoordinatesWithGPT4o(imageFile);

                if (coordinatesResult != null && !coordinatesResult.isEmpty()) {
                    coordsProvider = "gpt4o";
                    addLog(logs, "GPT-4o", "SUCCESS", "Đã trích xuất tọa độ: " + coordinatesResult.get("center"));
                    callback.onProgress("gpt4o_coords", "completed", "✓ GPT-4o: Đã trích xuất tọa độ");
                    gpt4oLogger.info("Coordinate extraction successful via GPT-4o (fallback)");
                } else {
                    addLog(logs, "GPT-4o", "WARNING", "Không thể trích xuất tọa độ chính xác");
                    callback.onProgress("gpt4o_coords", "warning", "⚠️ Không tìm thấy tọa độ rõ ràng");
                }
            }

            // Save coordinate provider info
            aiUsage.put("coordinates", coordsProvider);
            if (coordinatesResult != null) {
                result.put("coordinates", coordinatesResult);
            }

            callback.onProgress("step1_coords", "completed",
                    String.format("Bước 1 hoàn thành (%s)", coordsProvider.toUpperCase()));

            // ╔═══════════════════════════════════════════════════════════════╗
            // ║ BƯỚC 2: TRÍCH XUẤT POLYGON VÀ LEGEND (OPENCV) ║
            // ╚═══════════════════════════════════════════════════════════════╝
            // Note: Image Overlay mode was disabled because it returns only 1 zone
            // Use Polygon mode for all maps to extract multiple zones
            boolean useImageOverlay = false; // Disabled - Polygon mode extracts 82+ zones correctly
            callback.onProgress("step2_opencv", "running", "Bước 2: Đang trích xuất vùng màu và polygon...");
            addLog(logs, "OpenCV", "START", "Bắt đầu trích xuất polygon bằng OpenCV");

            Map<String, Object> opencvResult = extractPolygonsWithOpenCV(imageFile, coordinatesResult, useImageOverlay);

            List<Map<String, Object>> zones = new ArrayList<>();
            List<Map<String, Object>> colorSummary = new ArrayList<>();

            if (opencvResult != null && opencvResult.containsKey("zones")) {
                Object zonesObj = opencvResult.get("zones");
                if (zonesObj instanceof List) {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> castedZones = (List<Map<String, Object>>) zonesObj;
                    zones = castedZones;
                }

                Object colorsObj = opencvResult.get("colorSummary");
                if (colorsObj instanceof List) {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> castedColors = (List<Map<String, Object>>) colorsObj;
                    colorSummary = castedColors;
                }

                result.put("zones", zones);
                result.put("colorSummary", colorSummary);

                // Extract image processing info (Smart Resize)
                @SuppressWarnings("unchecked")
                Map<String, Object> originalSize = (Map<String, Object>) opencvResult.get("originalSize");
                @SuppressWarnings("unchecked")
                Map<String, Object> resizeInfo = (Map<String, Object>) opencvResult.get("resizeInfo");
                @SuppressWarnings("unchecked")
                Map<String, Object> processedSize = (Map<String, Object>) opencvResult.get("imageSize");

                if (originalSize != null) {
                    result.put("originalSize", originalSize);
                }
                if (resizeInfo != null) {
                    result.put("resizeInfo", resizeInfo);
                    Boolean wasResized = (Boolean) resizeInfo.get("resized");
                    if (wasResized != null && wasResized) {
                        addLog(logs, "OpenCV", "INFO",
                                String.format("Đã resize ảnh: %sx%s → %sx%s",
                                        originalSize != null ? originalSize.get("width") : "?",
                                        originalSize != null ? originalSize.get("height") : "?",
                                        processedSize != null ? processedSize.get("width") : "?",
                                        processedSize != null ? processedSize.get("height") : "?"));
                    }
                }
                if (processedSize != null) {
                    result.put("processedSize", processedSize);
                }

                addLog(logs, "OpenCV", "SUCCESS",
                        "Đã trích xuất " + zones.size() + " vùng polygon (tối đa 20 điểm/zone)");
                callback.onProgress("step2_opencv", "completed",
                        String.format("Bước 2 hoàn thành: %d vùng đất", zones.size()));
            } else {
                addLog(logs, "OpenCV", "WARNING", "Không trích xuất được polygon");
                callback.onProgress("step2_opencv", "warning", "⚠️ Không trích xuất được polygon");
            }

            // Extract legend info from OpenCV result
            @SuppressWarnings("unchecked")
            Map<String, Object> legendInfo = opencvResult != null ? (Map<String, Object>) opencvResult.get("legend")
                    : null;

            if (legendInfo != null && legendInfo.get("base64") != null) {
                addLog(logs, "OpenCV", "SUCCESS", "Đã tách ảnh legend tại: " + legendInfo.get("position"));
                callback.onProgress("legend", "completed", "✓ Đã trích xuất bảng chú giải");
            }

            aiUsage.put("polygons", "opencv");

            // ╔═══════════════════════════════════════════════════════════════╗
            // ║ BƯỚC 3: GÁN NHÃN LOẠI ĐẤT (KNOWN DATA → GPT-4o) ║
            // ╚═══════════════════════════════════════════════════════════════╝
            String step3Label = isPlanningMap ? "loại đất quy hoạch" : "loại đất thổ nhưỡng";
            callback.onProgress("step3_labels", "running",
                    "Bước 3: Đang phân loại " + step3Label + " từ chú giải...");

            Map<String, Object> colorMapping = null;
            String labelProvider = "none";

            // Priority 1: Check for known color mappings first (most accurate for Cà Mau
            // Thổ Nhưỡng)
            Map<String, String> knownColors = getKnownColorMappings(imageFile.getName());
            if (knownColors != null && !knownColors.isEmpty()) {
                addLog(logs, "System", "SUCCESS", "Sử dụng bảng màu đã biết cho: " + province);

                // Build colorToSoil mapping from known colors
                Map<String, String> colorToSoilFromKnown = new HashMap<>();
                String dominantTypeFromKnown = null;
                int maxCount = 0;
                Map<String, Integer> typeCount = new HashMap<>();

                for (Map<String, Object> colorInfo : colorSummary) {
                    String hexColor = (String) colorInfo.get("hex");
                    if (hexColor == null)
                        hexColor = (String) colorInfo.get("color");
                    if (hexColor == null)
                        continue;

                    String soilType = matchColorToKnownMapping(hexColor, knownColors);
                    if (soilType != null) {
                        colorToSoilFromKnown.put(hexColor, soilType);
                        int count = typeCount.getOrDefault(soilType, 0) + 1;
                        typeCount.put(soilType, count);
                        if (count > maxCount) {
                            maxCount = count;
                            dominantTypeFromKnown = soilType;
                        }
                    }
                }

                if (!colorToSoilFromKnown.isEmpty()) {
                    colorMapping = new HashMap<>();
                    colorMapping.put("colorToSoil", colorToSoilFromKnown);
                    colorMapping.put("dominantType", dominantTypeFromKnown);
                    labelProvider = "known_data";
                    callback.onProgress("step3_labels", "completed",
                            "✓ Sử dụng bảng màu chuẩn: " + colorToSoilFromKnown.size() + " màu");
                    logger.info("Using known color mappings: {} colors matched", colorToSoilFromKnown.size());
                }
            }

            // Priority 2: Use GPT-4o if no known mappings available
            if (colorMapping == null) {
                addLog(logs, "GPT-4o", "START", "Bắt đầu phân loại màu sắc bằng GPT-4o (mode: " + mapType + ")");
                colorMapping = labelColorsWithGPT4o(imageFile, colorSummary, province, legendInfo, mapType);
                if (colorMapping != null && !colorMapping.isEmpty()) {
                    labelProvider = "gpt4o";
                }
            }

            if (colorMapping != null && !colorMapping.isEmpty()) {
                result.put("colorMapping", colorMapping);

                // Apply labels to zones
                @SuppressWarnings("unchecked")
                Map<String, String> colorToSoil = (Map<String, String>) colorMapping.getOrDefault("colorToSoil",
                        new HashMap<>());
                String dominantType = (String) colorMapping.get("dominantType");

                // POST-PROCESSING: Map AI names to DB codes - based on mapType
                int mappedCount = 0;
                int unmappedCount = 0;
                Map<String, String> colorToCode = new HashMap<>();

                for (Map<String, Object> zone : zones) {
                    String color = (String) zone.getOrDefault("fillColor", zone.get("color"));
                    if (color != null && colorToSoil.containsKey(color)) {
                        String aiZoneName = colorToSoil.get(color);

                        if (isPlanningMap) {
                            // === PLANNING MAP: Use PlanningZoneTypeMappingService ===
                            String dbCode = planningZoneTypeMappingService.mapAiNameToCode(aiZoneName);

                            if (dbCode != null) {
                                Optional<PlanningZoneType> zoneTypeOpt = planningZoneTypeMappingService
                                        .getZoneTypeByCode(dbCode);
                                if (zoneTypeOpt.isPresent()) {
                                    PlanningZoneType zoneType = zoneTypeOpt.get();
                                    zone.put("zoneCode", zoneType.getCode());
                                    zone.put("zoneType", zoneType.getName());
                                    zone.put("landUsePurpose", zoneType.getName());
                                    zone.put("planningCategory", zoneType.getCategory());
                                    zone.put("description", zoneType.getDescription());
                                    zone.put("icon", zoneType.getIcon());
                                    zone.put("defaultColor", zoneType.getDefaultColor());
                                    colorToCode.put(color, dbCode);
                                    mappedCount++;
                                }
                            } else {
                                // P1 FIX: Safe AI_* code generation
                                String generatedCode = "AI_" + sanitizeColorCode(color);
                                zone.put("zoneCode", generatedCode);
                                zone.put("zoneType", aiZoneName);
                                zone.put("landUsePurpose", aiZoneName);
                                unmappedCount++;
                            }
                        } else {
                            // === SOIL MAP: Use SoilTypeMappingService ===
                            String dbCode = soilTypeMappingService.mapAiNameToCode(aiZoneName);

                            if (dbCode != null) {
                                Optional<SoilType> soilTypeOpt = soilTypeMappingService.getSoilTypeByCode(dbCode);
                                if (soilTypeOpt.isPresent()) {
                                    SoilType soilType = soilTypeOpt.get();
                                    zone.put("zoneCode", soilType.getCode());
                                    zone.put("zoneType", soilType.getName());
                                    zone.put("landUsePurpose", soilType.getName());
                                    zone.put("soilCategory", soilType.getCategory());
                                    zone.put("phRange", soilType.getPhRange());
                                    zone.put("fertility", soilType.getFertility());
                                    zone.put("suitableCrops", soilType.getSuitableCrops());
                                    zone.put("limitations", soilType.getLimitations());
                                    zone.put("icon", soilType.getIcon());
                                    zone.put("defaultColor", soilType.getDefaultColor());
                                    colorToCode.put(color, dbCode);
                                    mappedCount++;
                                }
                            } else {
                                // P1 FIX: Safe AI_* code generation
                                String generatedCode = "AI_" + sanitizeColorCode(color);
                                zone.put("zoneCode", generatedCode);
                                zone.put("zoneType", aiZoneName);
                                zone.put("landUsePurpose", aiZoneName);
                                unmappedCount++;
                            }
                        }
                    }
                }

                result.put("colorToCode", colorToCode);
                result.put("dominantType", dominantType);

                if (dominantType != null) {
                    String dominantCode = isPlanningMap
                            ? planningZoneTypeMappingService.mapAiNameToCode(dominantType)
                            : soilTypeMappingService.mapAiNameToCode(dominantType);
                    if (dominantCode != null) {
                        result.put("dominantCode", dominantCode);
                    }
                }

                String providerLabel = "known_data".equals(labelProvider) ? "Bảng màu chuẩn" : "GPT-4o";
                addLog(logs, providerLabel, "SUCCESS",
                        String.format("Đã gán nhãn %d màu. Mapped: %d, Unmapped: %d",
                                colorToSoil.size(), mappedCount, unmappedCount));
                callback.onProgress("step3_labels", "completed",
                        String.format("Bước 3 hoàn thành (%s): %d/%d %s đã liên kết DB",
                                labelProvider.toUpperCase(), mappedCount,
                                colorToSoil.size(), isPlanningMap ? "loại quy hoạch" : "loại đất"));
            } else {
                addLog(logs, "System", "WARNING", "Không thể đọc chú giải");
                callback.onProgress("step3_labels", "warning", "⚠️ Không thể đọc chú giải");
            }

            aiUsage.put("labeling", labelProvider);

            // Final summary
            result.put("logs", logs);
            result.put("aiUsage", aiUsage);
            result.put("province", province);
            result.put("district", district);
            result.put("originalImage", imageFile.getAbsolutePath());
            result.put("analysisTime", System.currentTimeMillis());
            result.put("success", true);
            result.put("hybridMode", true);

            logger.info("=== HYBRID AI ORCHESTRATION COMPLETE ===");
            logger.info("AI Usage: {}", aiUsage);
            logger.info("Total zones detected: {}",
                    ((List<?>) result.getOrDefault("zones", Collections.emptyList())).size());

        } catch (Exception e) {
            logger.error("Hybrid AI orchestration failed: {}", e.getMessage(), e);
            result.put("success", false);
            result.put("error", e.getMessage());
            result.put("logs", logs);
            addLog(logs, "System", "ERROR", "Lỗi hệ thống: " + e.getMessage());
            callback.onProgress("error", "failed", "❌ Lỗi: " + e.getMessage());
        }

        return result;
    }

    /**
     * Get error icon based on error type
     */
    private String getErrorIcon(GeminiErrorType errorType) {
        return switch (errorType) {
            case QUOTA_EXCEEDED -> "⏱️ Hết quota";
            case INVALID_API_KEY -> "🔑 API key lỗi";
            case TIMEOUT -> "⌛ Timeout";
            case NETWORK_ERROR -> "🌐 Lỗi mạng";
            case CONTENT_FILTERED -> "🚫 Bị chặn";
            case MODEL_NOT_FOUND -> "❓ Model không tồn tại";
            case PARSE_ERROR -> "📄 Lỗi parse";
            default -> "❌ Lỗi";
        };
    }

    /**
     * Step 1: Use GPT-4o (GitHub Models) to analyze map coordinates
     * Replaces Gemini
     */
    private Map<String, Object> analyzeCoordinatesWithGPT4o(File imageFile) {
        gpt4oLogger.info("Starting coordinate analysis for: {}", imageFile.getName());

        // First check if we have known coordinates for this map
        Map<String, Object> knownCoords = getKnownCoordinates(imageFile.getName());
        if (knownCoords != null) {
            gpt4oLogger.info("Using known coordinates for: {}", imageFile.getName());
            return new HashMap<>(knownCoords);
        }

        if (githubToken == null || githubToken.isEmpty()) {
            gpt4oLogger.warn("GitHub token not configured");
            return null;
        }

        try {
            byte[] imageBytes = Files.readAllBytes(imageFile.toPath());
            String base64Image = Base64.getEncoder().encodeToString(imageBytes);
            String mimeType = getMimeType(imageFile);

            gpt4oLogger.debug("Image encoded, size: {} bytes", imageBytes.length);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(Objects.requireNonNull(githubToken));

            ObjectNode requestBody = objectMapper.createObjectNode();
            requestBody.put("model", githubModel);
            requestBody.put("max_tokens", 1024);
            requestBody.put("temperature", 0.1);

            ArrayNode messages = requestBody.putArray("messages");

            ObjectNode systemMsg = messages.addObject();
            systemMsg.put("role", "system");
            systemMsg.put("content", "You are a GIS expert. Extract coordinates from map images. Return only JSON.");

            ObjectNode userMsg = messages.addObject();
            userMsg.put("role", "user");
            ArrayNode content = userMsg.putArray("content");

            ObjectNode textPart = content.addObject();
            textPart.put("type", "text");
            textPart.put("text", """
                    Analyze this map image. Find geographic coordinates (lat/long) for the 4 corners or the center.
                    Also identify scale and province/district name.

                    Return valid JSON only (no markdown):
                    {
                      "sw": {"lat": 10.123, "lng": 105.123},
                      "ne": {"lat": 10.456, "lng": 105.456},
                      "center": {"lat": 10.289, "lng": 105.289},
                      "scale": "1:25000",
                      "province": "Ten Tinh",
                      "district": "Ten Huyen"
                    }

                    If specific corners are not found, approximate based on location name.
                    """);

            ObjectNode imagePart = content.addObject();
            imagePart.put("type", "image_url");
            ObjectNode imageUrl = imagePart.putObject("image_url");
            imageUrl.put("url", "data:" + mimeType + ";base64," + base64Image);
            imageUrl.put("detail", "high"); // Need high detail for coordinates

            HttpEntity<String> entity = new HttpEntity<>(requestBody.toString(), headers);

            gpt4oLogger.info("Calling GPT-4o for coordinates...");
            ResponseEntity<String> response = restTemplate.exchange(
                    Objects.requireNonNull(GITHUB_API_URL), Objects.requireNonNull(HttpMethod.POST), entity,
                    String.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                JsonNode responseJson = objectMapper.readTree(response.getBody());
                String text = responseJson.path("choices").path(0)
                        .path("message").path("content").asText();

                gpt4oLogger.debug("GPT-4o response: {}", text);

                String jsonStr = extractJsonFromText(text);
                if (jsonStr != null) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> coords = objectMapper.readValue(jsonStr, Map.class);
                    // Ensure format matches what Python expects (sw, ne)
                    // If GPT returned topLeft/bottomRight, perform conversion if needed
                    // But prompt asked for sw/ne
                    return coords;
                }
            }
            return null;

        } catch (Exception e) {
            gpt4oLogger.error("Coordinate analysis failed: {}", e.getMessage(), e);
            return null;
        }
    }

    /**
     * Get known coordinates for map files based on filename
     */
    private Map<String, Object> getKnownCoordinates(String filename) {
        if (filename == null)
            return null;

        // Normalize filename for matching
        String normalized = filename.toLowerCase()
                .replace(" ", "_")
                .replace("-", "_")
                .replaceAll("\\.(jpeg|jpg|png)$", "");

        // Try to match with known coordinates
        for (Map.Entry<String, Map<String, Object>> entry : KNOWN_MAP_COORDINATES.entrySet()) {
            if (normalized.contains(entry.getKey().toLowerCase().replace(" ", "_"))) {
                logger.info("Found known coordinates for: {} -> {}", filename, entry.getKey());
                return entry.getValue();
            }
        }

        // Check for Cà Mau in filename
        if (normalized.contains("ca_mau") || normalized.contains("cà_mau") || normalized.contains("camau")) {
            if (normalized.contains("tho_nhuong") || normalized.contains("thổ_nhưỡng") || normalized.contains("soil")) {
                return KNOWN_MAP_COORDINATES.get("ca_mau_tho_nhuong");
            }
            if (normalized.contains("quy_hoach") || normalized.contains("quy_hoạch")
                    || normalized.contains("planning")) {
                return KNOWN_MAP_COORDINATES.get("ca_mau_quy_hoach");
            }
            // Default to soil map for Ca Mau
            return KNOWN_MAP_COORDINATES.get("ca_mau_tho_nhuong");
        }

        return null;
    }

    /**
     * Get known color mappings for map files based on filename (for Bước 2)
     * Returns Map of hex color -> soil type name
     */
    private Map<String, String> getKnownColorMappings(String filename) {
        if (filename == null)
            return null;

        // Normalize filename for matching
        String normalized = filename.toLowerCase()
                .replace(" ", "_")
                .replace("-", "_")
                .replaceAll("\\.(jpeg|jpg|png)$", "");

        // Try to match with known color mappings
        for (Map.Entry<String, Map<String, String>> entry : KNOWN_COLOR_MAPPINGS.entrySet()) {
            if (normalized.contains(entry.getKey().toLowerCase().replace(" ", "_"))) {
                logger.info("Found known color mappings for: {} -> {} colors", filename, entry.getValue().size());
                return entry.getValue();
            }
        }

        // Check for Cà Mau Thổ Nhưỡng in filename
        if ((normalized.contains("ca_mau") || normalized.contains("cà_mau") || normalized.contains("camau")) &&
                (normalized.contains("tho_nhuong") || normalized.contains("thổ_nhưỡng")
                        || normalized.contains("soil"))) {
            return KNOWN_COLOR_MAPPINGS.get("ca_mau_tho_nhuong");
        }

        return null;
    }

    /**
     * Match a detected color to known color mappings using color distance
     * Returns the closest matching soil type name, or null if no close match
     */
    private String matchColorToKnownMapping(String hexColor, Map<String, String> knownMappings) {
        if (hexColor == null || knownMappings == null)
            return null;

        // Exact match first
        String exactMatch = knownMappings.get(hexColor.toLowerCase());
        if (exactMatch != null)
            return exactMatch;

        // Convert hex to RGB for distance calculation
        int[] targetRgb = hexToRgb(hexColor);
        if (targetRgb == null)
            return null;

        String bestMatch = null;
        double minDistance = Double.MAX_VALUE;
        double threshold = 60.0; // Maximum color distance to accept as match

        for (Map.Entry<String, String> entry : knownMappings.entrySet()) {
            int[] knownRgb = hexToRgb(entry.getKey());
            if (knownRgb == null)
                continue;

            // Calculate Euclidean distance in RGB space
            double distance = Math.sqrt(
                    Math.pow(targetRgb[0] - knownRgb[0], 2) +
                            Math.pow(targetRgb[1] - knownRgb[1], 2) +
                            Math.pow(targetRgb[2] - knownRgb[2], 2));

            if (distance < minDistance && distance < threshold) {
                minDistance = distance;
                bestMatch = entry.getValue();
            }
        }

        if (bestMatch != null) {
            logger.debug("Matched color {} to '{}' (distance: {:.1f})", hexColor, bestMatch, minDistance);
        }

        return bestMatch;
    }

    /**
     * Convert hex color to RGB array
     */
    private int[] hexToRgb(String hex) {
        if (hex == null)
            return null;
        hex = hex.replace("#", "");
        if (hex.length() != 6)
            return null;

        try {
            return new int[] {
                    Integer.parseInt(hex.substring(0, 2), 16),
                    Integer.parseInt(hex.substring(2, 4), 16),
                    Integer.parseInt(hex.substring(4, 6), 16)
            };
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * Step 2 (NEW): Extract polygons using Python/OpenCV
     * Returns zones with polygon coordinates extracted by color segmentation
     * 
     * @param imageFile       Image file to process
     * @param geoBounds       Geographic bounds for coordinate transformation
     * @param useImageOverlay If true, creates an image overlay instead of
     *                        extracting polygons (better for soil maps)
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> extractPolygonsWithOpenCV(File imageFile, Map<String, Object> geoBounds,
            boolean useImageOverlay) {
        opencvLogger.info("[HYBRID] Starting {} for: {}",
                useImageOverlay ? "image overlay creation" : "polygon extraction", imageFile.getName());

        Path tempDir = null;
        try {
            // Create output JSON path
            tempDir = Files.createTempDirectory("map_polygons_");
            File outputJson = new File(tempDir.toFile(), "polygons.json");

            // Find Python script - try multiple paths
            String scriptPath = findPythonScript("map_polygon_extractor.py");
            if (scriptPath == null) {
                opencvLogger.error("Cannot find map_polygon_extractor.py script!");
                return null;
            }
            opencvLogger.info("[DEBUG] Using script path: {}", scriptPath);

            List<String> command = new ArrayList<>();
            command.add(pythonPath != null ? pythonPath : "python");
            command.add(scriptPath);
            command.add(imageFile.getAbsolutePath());
            command.add(outputJson.getAbsolutePath());
            command.add("--with-legend");

            // Add image overlay flag for soil maps
            if (useImageOverlay) {
                command.add("--image-overlay");
                opencvLogger.info("[HYBRID] Using Image Overlay Mode (preserves original map appearance)");
            }

            // Write geo-bounds to a temporary file instead of passing as argument
            // This avoids command-line escaping issues on Windows and length limits
            File geoBoundsFile = null;
            if (geoBounds != null) {
                try {
                    geoBoundsFile = new File(tempDir.toFile(), "geo_bounds.json");
                    objectMapper.writeValue(geoBoundsFile, geoBounds);
                    command.add("--geo-bounds-file");
                    command.add(geoBoundsFile.getAbsolutePath());
                    opencvLogger.debug("[DEBUG] Wrote geo-bounds to file: {}", geoBoundsFile.getAbsolutePath());
                } catch (Exception e) {
                    opencvLogger.warn("[WARN] Failed to write geo-bounds file, continuing without: {}", e.getMessage());
                }
            }

            ProcessBuilder pb = new ProcessBuilder(command);
            pb.redirectErrorStream(true);

            opencvLogger.debug("Running polygon extractor: {}", pb.command());

            Process process = pb.start();

            // Read output and look for JSON marker
            StringBuilder fullOutput = new StringBuilder();
            String jsonOutput = null;
            boolean inJsonBlock = false;
            StringBuilder jsonBuilder = new StringBuilder();

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    fullOutput.append(line).append("\n");
                    opencvLogger.debug("Python: {}", line);

                    if (line.equals("===JSON_START===")) {
                        inJsonBlock = true;
                        continue;
                    }
                    if (line.equals("===JSON_END===")) {
                        inJsonBlock = false;
                        jsonOutput = jsonBuilder.toString();
                        continue;
                    }
                    if (inJsonBlock) {
                        jsonBuilder.append(line);
                    }
                }
            }

            int exitCode = process.waitFor();

            opencvLogger.info("[DEBUG] Python exit code: {}", exitCode);
            opencvLogger.info("[DEBUG] Full Python output:\n{}", fullOutput.toString());
            opencvLogger.info("[DEBUG] Extracted JSON output (from stdout): {}",
                    jsonOutput != null ? jsonOutput.substring(0, Math.min(500, jsonOutput.length())) : "null");

            // PRIORITY: Always read from file first (contains full data including
            // legend_base64)
            // stdout only contains minimal result without large base64 data
            if (exitCode == 0 && outputJson.exists()) {
                opencvLogger.info("[DEBUG] Reading full result from output file: {}", outputJson.getAbsolutePath());
                Map<String, Object> result = objectMapper.readValue(outputJson, Map.class);
                List<?> zones = (List<?>) result.get("zones");
                opencvLogger.info("[HYBRID] Successfully extracted {} zones from file",
                        zones != null ? zones.size() : 0);
                if (zones != null && !zones.isEmpty()) {
                    opencvLogger.info("[DEBUG] First zone sample: {}", zones.get(0));
                }
                return result;
            } else if (exitCode == 0 && jsonOutput != null && !jsonOutput.isEmpty()) {
                // Fallback: parse from stdout if file doesn't exist
                Map<String, Object> result = objectMapper.readValue(jsonOutput, Map.class);
                List<?> zones = (List<?>) result.get("zones");
                opencvLogger.info("[HYBRID] Successfully extracted {} zones", zones != null ? zones.size() : 0);
                if (zones != null && !zones.isEmpty()) {
                    opencvLogger.info("[DEBUG] First zone sample: {}", zones.get(0));
                }
                return result;
            } else if (outputJson.exists()) {
                // Fallback: read from file
                opencvLogger.info("[DEBUG] Reading from output file: {}", outputJson.getAbsolutePath());
                Map<String, Object> result = objectMapper.readValue(outputJson, Map.class);
                List<?> zones = (List<?>) result.get("zones");
                opencvLogger.info("[FALLBACK] Loaded {} zones from file", zones != null ? zones.size() : 0);
                return result;
            } else {
                opencvLogger.warn("Polygon extraction failed with exit code: {}", exitCode);
                opencvLogger.warn("[DEBUG] Output file exists: {}, path: {}", outputJson.exists(),
                        outputJson.getAbsolutePath());
                return null;
            }

        } catch (Exception e) {
            opencvLogger.error("Polygon extraction failed: {}", e.getMessage(), e);
            return null;
        } finally {
            deleteTempDirQuietly(tempDir);
        }
    }

    /**
     * NEW: Offline-only analysis with Georeferencing using
     * advanced_zone_detector.py
     * Processes map image with 4 control points to produce georeferenced polygons
     * 
     * @param imageFile     Image file to process
     * @param controlPoints List of 4 control points with pixelX, pixelY, lat, lng
     * @param province      Province name for context
     * @param district      District name (optional)
     * @param mapType       "soil" or "planning"
     * @param callback      Progress callback
     * @return Analysis result with georeferenced zones
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> analyzeWithGeoreferencing(
            File imageFile,
            List<Map<String, Object>> controlPoints,
            String province,
            String district,
            String mapType,
            ProgressCallback callback) {

        logger.info("=== OFFLINE GEOREFERENCED ANALYSIS START ===");
        logger.info("Image: {}, ControlPoints: {}, MapType: {}",
                imageFile.getName(), controlPoints != null ? controlPoints.size() : 0, mapType);

        Map<String, Object> result = new LinkedHashMap<>();
        List<Map<String, Object>> logs = new ArrayList<>();
        Path tempDir = null;

        try {
            // Validate control points
            if (controlPoints == null || controlPoints.size() != 4) {
                result.put("success", false);
                result.put("error", "Cần đúng 4 điểm tham chiếu để định vị bản đồ");
                return result;
            }

            callback.onProgress("step1_upload", "completed", "✓ Bước 1: Đã nhận ảnh bản đồ");
            addLog(logs, "System", "INFO", "Nhận ảnh: " + imageFile.getName());

            // Step 2: Write control points to temp file
            callback.onProgress("step2_georef", "processing", "Đang xử lý georeferencing...");
            tempDir = Files.createTempDirectory("georef_analysis_");
            File controlPointsFile = new File(tempDir.toFile(), "control_points.json");
            File outputJson = new File(tempDir.toFile(), "analysis_result.json");

            // Format control points for Python script
            Map<String, Object> cpData = new LinkedHashMap<>();
            for (int i = 0; i < controlPoints.size(); i++) {
                Map<String, Object> cp = controlPoints.get(i);
                Map<String, Object> point = new LinkedHashMap<>();
                point.put("pixel_x", cp.get("pixelX"));
                point.put("pixel_y", cp.get("pixelY"));
                point.put("lat", cp.get("lat"));
                point.put("lng", cp.get("lng"));
                cpData.put("point" + (i + 1), point);
            }
            objectMapper.writeValue(controlPointsFile, cpData);
            logger.info("Control points written to: {}", controlPointsFile.getAbsolutePath());

            callback.onProgress("step2_georef", "completed", "✓ Bước 2: Đã thiết lập 4 điểm tham chiếu GPS");
            addLog(logs, "System", "INFO", "4 control points đã được cấu hình");

            // NEW: Calculate geo bounds for area calculation (Technical Report Step 2)
            double minLat = Double.MAX_VALUE, maxLat = Double.MIN_VALUE;
            double minLng = Double.MAX_VALUE, maxLng = Double.MIN_VALUE;

            for (Map<String, Object> cp : controlPoints) {
                Number lat = (Number) cp.get("lat");
                Number lng = (Number) cp.get("lng");
                if (lat != null && lng != null) {
                    minLat = Math.min(minLat, lat.doubleValue());
                    maxLat = Math.max(maxLat, lat.doubleValue());
                    minLng = Math.min(minLng, lng.doubleValue());
                    maxLng = Math.max(maxLng, lng.doubleValue());
                }
            }

            // Create geo_bounds.json structure
            Map<String, Object> geoBounds = new LinkedHashMap<>();
            geoBounds.put("sw", Map.of("lat", minLat, "lng", minLng));
            geoBounds.put("ne", Map.of("lat", maxLat, "lng", maxLng));
            geoBounds.put("center", Map.of("lat", (minLat + maxLat) / 2, "lng", (minLng + maxLng) / 2));

            File geoBoundsFile = new File(tempDir.toFile(), "geo_bounds.json");
            objectMapper.writeValue(geoBoundsFile, geoBounds);
            logger.info("Geo bounds written to: {}", geoBoundsFile.getAbsolutePath());

            // Step 3: Run map_polygon_extractor.py (main production script)
            callback.onProgress("step3_opencv", "processing", "Đang phát hiện vùng bằng OpenCV...");

            String scriptPath = findPythonScript("map_polygon_extractor.py");
            if (scriptPath == null) {
                // Fallback to advanced_zone_detector.py if not found
                scriptPath = findPythonScript("advanced_zone_detector.py");
            }
            if (scriptPath == null) {
                opencvLogger.error("Cannot find map_polygon_extractor.py script!");
                result.put("success", false);
                result.put("error", "Không tìm thấy script map_polygon_extractor.py");
                return result;
            }

            List<String> command = new ArrayList<>();
            command.add(pythonPath != null ? pythonPath : "python");
            command.add(scriptPath);
            command.add(imageFile.getAbsolutePath());
            command.add(outputJson.getAbsolutePath());
            if (scriptPath.contains("map_polygon_extractor")) {
                // map_polygon_extractor.py args: input_image output_json [--with-legend]
                // --geo-bounds-file <file> --control-points-file <file> --map-type <soil|planning>
                command.add("--with-legend");
                command.add("--geo-bounds-file");
                command.add(geoBoundsFile.getAbsolutePath());
                // Pass control points for proper affine transform
                command.add("--control-points-file");
                command.add(controlPointsFile.getAbsolutePath());
                // Pass map type to use different algorithms
                // soil = K-means clustering + color matching (Thổ nhưỡng)
                // planning = Watershed + boundary detection (Quy hoạch)
                command.add("--map-type");
                command.add(MAP_TYPE_PLANNING.equalsIgnoreCase(mapType) ? "planning" : "soil");
            } else {
                // Legacy advanced_zone_detector args
                command.add("--control-points");
                command.add(controlPointsFile.getAbsolutePath());
                command.add("--n-colors");
                command.add("40");
                command.add("--min-area");
                command.add("0.02");
            }

            ProcessBuilder pb = new ProcessBuilder(command);
            pb.redirectErrorStream(true);

            opencvLogger.info("Running advanced zone detector: {}", String.join(" ", command));

            Process process = pb.start();
            StringBuilder fullOutput = new StringBuilder();

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    fullOutput.append(line).append("\n");
                    opencvLogger.debug("Python: {}", line);
                }
            }

            int exitCode = process.waitFor();
            opencvLogger.info("Python exit code: {}, output length: {}", exitCode, fullOutput.length());

            if (exitCode != 0 || !outputJson.exists()) {
                opencvLogger.error("Advanced zone detector failed. Exit: {}, Output: {}", exitCode, fullOutput);
                result.put("success", false);
                result.put("error", "Lỗi phân tích OpenCV: "
                        + fullOutput.toString().substring(0, Math.min(500, fullOutput.length())));
                addLog(logs, "OpenCV", "ERROR", "Script failed: exit code " + exitCode);
                callback.onProgress("step3_opencv", "failed", "❌ Lỗi OpenCV");
                return result;
            }

            // Parse results
            Map<String, Object> analysisResult = objectMapper.readValue(outputJson, Map.class);

            // map_polygon_extractor returns "zones", get zones array
            List<Map<String, Object>> zones = (List<Map<String, Object>>) analysisResult.get("zones");
            int zoneCount = zones != null ? zones.size() : 0;

            // Get statistics from map_polygon_extractor format
            Double totalHectares = null;
            Double coverage = null;
            if (analysisResult.containsKey("totalCoverage")) {
                coverage = ((Number) analysisResult.get("totalCoverage")).doubleValue();
            }
            // Get color summary for statistics
            List<Map<String, Object>> colorSummary = (List<Map<String, Object>>) analysisResult.get("colorSummary");
            if (colorSummary != null) {
                // Sum up percentages for total coverage if not provided
                if (coverage == null) {
                    coverage = colorSummary.stream()
                            .mapToDouble(c -> ((Number) c.getOrDefault("percentage", 0)).doubleValue())
                            .sum();
                }
            }

            callback.onProgress("step3_opencv", "completed",
                    String.format("✓ Bước 3: Phát hiện %d vùng đất, độ phủ %.1f%%",
                            zoneCount, coverage != null ? coverage : 0));
            addLog(logs, "OpenCV", "SUCCESS",
                    String.format("Phát hiện %d vùng, %.1f%% coverage", zoneCount, coverage != null ? coverage : 0));

            // Step 4: Map colors to soil types from database
            callback.onProgress("step4_mapping", "processing", "Đang gán loại đất từ database...");

            boolean isPlanningMap = MAP_TYPE_PLANNING.equalsIgnoreCase(mapType);
            int mappedCount = 0;

            if (zones != null) {
                for (Map<String, Object> zone : zones) {
                    // map_polygon_extractor format: fillColor, colorRgb, zoneType, zoneCode,
                    // zoneName
                    String soilType = (String) zone.get("zoneType");
                    String soilName = (String) zone.get("zoneName");
                    String color = (String) zone.get("fillColor");

                    // If soilType/soilName not set, try legacy fields
                    if (soilType == null) {
                        soilType = (String) zone.get("soil_type");
                    }
                    if (soilName == null) {
                        soilName = (String) zone.get("soil_name");
                    }

                    if (soilType != null && !soilType.isEmpty()) {
                        // Try to map to database
                        String dbCode = isPlanningMap
                                ? planningZoneTypeMappingService.mapAiNameToCode(soilType)
                                : soilTypeMappingService.mapAiNameToCode(soilType);

                        if (dbCode != null) {
                            if (isPlanningMap) {
                                Optional<PlanningZoneType> typeOpt = planningZoneTypeMappingService
                                        .getZoneTypeByCode(dbCode);
                                if (typeOpt.isPresent()) {
                                    PlanningZoneType type = typeOpt.get();
                                    zone.put("zoneCode", type.getCode());
                                    zone.put("zoneType", type.getName());
                                    zone.put("landUsePurpose", type.getName());
                                    mappedCount++;
                                }
                            } else {
                                Optional<SoilType> typeOpt = soilTypeMappingService.getSoilTypeByCode(dbCode);
                                if (typeOpt.isPresent()) {
                                    SoilType type = typeOpt.get();
                                    zone.put("zoneCode", type.getCode());
                                    zone.put("zoneType", type.getName());
                                    zone.put("landUsePurpose", type.getName());
                                    zone.put("soilCategory", type.getCategory());
                                    mappedCount++;
                                }
                            }
                        }
                    }

                    // Ensure all zones have required fields
                    zone.putIfAbsent("zoneCode", soilType != null ? soilType : "AI_" + sanitizeColorCode(color));
                    zone.putIfAbsent("zoneType",
                            soilName != null ? soilName : (soilType != null ? soilType : "Unknown"));
                    zone.putIfAbsent("name", zone.get("zoneType"));
                }
            }

            callback.onProgress("step4_mapping", "completed",
                    String.format("✓ Bước 4: Đã liên kết %d/%d loại đất với DB", mappedCount, zoneCount));
            addLog(logs, "Mapping", "SUCCESS", String.format("Mapped %d/%d zones to DB", mappedCount, zoneCount));

            // Build final result
            result.put("success", true);
            result.put("zones", zones);
            result.put("zoneCount", zoneCount);
            result.put("mappedCount", mappedCount);
            result.put("totalAreaHectares", totalHectares);
            result.put("coverage", coverage);
            result.put("controlPoints", controlPoints);
            result.put("province", province);
            result.put("district", district);
            result.put("mapType", mapType);
            result.put("imagePath", imageFile.getAbsolutePath());
            result.put("logs", logs);
            result.put("offlineMode", true);
            result.put("analysisTime", System.currentTimeMillis());
            result.put("detectorVersion",
                    scriptPath.contains("map_polygon_extractor") ? "map_polygon_extractor" : "advanced");
            result.put("colorSummary", analysisResult.get("colorSummary"));
            result.put("soilStatistics", analysisResult.get("soilStatistics")); // NEW: Pass soil statistics to frontend
            result.put("soilTypesCount", analysisResult.get("soilTypesCount")); // NEW: Number of soil types

            // Get bounds from control points for Leaflet (using values calculated above)
            Map<String, Object> bounds = new LinkedHashMap<>();
            bounds.put("sw", Map.of("lat", minLat, "lng", minLng));
            bounds.put("ne", Map.of("lat", maxLat, "lng", maxLng));
            bounds.put("center", Map.of("lat", (minLat + maxLat) / 2, "lng", (minLng + maxLng) / 2));
            result.put("bounds", bounds);
            // Also set as "coordinates" for frontend compatibility (displayAnalysisResults uses this key)
            result.put("coordinates", bounds);

            logger.info("=== OFFLINE GEOREFERENCED ANALYSIS COMPLETE ===");
            logger.info("Zones: {}, Mapped: {}, Total Area: {} ha", zoneCount, mappedCount, totalHectares);

            return result;

        } catch (Exception e) {
            logger.error("Georeferenced analysis failed: {}", e.getMessage(), e);
            result.put("success", false);
            result.put("error", "Lỗi phân tích: " + e.getMessage());
            result.put("logs", logs);
            callback.onProgress("error", "failed", "❌ Lỗi: " + e.getMessage());
            return result;
        } finally {
            deleteTempDirQuietly(tempDir);
        }
    }

    /**
     * Step 3 (OPTIMIZED): Use GPT-4o to label colors with zone types
     * Now uses extracted legend image if available (10-20x smaller than full map)
     * Falls back to full image if legend extraction failed
     * 
     * HỖ TRỢ 2 LOẠI:
     * - soil: Bản đồ thổ nhưỡng (Phèn, Mặn, Phù sa...)
     * - planning: Bản đồ quy hoạch (LUC, ONT, RSX...)
     * 
     * @param imageFile    Full map image (fallback)
     * @param colorSummary List of detected colors from OpenCV
     * @param province     Province name for context
     * @param legendInfo   Legend info from OpenCV containing base64 encoded legend
     *                     crop
     * @param mapType      "soil" hoặc "planning"
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> labelColorsWithGPT4o(File imageFile, List<Map<String, Object>> colorSummary,
            String province, Map<String, Object> legendInfo, String mapType) {

        boolean isPlanningMap = MAP_TYPE_PLANNING.equalsIgnoreCase(mapType);
        gpt4oLogger.info("[HYBRID] Starting color labeling for: {} (mode: {})", imageFile.getName(), mapType);

        if (githubToken == null || githubToken.isEmpty()) {
            gpt4oLogger.warn("GitHub token not configured");
            return null;
        }

        try {
            // Build a compact color list string
            StringBuilder colorList = new StringBuilder();
            for (Map<String, Object> c : colorSummary) {
                colorList.append(c.get("color")).append("(").append(c.get("percentage")).append("%), ");
            }

            // OPTIMIZED: Use legend image if available (much smaller = faster + cheaper)
            String base64Image;
            String mimeType;
            boolean usingLegendImage = false;

            if (legendInfo != null && legendInfo.get("base64") != null) {
                // Use extracted legend image - typically 10-20x smaller than full map!
                base64Image = (String) legendInfo.get("base64");
                mimeType = "image/jpeg"; // Legend is always saved as JPEG
                usingLegendImage = true;
                gpt4oLogger.info("[OPTIMIZED] Using extracted legend image (position: {})",
                        legendInfo.get("position"));
            } else {
                // Fallback: Use full map image
                byte[] imageBytes = Files.readAllBytes(imageFile.toPath());
                base64Image = Base64.getEncoder().encodeToString(imageBytes);
                mimeType = getMimeType(imageFile);
                gpt4oLogger.info("[FALLBACK] Using full map image (legend extraction failed)");
            }

            gpt4oLogger.debug("Sending {} colors for labeling", colorSummary.size());

            // Build request - MUCH SIMPLER prompt
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(Objects.requireNonNull(githubToken));

            ObjectNode requestBody = objectMapper.createObjectNode();
            requestBody.put("model", githubModel);
            requestBody.put("max_tokens", 1024); // Much smaller!
            requestBody.put("temperature", 0.1);

            ArrayNode messages = requestBody.putArray("messages");

            // System message
            ObjectNode systemMsg = messages.addObject();
            systemMsg.put("role", "system");
            systemMsg.put("content", "Ban la chuyen gia phan tich ban do Viet Nam. Tra loi ngan gon bang JSON.");

            // User message - Different prompts for legend image vs full map
            ObjectNode userMsg = messages.addObject();
            userMsg.put("role", "user");
            ArrayNode content = userMsg.putArray("content");

            ObjectNode textPart = content.addObject();
            textPart.put("type", "text");

            // Get standard names based on map type
            String standardTypes;
            String mapTypeDesc;

            if (isPlanningMap) {
                standardTypes = planningZoneTypeMappingService.formatZoneTypesForPrompt();
                mapTypeDesc = "quy hoach su dung dat";
            } else {
                standardTypes = soilTypeMappingService.formatSoilTypesForPrompt();
                mapTypeDesc = "tho nhuong (loai dat)";
            }

            String promptText;
            if (usingLegendImage) {
                // OPTIMIZED PROMPT: Direct legend reading with standard types reference
                promptText = String.format(
                        "Day la BANG CHU GIAI (legend) cua ban do %s tinh %s. " +
                                "Cac mau da phat hien tren ban do: %s. \n\n" +
                                "DANH SACH LOAI %s CHUAN CUA VIET NAM (hay co gang gan dung ten nay):\n%s\n" +
                                "HAY DOC CHINH XAC ten %s trong chu giai va GAN DUNG TEN CHUAN o tren neu co the. " +
                                "Tra ve JSON: {\"colorToSoil\":{\"#hex\":\"ten loai dat chuan\",...},\"dominantType\":\"loai dat pho bien nhat\"}",
                        mapTypeDesc, province, colorList.toString(),
                        isPlanningMap ? "QUY HOACH" : "DAT",
                        standardTypes,
                        isPlanningMap ? "loai quy hoach" : "loai dat");
            } else {
                // FALLBACK PROMPT: Full map reading with standard types reference
                promptText = String.format(
                        "Nhin vao chu giai (legend) cua ban do %s %s. Cac mau chinh: %s. \n\n" +
                                "DANH SACH %s CHUAN:\n%s\n" +
                                "Gan ten %s CHUAN cho tung mau. JSON: " +
                                "{\"colorToSoil\":{\"#hex\":\"ten loai dat chuan\",...},\"dominantType\":\"loai dat pho bien nhat\"}",
                        mapTypeDesc, province, colorList.toString(),
                        isPlanningMap ? "LOAI QUY HOACH" : "LOAI DAT",
                        standardTypes,
                        isPlanningMap ? "loai quy hoach" : "loai dat");
            }
            textPart.put("text", promptText);

            ObjectNode imagePart = content.addObject();
            imagePart.put("type", "image_url");
            ObjectNode imageUrl = imagePart.putObject("image_url");
            imageUrl.put("url", "data:" + mimeType + ";base64," + base64Image);
            // Use higher detail for legend image since it's already small
            imageUrl.put("detail", usingLegendImage ? "high" : "low");

            HttpEntity<String> entity = new HttpEntity<>(requestBody.toString(), headers);

            gpt4oLogger.info("Calling GPT-4o for color labeling...");
            ResponseEntity<String> response = restTemplate.exchange(
                    Objects.requireNonNull(GITHUB_API_URL), Objects.requireNonNull(HttpMethod.POST), entity,
                    String.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                JsonNode responseJson = objectMapper.readTree(response.getBody());
                String text = responseJson.path("choices").path(0)
                        .path("message").path("content").asText();

                gpt4oLogger.debug("GPT-4o color labeling response: {} chars", text.length());

                String jsonStr = extractJsonFromText(text);
                if (jsonStr != null) {
                    Map<String, Object> result = objectMapper.readValue(jsonStr, Map.class);
                    Map<?, ?> colorToSoil = (Map<?, ?>) result.get("colorToSoil");
                    gpt4oLogger.info("[HYBRID] Successfully labeled {} colors",
                            colorToSoil != null ? colorToSoil.size() : 0);
                    return result;
                }
            }

            gpt4oLogger.warn("Failed to parse color labeling response");
            return null;

        } catch (Exception e) {
            gpt4oLogger.error("Color labeling failed: {}", e.getMessage(), e);
            return null;
        }
    }

    // ============ UTILITY METHODS ============

    private void addLog(List<Map<String, Object>> logs, String ai, String level, String message) {
        Map<String, Object> log = new LinkedHashMap<>();
        log.put("timestamp", System.currentTimeMillis());
        log.put("ai", ai);
        log.put("level", level);
        log.put("message", message);
        logs.add(log);

        // Log to specific logger
        switch (ai) {
            case "OpenCV" -> opencvLogger.info("[{}] {}", level, message);
            case "GPT-4o" -> gpt4oLogger.info("[{}] {}", level, message);
            default -> logger.info("[{}] [{}] {}", ai, level, message);
        }
    }

    private String getMimeType(File file) {
        String name = file.getName().toLowerCase();
        if (name.endsWith(".png"))
            return "image/png";
        if (name.endsWith(".jpg") || name.endsWith(".jpeg"))
            return "image/jpeg";
        if (name.endsWith(".gif"))
            return "image/gif";
        if (name.endsWith(".webp"))
            return "image/webp";
        return "image/jpeg";
    }

    private String extractJsonFromText(String text) {
        if (text == null || text.isEmpty())
            return null;

        // Try to find JSON block
        int start = text.indexOf("{");
        int end = text.lastIndexOf("}");

        if (start >= 0 && end > start) {
            String jsonStr = text.substring(start, end + 1);
            // Validate it's valid JSON
            try {
                objectMapper.readTree(jsonStr);
                return jsonStr;
            } catch (Exception e) {
                logger.debug("Invalid JSON extracted: {}", e.getMessage());
            }
        }

        // Try markdown code block
        if (text.contains("```json")) {
            int jsonStart = text.indexOf("```json") + 7;
            int jsonEnd = text.indexOf("```", jsonStart);
            if (jsonEnd > jsonStart) {
                return text.substring(jsonStart, jsonEnd).trim();
            }
        }

        return null;
    }

    /**
     * Find Python script by trying multiple possible paths
     */
    private String findPythonScript(String scriptName) {
        // List of possible paths to try
        String[] pathCandidates = {
                // Running from project root (E:\Agriplanner)
                Paths.get("backend", "python", scriptName).toAbsolutePath().toString(),
                // Running from backend directory (E:\Agriplanner\backend)
                Paths.get("python", scriptName).toAbsolutePath().toString(),
                // Absolute path based on user.dir
                Paths.get(System.getProperty("user.dir"), "backend", "python", scriptName).toString(),
                Paths.get(System.getProperty("user.dir"), "python", scriptName).toString(),
                // Try parent directory
                Paths.get(System.getProperty("user.dir")).getParent().resolve("backend").resolve("python")
                        .resolve(scriptName).toString(),
        };

        for (String path : pathCandidates) {
            File file = new File(path);
            if (file.exists() && file.isFile()) {
                opencvLogger.debug("Found script at: {}", path);
                return path;
            }
        }

        // Log all tried paths for debugging
        opencvLogger.error("Script {} not found. Tried paths:", scriptName);
        for (String path : pathCandidates) {
            opencvLogger.error("  - {} (exists: {})", path, new File(path).exists());
        }

        return null;
    }

    private void deleteTempDirQuietly(Path tempDir) {
        if (tempDir == null) {
            return;
        }
        try {
            if (!Files.exists(tempDir)) {
                return;
            }
            try (Stream<Path> paths = Files.walk(tempDir)) {
                paths.sorted(Comparator.reverseOrder()).forEach(path -> {
                    try {
                        Files.deleteIfExists(path);
                    } catch (Exception e) {
                        opencvLogger.debug("Failed to delete temp path {}: {}", path, e.getMessage());
                    }
                });
            }
        } catch (Exception e) {
            opencvLogger.debug("Failed to cleanup temp dir {}: {}", tempDir, e.getMessage());
        }
    }

    /**
     * P1 FIX: Safely extract 6-char hex from color string
     * Prevents StringIndexOutOfBoundsException when color is null/short/malformed
     */
    private String sanitizeColorCode(String color) {
        if (color == null || color.isEmpty()) {
            return "UNKNOWN";
        }
        String hex = color.startsWith("#") ? color.substring(1) : color;
        if (hex.length() >= 6) {
            return hex.substring(0, 6).toUpperCase();
        } else if (!hex.isEmpty()) {
            return hex.toUpperCase();
        }
        return "UNKNOWN";
    }
}
