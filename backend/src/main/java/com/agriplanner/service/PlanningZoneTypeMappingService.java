package com.agriplanner.service;

import com.agriplanner.model.PlanningZoneType;
import com.agriplanner.repository.PlanningZoneTypeRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Service để mapping tên loại đất QUY HOẠCH từ AI về mã chuẩn trong Database
 * Tương tự SoilTypeMappingService nhưng cho bảng planning_zone_types
 * 
 * Bảng planning_zone_types chứa: LUC, ONT, ODT, RSX, RPH, CHN, CLN, NTS, ...
 * (Đất trồng lúa, Đất ở nông thôn, Đất ở đô thị, Rừng sản xuất, ...)
 */
@Service
public class PlanningZoneTypeMappingService {

    private static final Logger logger = LoggerFactory.getLogger(PlanningZoneTypeMappingService.class);

    private final PlanningZoneTypeRepository planningZoneTypeRepository;

    // Cache: code -> PlanningZoneType entity
    private final Map<String, PlanningZoneType> codeToZoneType = new ConcurrentHashMap<>();
    
    // Cache: normalized name -> code (for fast lookup)
    private final Map<String, String> normalizedNameToCode = new ConcurrentHashMap<>();
    
    // Cache: keywords -> code (for fuzzy matching)
    private final Map<String, String> keywordsToCode = new ConcurrentHashMap<>();
    
    // Danh sách tên chuẩn để đưa vào prompt AI
    private List<String> standardNames = new ArrayList<>();

    // Pattern để loại bỏ dấu tiếng Việt
    private static final Pattern DIACRITICS_PATTERN = Pattern.compile("\\p{InCombiningDiacriticalMarks}+");

    public PlanningZoneTypeMappingService(PlanningZoneTypeRepository planningZoneTypeRepository) {
        this.planningZoneTypeRepository = planningZoneTypeRepository;
    }

    /**
     * Load dữ liệu từ DB vào cache khi khởi động
     */
    @PostConstruct
    public void initializeCache() {
        logger.info("Initializing PlanningZoneType mapping cache...");
        reloadCache();
    }

    /**
     * Reload cache từ database
     */
    public void reloadCache() {
        try {
            List<PlanningZoneType> allZoneTypes = planningZoneTypeRepository.findAll();
            
            codeToZoneType.clear();
            normalizedNameToCode.clear();
            keywordsToCode.clear();
            standardNames.clear();

            for (PlanningZoneType zt : allZoneTypes) {
                String code = zt.getCode().toUpperCase();
                
                // 1. Code -> Entity
                codeToZoneType.put(code, zt);
                
                // 2. Normalized name -> Code
                String normalizedName = normalizeText(zt.getName());
                normalizedNameToCode.put(normalizedName, code);
                
                // 3. Thêm tên chuẩn vào danh sách
                standardNames.add(zt.getName());
                
                // 4. Extract keywords
                extractAndMapKeywords(zt.getName(), code);
                extractAndMapKeywords(zt.getDescription(), code);
            }
            
            // Thêm các alias phổ biến cho bản đồ quy hoạch
            addCommonAliases();

            logger.info("Loaded {} planning zone types into cache. Keywords: {}", 
                    codeToZoneType.size(), keywordsToCode.size());
            
        } catch (Exception e) {
            logger.error("Failed to load PlanningZoneType cache: {}", e.getMessage(), e);
        }
    }

