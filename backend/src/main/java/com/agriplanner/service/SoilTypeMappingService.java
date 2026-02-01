package com.agriplanner.service;

import com.agriplanner.model.SoilType;
import com.agriplanner.repository.SoilTypeRepository;
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
 * Service để mapping tên loại đất từ AI về mã chuẩn trong Database
 * Giải quyết vấn đề "lạc mất liên kết" giữa AI text output và DB codes
 * 
 * Quy trình:
 * 1. Load danh sách soil_types từ DB vào cache
 * 2. Cung cấp danh sách tên chuẩn cho AI prompt
 * 3. Hậu xử lý: Map tên AI trả về -> code DB (sử dụng string matching)
 */
@Service
public class SoilTypeMappingService {

    private static final Logger logger = LoggerFactory.getLogger(SoilTypeMappingService.class);

    private final SoilTypeRepository soilTypeRepository;

    // Cache: code -> SoilType entity
    private final Map<String, SoilType> codeToSoilType = new ConcurrentHashMap<>();
    
    // Cache: normalized name -> code (for fast lookup)
    private final Map<String, String> normalizedNameToCode = new ConcurrentHashMap<>();
    
    // Cache: keywords -> code (for fuzzy matching)
    private final Map<String, String> keywordsToCode = new ConcurrentHashMap<>();
    
    // Danh sách tên chuẩn để đưa vào prompt AI
    private List<String> standardNames = new ArrayList<>();

    // Code mặc định khi không tìm thấy mapping
    private static final String DEFAULT_CODE = "NKH"; // Nông nghiệp khác
    private static final String DEFAULT_SOIL_NAME = "Đất chưa phân loại";

    public SoilTypeMappingService(SoilTypeRepository soilTypeRepository) {
        this.soilTypeRepository = soilTypeRepository;
    }

    /**
     * Load dữ liệu từ DB vào cache khi khởi động
     */
    @PostConstruct
    public void initializeCache() {
        logger.info("Initializing SoilType mapping cache...");
        reloadCache();
    }

    /**
     * Reload cache từ database (có thể gọi khi cần refresh)
     */
    public void reloadCache() {
        try {
            List<SoilType> allSoilTypes = soilTypeRepository.findAll();
            
            codeToSoilType.clear();
            normalizedNameToCode.clear();
            keywordsToCode.clear();
            standardNames.clear();

            for (SoilType st : allSoilTypes) {
                String code = st.getCode().toUpperCase();
                
                // 1. Code -> Entity
                codeToSoilType.put(code, st);
                
                // 2. Normalized name -> Code (exact match)
                String normalizedName = normalizeText(st.getName());
                normalizedNameToCode.put(normalizedName, code);
                
                // 3. Thêm tên chuẩn vào danh sách
                standardNames.add(st.getName());
                
                // 4. Extract keywords cho fuzzy matching
                extractAndMapKeywords(st.getName(), code);
                extractAndMapKeywords(st.getDescription(), code);
            }
            
            // Thêm các alias phổ biến
            addCommonAliases();

            logger.info("Loaded {} soil types into cache. Keywords mappings: {}", 
                    codeToSoilType.size(), keywordsToCode.size());
            
        } catch (Exception e) {
            logger.error("Failed to load SoilType cache: {}", e.getMessage(), e);
        }
    }