    /**
     * Thêm các alias/synonym phổ biến cho quy hoạch đất
     */
    private void addCommonAliases() {
        // Đất nông nghiệp
        keywordsToCode.put("lua", "LUC");
        keywordsToCode.put("lua nuoc", "LUC");
        keywordsToCode.put("trong lua", "LUC");
        keywordsToCode.put("dat lua", "LUC");
        keywordsToCode.put("ruong lua", "LUC");
        keywordsToCode.put("chuyen lua", "LUC");
        
        keywordsToCode.put("lua khac", "LUK");
        keywordsToCode.put("lua nuong", "LUK");
        keywordsToCode.put("lua ray", "LUK");
        
        keywordsToCode.put("cay hang nam", "CHN");
        keywordsToCode.put("mau", "CHN");
        keywordsToCode.put("rau cu", "CHN");
        keywordsToCode.put("rau mau", "CHN");
        keywordsToCode.put("trong mau", "CHN");
        keywordsToCode.put("dat mau", "CHN");
        
        keywordsToCode.put("cay lau nam", "CLN");
        keywordsToCode.put("cay an qua", "CLN");
        keywordsToCode.put("vuon", "CLN");
        keywordsToCode.put("trong cay", "CLN");
        keywordsToCode.put("cay cong nghiep", "CLN");
        keywordsToCode.put("cay an trai", "CLN");
        
        // Rừng
        keywordsToCode.put("rung san xuat", "RSX");
        keywordsToCode.put("rung trong", "RSX");
        keywordsToCode.put("dat rung", "RSX");
        
        keywordsToCode.put("rung phong ho", "RPH");
        keywordsToCode.put("phong ho", "RPH");
        
        keywordsToCode.put("rung dac dung", "RDD");
        keywordsToCode.put("vuon quoc gia", "RDD");
        keywordsToCode.put("khu bao ton", "RDD");
        
        // Thủy sản
        keywordsToCode.put("thuy san", "NTS");
        keywordsToCode.put("nuoi tom", "NTS");
        keywordsToCode.put("nuoi ca", "NTS");
        keywordsToCode.put("ao ho", "NTS");
        keywordsToCode.put("nuoi trong thuy san", "NTS");
        
        // Làm muối
        keywordsToCode.put("lam muoi", "LMU");
        keywordsToCode.put("ruong muoi", "LMU");
        
        // Đất ở
        keywordsToCode.put("dat o", "ONT");
        keywordsToCode.put("nha o", "ONT");
        keywordsToCode.put("khu dan cu", "ONT");
        keywordsToCode.put("tho cu", "ONT");
        keywordsToCode.put("o nong thon", "ONT");
        
        keywordsToCode.put("o do thi", "ODT");
        keywordsToCode.put("dat o do thi", "ODT");
        keywordsToCode.put("khu do thi", "ODT");
        
        // Cơ quan
        keywordsToCode.put("tru so", "TSC");
        keywordsToCode.put("co quan", "TSC");
        keywordsToCode.put("hanh chinh", "TSC");
        
        // Giáo dục
        keywordsToCode.put("giao duc", "DGD");
        keywordsToCode.put("truong hoc", "DGD");
        keywordsToCode.put("dai hoc", "DGD");
        
        // Y tế
        keywordsToCode.put("y te", "DYT");
        keywordsToCode.put("benh vien", "DYT");
        keywordsToCode.put("tram y te", "DYT");
        
        // Văn hóa, thể thao
        keywordsToCode.put("van hoa", "DVH");
        keywordsToCode.put("cong trinh van hoa", "DVH");
        
        keywordsToCode.put("the thao", "DTT");
        keywordsToCode.put("san van dong", "DTT");
        
        // Giao thông
        keywordsToCode.put("giao thong", "DGT");
        keywordsToCode.put("duong", "DGT");
        keywordsToCode.put("quoc lo", "DGT");
        
        // Thủy lợi
        keywordsToCode.put("thuy loi", "DTL");
        keywordsToCode.put("kenh muong", "DTL");
        
        // Công nghiệp
        keywordsToCode.put("cong nghiep", "SKC");
        keywordsToCode.put("khu cong nghiep", "SKC");
        keywordsToCode.put("cum cong nghiep", "SKC");
        keywordsToCode.put("nha may", "SKC");
        
        // Thương mại
        keywordsToCode.put("thuong mai", "TMD");
        keywordsToCode.put("dich vu", "TMD");
        keywordsToCode.put("cho", "TMD");
        keywordsToCode.put("sieu thi", "TMD");
        
        // Sông nước
        keywordsToCode.put("song ngoi", "SON");
        keywordsToCode.put("kenh rach", "SON");
        keywordsToCode.put("mat nuoc", "MNC");
        
        // Đất chưa sử dụng
        keywordsToCode.put("chua su dung", "BCS");
        keywordsToCode.put("dat trong", "BCS");
        keywordsToCode.put("hoang hoa", "BCS");
        
        // Nghĩa trang
        keywordsToCode.put("nghia trang", "NTD");
        keywordsToCode.put("nghia dia", "NTD");
        
        // Năng lượng
        keywordsToCode.put("nang luong", "DNL");
        keywordsToCode.put("dien", "DNL");
        keywordsToCode.put("tram bien ap", "DNL");
    }