    /**
     * Thêm các alias/synonym phổ biến mà AI có thể trả về
     */
    private void addCommonAliases() {
        // Đất phù sa
        keywordsToCode.put("phu sa", "PS");
        keywordsToCode.put("phusa", "PS");
        keywordsToCode.put("alluvial", "PS");
        keywordsToCode.put("phu sa song", "PS");
        keywordsToCode.put("dat phu sa song", "PS");
        
        // Đất phù sa glây
        keywordsToCode.put("phu sa glay", "PSG");
        keywordsToCode.put("phu sa ngap", "PSG");
        
        // Đất phù sa ngọt
        keywordsToCode.put("phu sa ngot", "PSN");
        keywordsToCode.put("ngot", "PSN");
        
        // Đất phù sa mặn
        keywordsToCode.put("phu sa man", "PSM");
        
        // Đất phèn
        keywordsToCode.put("phen", "PH");
        keywordsToCode.put("dat phen", "PH");
        keywordsToCode.put("acid sulfate", "PH");
        keywordsToCode.put("chua phen", "PH");
        
        // Đất phèn tiềm tàng
        keywordsToCode.put("phen tiem tang", "PHT");
        
        // Đất phèn hoạt động
        keywordsToCode.put("phen hoat dong", "PHH");
        keywordsToCode.put("phen nang", "PHH");
        
        // Đất phèn cải tạo
        keywordsToCode.put("phen cai tao", "PHCL");
        keywordsToCode.put("phen da cai tao", "PHCL");
        
        // Đất mặn
        keywordsToCode.put("man", "M");
        keywordsToCode.put("dat man", "M");
        keywordsToCode.put("saline", "M");
        keywordsToCode.put("nhiem man", "M");
        
        // Đất mặn nhiều
        keywordsToCode.put("man nhieu", "MN");
        keywordsToCode.put("man nang", "MN");
        
        // Đất mặn ít
        keywordsToCode.put("man it", "MIT");
        keywordsToCode.put("man nhe", "MIT");
        keywordsToCode.put("it man", "MIT");
        
        // Đất cát
        keywordsToCode.put("cat", "C");
        keywordsToCode.put("dat cat", "C");
        keywordsToCode.put("sandy", "C");
        
        // Đất cát giồng
        keywordsToCode.put("cat giong", "CG");
        keywordsToCode.put("giong cat", "CG");
        
        // Đất than bùn
        keywordsToCode.put("than bun", "TB");
        keywordsToCode.put("bun", "TB");
        keywordsToCode.put("peat", "TB");
        
        // Đất xám
        keywordsToCode.put("xam", "X");
        keywordsToCode.put("dat xam", "X");
        keywordsToCode.put("gray", "X");
        
        // Đất đỏ vàng
        keywordsToCode.put("do vang", "DV");
        keywordsToCode.put("dat do", "DV");
        keywordsToCode.put("ferralsol", "DV");
    }

    /**
     * Extract keywords từ text và map về code
     */
    private void extractAndMapKeywords(String text, String code) {
        if (text == null || text.isEmpty()) return;
        
        String normalized = normalizeText(text);
        
        // Split thành các từ/cụm từ
        String[] words = normalized.split("\\s+");
        
        // Map từng từ quan trọng
        for (String word : words) {
            if (word.length() >= 3 && !isStopWord(word)) {
                // Không ghi đè nếu đã có mapping khác
                keywordsToCode.putIfAbsent(word, code);
            }
        }
        
        // Map cả cụm 2-3 từ liên tiếp
        for (int i = 0; i < words.length - 1; i++) {
            String biGram = words[i] + " " + words[i + 1];
            keywordsToCode.putIfAbsent(biGram, code);
            
            if (i < words.length - 2) {
                String triGram = biGram + " " + words[i + 2];
                keywordsToCode.putIfAbsent(triGram, code);
            }
        }
    }

    /**
     * Kiểm tra stop words tiếng Việt
     */
    private boolean isStopWord(String word) {
        Set<String> stopWords = Set.of(
            "dat", "loai", "vung", "khu", "nong", "nghiep", "san", "xuat",
            "trong", "trot", "cay", "lua", "mau", "va", "cua", "cho",
            "co", "the", "duoc", "nhieu", "it", "cao", "thap"
        );
        return stopWords.contains(word);
    }

    /**
     * Normalize text: bỏ dấu, lowercase, trim
     */
    public String normalizeText(String text) {
        if (text == null) return "";
        
        // Lowercase
        String result = text.toLowerCase().trim();
        
        // Remove Vietnamese diacritics
        result = Normalizer.normalize(result, Normalizer.Form.NFD);
        Pattern pattern = Pattern.compile("\\p{InCombiningDiacriticalMarks}+");
        result = pattern.matcher(result).replaceAll("");
        
        // Remove special characters, keep only alphanumeric and spaces
        result = result.replaceAll("[^a-z0-9\\s]", " ");
        
        // Collapse multiple spaces
        result = result.replaceAll("\\s+", " ").trim();
        
        return result;
    }