    /**
     * Extract keywords từ text và map về code
     */
    private void extractAndMapKeywords(String text, String code) {
        if (text == null || text.isEmpty()) return;
        
        String normalized = normalizeText(text);
        String[] words = normalized.split("\\s+");
        
        // Map từng từ quan trọng (>= 3 ký tự)
        for (String word : words) {
            if (word.length() >= 3 && !isStopWord(word)) {
                keywordsToCode.putIfAbsent(word, code);
            }
        }
        
        // Map cụm 2-3 từ liên tiếp
        for (int i = 0; i < words.length - 1; i++) {
            if (words[i].length() >= 2 && words[i + 1].length() >= 2) {
                String bigram = words[i] + " " + words[i + 1];
                keywordsToCode.putIfAbsent(bigram, code);
            }
        }
    }

    /**
     * Kiểm tra stop words
     */
    private boolean isStopWord(String word) {
        Set<String> stopWords = Set.of(
            "dat", "la", "va", "cua", "cho", "trong", "co", "khac", "cac", 
            "su", "dung", "voi", "tai", "den", "tu", "duoc", "nhu", "khi"
        );
        return stopWords.contains(word);
    }

    /**
     * Normalize text: lowercase, remove diacritics
     */
    public String normalizeText(String text) {
        if (text == null) return "";
        
        // Lowercase
        String normalized = text.toLowerCase().trim();
        
        // Remove Vietnamese diacritics
        normalized = Normalizer.normalize(normalized, Normalizer.Form.NFD);
        normalized = DIACRITICS_PATTERN.matcher(normalized).replaceAll("");
        
        // Replace đ -> d
        normalized = normalized.replace("đ", "d").replace("Đ", "d");
        
        // Remove extra spaces
        normalized = normalized.replaceAll("\\s+", " ");
        
        return normalized;
    }

    /**
     * Map tên AI trả về sang code trong DB
     * Sử dụng multi-strategy matching:
     * 1. Exact match
     * 2. Contains match  
     * 3. Keyword match
     * 4. Fuzzy match (Levenshtein)
     */
    public String mapAiNameToCode(String aiZoneName) {
        if (aiZoneName == null || aiZoneName.trim().isEmpty()) {
            return null;
        }
        
        String normalized = normalizeText(aiZoneName);
        logger.debug("Mapping planning zone AI name: '{}' -> normalized: '{}'", aiZoneName, normalized);

        // Strategy 1: Exact match
        if (normalizedNameToCode.containsKey(normalized)) {
            String code = normalizedNameToCode.get(normalized);
            logger.debug("  -> Exact match: {}", code);
            return code;
        }

        // Strategy 2: Contains match
        for (Map.Entry<String, String> entry : normalizedNameToCode.entrySet()) {
            if (normalized.contains(entry.getKey()) || entry.getKey().contains(normalized)) {
                logger.debug("  -> Contains match: {} (via {})", entry.getValue(), entry.getKey());
                return entry.getValue();
            }
        }

        // Strategy 3: Keyword match - ưu tiên match dài nhất
        String bestMatch = null;
        int bestMatchLength = 0;
        
        for (Map.Entry<String, String> entry : keywordsToCode.entrySet()) {
            String keyword = entry.getKey();
            if (normalized.contains(keyword) && keyword.length() > bestMatchLength) {
                bestMatch = entry.getValue();
                bestMatchLength = keyword.length();
            }
        }
        
        if (bestMatch != null) {
            logger.debug("  -> Keyword match: {} (length: {})", bestMatch, bestMatchLength);
            return bestMatch;
        }

        // Strategy 4: Fuzzy match
        String fuzzyMatch = findBestFuzzyMatch(normalized);
        if (fuzzyMatch != null) {
            logger.debug("  -> Fuzzy match: {}", fuzzyMatch);
            return fuzzyMatch;
        }

        logger.warn("  -> No match found for planning zone: '{}'", aiZoneName);
        return null;
    }

    /**
     * Fuzzy match với Levenshtein distance
     */
    private String findBestFuzzyMatch(String normalized) {
        String bestCode = null;
        double bestSimilarity = 0.65; // Threshold 65% cho quy hoạch
        
        for (Map.Entry<String, String> entry : normalizedNameToCode.entrySet()) {
            double similarity = calculateSimilarity(normalized, entry.getKey());
            if (similarity > bestSimilarity) {
                bestSimilarity = similarity;
                bestCode = entry.getValue();
            }
        }
        
        return bestCode;
    }

    /**
     * Tính similarity ratio (0.0 - 1.0)
     */
    private double calculateSimilarity(String s1, String s2) {
        int maxLen = Math.max(s1.length(), s2.length());
        if (maxLen == 0) return 1.0;
        
        int distance = levenshteinDistance(s1, s2);
        return 1.0 - ((double) distance / maxLen);
    }

    /**
     * Levenshtein distance
     */
    private int levenshteinDistance(String s1, String s2) {
        int[][] dp = new int[s1.length() + 1][s2.length() + 1];
        
        for (int i = 0; i <= s1.length(); i++) {
            for (int j = 0; j <= s2.length(); j++) {
                if (i == 0) {
                    dp[i][j] = j;
                } else if (j == 0) {
                    dp[i][j] = i;
                } else {
                    int cost = (s1.charAt(i - 1) == s2.charAt(j - 1)) ? 0 : 1;
                    dp[i][j] = Math.min(
                        Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1),
                        dp[i - 1][j - 1] + cost
                    );
                }
            }
        }
        
        return dp[s1.length()][s2.length()];
    }

    /**
     * Lấy PlanningZoneType entity từ code
     */
    public Optional<PlanningZoneType> getZoneTypeByCode(String code) {
        if (code == null) return Optional.empty();
        return Optional.ofNullable(codeToZoneType.get(code.toUpperCase()));
    }

    /**
     * Lấy PlanningZoneType từ tên AI
     */
    public Optional<PlanningZoneType> getZoneTypeByAiName(String aiName) {
        String code = mapAiNameToCode(aiName);
        if (code != null) {
            return getZoneTypeByCode(code);
        }
        return Optional.empty();
    }

    /**
     * Lấy danh sách tên chuẩn
     */
    public List<String> getStandardNames() {
        return Collections.unmodifiableList(standardNames);
    }

    /**
     * Lấy danh sách theo category
     */
    public List<String> getNamesByCategory(String category) {
        return codeToZoneType.values().stream()
                .filter(zt -> zt.getCategory().equalsIgnoreCase(category))
                .map(PlanningZoneType::getName)
                .collect(Collectors.toList());
    }

    /**
     * Format danh sách cho AI prompt (grouped by category)
     */
    public String formatZoneTypesForPrompt() {
        StringBuilder sb = new StringBuilder();
        
        // Group by category
        Map<String, List<PlanningZoneType>> byCategory = codeToZoneType.values().stream()
                .collect(Collectors.groupingBy(PlanningZoneType::getCategory));
        
        for (Map.Entry<String, List<PlanningZoneType>> entry : byCategory.entrySet()) {
            sb.append("- ").append(entry.getKey()).append(": ");
            String names = entry.getValue().stream()
                    .map(zt -> zt.getName() + " (" + zt.getCode() + ")")
                    .collect(Collectors.joining(", "));
            sb.append(names).append("\n");
        }
        
        return sb.toString();
    }

    /**
     * Kiểm tra code có hợp lệ không
     */
    public boolean isValidCode(String code) {
        return code != null && codeToZoneType.containsKey(code.toUpperCase());
    }

    /**
     * Thống kê cache
     */
    public Map<String, Object> getCacheStats() {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalZoneTypes", codeToZoneType.size());
        stats.put("totalNameMappings", normalizedNameToCode.size());
        stats.put("totalKeywordMappings", keywordsToCode.size());
        stats.put("categories", codeToZoneType.values().stream()
                .map(PlanningZoneType::getCategory)
                .distinct()
                .collect(Collectors.toList()));
        return stats;
    }
}