    /**
     * CORE METHOD: Map tên loại đất từ AI -> Code DB
     * Sử dụng multi-strategy matching:
     * 1. Exact match (sau normalize)
     * 2. Contains match
     * 3. Keyword match
     * 4. Fuzzy match (Levenshtein)
     * 
     * @param aiSoilName Tên loại đất do AI trả về
     * @return Mã code trong DB, hoặc null nếu không tìm thấy
     */
    public String mapAiNameToCode(String aiSoilName) {
        if (aiSoilName == null || aiSoilName.trim().isEmpty()) {
            return null;
        }
        
        String normalized = normalizeText(aiSoilName);
        logger.debug("Mapping AI soil name: '{}' -> normalized: '{}'", aiSoilName, normalized);

        // Strategy 1: Exact match với normalized name
        if (normalizedNameToCode.containsKey(normalized)) {
            String code = normalizedNameToCode.get(normalized);
            logger.debug("  -> Exact match found: {}", code);
            return code;
        }

        // Strategy 2: Contains match - kiểm tra AI name có chứa standard name không
        for (Map.Entry<String, String> entry : normalizedNameToCode.entrySet()) {
            if (normalized.contains(entry.getKey()) || entry.getKey().contains(normalized)) {
                logger.debug("  -> Contains match found: {} (via {})", entry.getValue(), entry.getKey());
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
            logger.debug("  -> Keyword match found: {} (keyword length: {})", bestMatch, bestMatchLength);
            return bestMatch;
        }

        // Strategy 4: Fuzzy match với Levenshtein distance
        String fuzzyMatch = findBestFuzzyMatch(normalized);
        if (fuzzyMatch != null) {
            logger.debug("  -> Fuzzy match found: {}", fuzzyMatch);
            return fuzzyMatch;
        }

        logger.warn("  -> No match found for: '{}'", aiSoilName);
        return null;
    }

    /**
     * Tìm best match bằng Levenshtein distance
     * Chỉ accept nếu similarity >= 70%
     */
    private String findBestFuzzyMatch(String normalized) {
        String bestCode = null;
        double bestSimilarity = 0.7; // Threshold 70%
        
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
     * Calculate similarity ratio (0.0 - 1.0) using Levenshtein distance
     */
    private double calculateSimilarity(String s1, String s2) {
        int maxLen = Math.max(s1.length(), s2.length());
        if (maxLen == 0) return 1.0;
        
        int distance = levenshteinDistance(s1, s2);
        return 1.0 - ((double) distance / maxLen);
    }

    /**
     * Levenshtein distance implementation
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
     * Lấy SoilType entity từ code
     */
    public Optional<SoilType> getSoilTypeByCode(String code) {
        if (code == null) return Optional.empty();
        return Optional.ofNullable(codeToSoilType.get(code.toUpperCase()));
    }

    /**
     * Lấy SoilType từ tên AI (kết hợp mapping)
     */
    public Optional<SoilType> getSoilTypeByAiName(String aiName) {
        String code = mapAiNameToCode(aiName);
        if (code != null) {
            return getSoilTypeByCode(code);
        }
        return Optional.empty();
    }

    /**
     * Lấy danh sách tên chuẩn để đưa vào prompt AI
     */
    public List<String> getStandardSoilNames() {
        return Collections.unmodifiableList(standardNames);
    }

    /**
     * Lấy danh sách tên theo category
     */
    public List<String> getSoilNamesByCategory(String category) {
        return codeToSoilType.values().stream()
                .filter(st -> st.getCategory().equalsIgnoreCase(category))
                .map(SoilType::getName)
                .collect(Collectors.toList());
    }

    /**
     * Format danh sách cho prompt AI (grouped by category)
     */
    public String formatSoilTypesForPrompt() {
        StringBuilder sb = new StringBuilder();
        
        // Group by category
        Map<String, List<SoilType>> byCategory = codeToSoilType.values().stream()
                .collect(Collectors.groupingBy(SoilType::getCategory));
        
        for (Map.Entry<String, List<SoilType>> entry : byCategory.entrySet()) {
            sb.append("- ").append(entry.getKey()).append(": ");
            String names = entry.getValue().stream()
                    .map(SoilType::getName)
                    .collect(Collectors.joining(", "));
            sb.append(names).append("\n");
        }
        
        return sb.toString();
    }

    /**
     * Lấy mã mặc định
     */
    public String getDefaultCode() {
        return DEFAULT_CODE;
    }

    /**
     * Lấy tên mặc định
     */
    public String getDefaultSoilName() {
        return DEFAULT_SOIL_NAME;
    }

    /**
     * Kiểm tra code có hợp lệ không
     */
    public boolean isValidCode(String code) {
        return code != null && codeToSoilType.containsKey(code.toUpperCase());
    }

    /**
     * Thống kê cache
     */
    public Map<String, Object> getCacheStats() {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalSoilTypes", codeToSoilType.size());
        stats.put("totalNameMappings", normalizedNameToCode.size());
        stats.put("totalKeywordMappings", keywordsToCode.size());
        stats.put("categories", codeToSoilType.values().stream()
                .map(SoilType::getCategory)
                .distinct()
                .collect(Collectors.toList()));
        return stats;
    }
}
