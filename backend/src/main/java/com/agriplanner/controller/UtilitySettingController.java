package com.agriplanner.controller;

import com.agriplanner.model.Farm;
import com.agriplanner.model.SalarySetting;
import com.agriplanner.model.UtilitySetting;
import com.agriplanner.repository.FarmRepository;
import com.agriplanner.repository.FieldRepository;
import com.agriplanner.repository.PenRepository;
import com.agriplanner.repository.SalarySettingRepository;
import com.agriplanner.repository.UserRepository;
import com.agriplanner.repository.UtilitySettingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * REST Controller for Utility Settings (Electricity & Water)
 * Manages power consumption and water usage configuration per pen or field.
 */
@RestController
@RequestMapping("/api/utility-settings")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
@SuppressWarnings("null")
public class UtilitySettingController {

    private final UtilitySettingRepository utilitySettingRepository;
    private final PenRepository penRepository;
    private final FieldRepository fieldRepository;
    private final SalarySettingRepository salarySettingRepository;
    private final FarmRepository farmRepository;
    private final UserRepository userRepository;

    // ==================== PEN ENDPOINTS ====================

    /**
     * Get utility setting for a specific pen.
     */
    @GetMapping("/pen/{penId}")
    public ResponseEntity<?> getByPen(@PathVariable Long penId) {
        return utilitySettingRepository.findByPenId(penId)
                .map(s -> ResponseEntity.ok((Object) s))
                .orElseGet(() -> {
                    UtilitySetting defaults = new UtilitySetting();
                    defaults.setPenId(penId);
                    defaults.setPowerKw(BigDecimal.ZERO);
                    defaults.setElectricityRate(new BigDecimal("3000"));
                    defaults.setWaterM3PerDay(BigDecimal.ZERO);
                    defaults.setWaterRate(new BigDecimal("12000"));
                    defaults.setHoursPerDay(12);
                    return ResponseEntity.ok(defaults);
                });
    }

    /**
     * Create or update utility setting for a pen.
     */
    @PutMapping("/pen/{penId}")
    public ResponseEntity<?> upsertPen(@PathVariable Long penId, @RequestBody Map<String, Object> request) {
        try {
            if (!penRepository.existsById(penId)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Pen not found: " + penId));
            }

            UtilitySetting setting = utilitySettingRepository.findByPenId(penId)
                    .orElseGet(() -> {
                        UtilitySetting s = new UtilitySetting();
                        s.setPenId(penId);
                        return s;
                    });

            penRepository.findById(penId).ifPresent(pen -> setting.setFarmId(pen.getFarmId()));
            applySettings(setting, request);

            ResponseEntity<?> validation = validateSetting(setting);
            if (validation != null)
                return validation;

            UtilitySetting saved = utilitySettingRepository.save(setting);
            log.info("Saved utility setting for pen {}: elec={}kW*{}h, water={}m³/day",
                    penId, saved.getPowerKw(), saved.getHoursPerDay(), saved.getWaterM3PerDay());
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            log.error("Error saving utility setting for pen {}", penId, e);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Delete utility setting for a pen.
     */
    @DeleteMapping("/pen/{penId}")
    public ResponseEntity<?> deleteByPen(@PathVariable Long penId) {
        utilitySettingRepository.findByPenId(penId).ifPresent(utilitySettingRepository::delete);
        return ResponseEntity.ok(Map.of("message", "Deleted utility setting for pen " + penId));
    }

    /**
     * Get monthly cost estimate for a specific pen.
     */
    @GetMapping("/pen/{penId}/estimate")
    public ResponseEntity<?> getPenEstimate(@PathVariable Long penId) {
        return utilitySettingRepository.findByPenId(penId)
                .map(setting -> ResponseEntity.ok(buildEstimate(setting)))
                .orElse(ResponseEntity.notFound().build());
    }

    // ==================== FIELD ENDPOINTS ====================

    /**
     * Get utility setting for a specific field (cultivation).
     */
    @GetMapping("/field/{fieldId}")
    public ResponseEntity<?> getByField(@PathVariable Long fieldId) {
        return utilitySettingRepository.findByFieldId(fieldId)
                .map(s -> ResponseEntity.ok((Object) s))
                .orElseGet(() -> {
                    UtilitySetting defaults = new UtilitySetting();
                    defaults.setFieldId(fieldId);
                    defaults.setPowerKw(BigDecimal.ZERO);
                    defaults.setElectricityRate(new BigDecimal("3000"));
                    defaults.setWaterM3PerDay(BigDecimal.ZERO);
                    defaults.setWaterRate(new BigDecimal("12000"));
                    defaults.setHoursPerDay(12);
                    return ResponseEntity.ok(defaults);
                });
    }

    /**
     * Create or update utility setting for a field.
     */
    @PutMapping("/field/{fieldId}")
    public ResponseEntity<?> upsertField(@PathVariable Long fieldId, @RequestBody Map<String, Object> request) {
        try {
            if (!fieldRepository.existsById(fieldId)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Field not found: " + fieldId));
            }

            UtilitySetting setting = utilitySettingRepository.findByFieldId(fieldId)
                    .orElseGet(() -> {
                        UtilitySetting s = new UtilitySetting();
                        s.setFieldId(fieldId);
                        return s;
                    });

            fieldRepository.findById(fieldId).ifPresent(field -> setting.setFarmId(field.getFarmId()));
            applySettings(setting, request);

            ResponseEntity<?> validation = validateSetting(setting);
            if (validation != null)
                return validation;

            UtilitySetting saved = utilitySettingRepository.save(setting);
            log.info("Saved utility setting for field {}: elec={}kW*{}h, water={}m³/day",
                    fieldId, saved.getPowerKw(), saved.getHoursPerDay(), saved.getWaterM3PerDay());
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            log.error("Error saving utility setting for field {}", fieldId, e);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== FARM-LEVEL ENDPOINTS ====================

    /**
     * Get all utility settings for a farm.
     */
    @GetMapping("/farm/{farmId}")
    public ResponseEntity<List<UtilitySetting>> getByFarm(@PathVariable Long farmId) {
        return ResponseEntity.ok(utilitySettingRepository.findByFarmId(farmId));
    }

    /**
     * Get total monthly utility cost for an entire farm.
     */
    @GetMapping("/farm/{farmId}/total")
    public ResponseEntity<?> getFarmTotal(@PathVariable Long farmId) {
        List<UtilitySetting> settings = utilitySettingRepository.findByFarmId(farmId);
        BigDecimal totalElec = BigDecimal.ZERO;
        BigDecimal totalWater = BigDecimal.ZERO;

        for (UtilitySetting s : settings) {
            totalElec = totalElec.add(s.getMonthlyElectricityCost());
            totalWater = totalWater.add(s.getMonthlyWaterCost());
        }

        return ResponseEntity.ok(Map.of(
                "farmId", farmId,
                "settingCount", settings.size(),
                "monthlyElectricity", totalElec,
                "monthlyWater", totalWater,
                "monthlyTotal", totalElec.add(totalWater)));
    }

    /**
     * Get fixed monthly costs for a farm — utility (farming + livestock) + payroll.
     * Used by the analytics page "Phân tích nâng cao" section.
     */
    @GetMapping("/farm/{farmId}/fixed-costs")
    public ResponseEntity<?> getFixedCosts(@PathVariable Long farmId) {
        // Farming utility costs (field-based)
        List<UtilitySetting> fieldSettings = utilitySettingRepository.findByFarmIdAndFieldIdIsNotNull(farmId);
        BigDecimal farmingElec = BigDecimal.ZERO;
        BigDecimal farmingWater = BigDecimal.ZERO;
        for (UtilitySetting s : fieldSettings) {
            farmingElec = farmingElec.add(s.getMonthlyElectricityCost());
            farmingWater = farmingWater.add(s.getMonthlyWaterCost());
        }

        // Livestock utility costs (pen-based)
        List<UtilitySetting> penSettings = utilitySettingRepository.findByFarmIdAndPenIdIsNotNull(farmId);
        BigDecimal livestockElec = BigDecimal.ZERO;
        BigDecimal livestockWater = BigDecimal.ZERO;
        for (UtilitySetting s : penSettings) {
            livestockElec = livestockElec.add(s.getMonthlyElectricityCost());
            livestockWater = livestockWater.add(s.getMonthlyWaterCost());
        }

        // Payroll costs — convert all to monthly
        List<SalarySetting> salarySettings = salarySettingRepository.findByFarm_Id(farmId);
        BigDecimal monthlyPayroll = BigDecimal.ZERO;
        for (SalarySetting ss : salarySettings) {
            if (ss.getIsActive() == null || !ss.getIsActive())
                continue;
            if (ss.getSalaryAmount() == null)
                continue;

            BigDecimal monthlySalary;
            String freq = ss.getPayFrequency() != null ? ss.getPayFrequency().toUpperCase() : "MONTHLY";
            switch (freq) {
                case "DAILY":
                    monthlySalary = ss.getSalaryAmount().multiply(new BigDecimal("30"));
                    break;
                case "WEEKLY":
                    // 4.33 weeks per month
                    monthlySalary = ss.getSalaryAmount().multiply(new BigDecimal("4.33"))
                            .setScale(0, RoundingMode.HALF_UP);
                    break;
                default: // MONTHLY
                    monthlySalary = ss.getSalaryAmount();
                    break;
            }
            monthlyPayroll = monthlyPayroll.add(monthlySalary);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("farmId", farmId);

        // Farming (cultivation)
        result.put("farmingElectricity", farmingElec);
        result.put("farmingWater", farmingWater);
        result.put("farmingUtilityTotal", farmingElec.add(farmingWater));
        result.put("farmingFieldCount", fieldSettings.size());

        // Livestock
        result.put("livestockElectricity", livestockElec);
        result.put("livestockWater", livestockWater);
        result.put("livestockUtilityTotal", livestockElec.add(livestockWater));
        result.put("livestockPenCount", penSettings.size());

        // Payroll
        result.put("monthlyPayroll", monthlyPayroll);
        result.put("workerCount",
                salarySettings.stream().filter(s -> s.getIsActive() != null && s.getIsActive()).count());

        // Grand total
        BigDecimal grandTotal = farmingElec.add(farmingWater)
                .add(livestockElec).add(livestockWater)
                .add(monthlyPayroll);
        result.put("grandTotal", grandTotal);

        return ResponseEntity.ok(result);
    }

    /**
     * Get fixed monthly costs by owner email.
     * The analytics page uses email from JWT to identify the user.
     */
    @GetMapping("/owner/{email}/fixed-costs")
    public ResponseEntity<?> getFixedCostsByOwnerEmail(@PathVariable String email) {
        return userRepository.findByEmail(email)
                .map(user -> {
                    List<Farm> farms = farmRepository.findByOwnerId(user.getId());
                    if (farms.isEmpty()) {
                        Map<String, Object> empty = new HashMap<>();
                        empty.put("farmingElectricity", BigDecimal.ZERO);
                        empty.put("farmingWater", BigDecimal.ZERO);
                        empty.put("farmingUtilityTotal", BigDecimal.ZERO);
                        empty.put("livestockElectricity", BigDecimal.ZERO);
                        empty.put("livestockWater", BigDecimal.ZERO);
                        empty.put("livestockUtilityTotal", BigDecimal.ZERO);
                        empty.put("monthlyPayroll", BigDecimal.ZERO);
                        empty.put("workerCount", 0L);
                        empty.put("grandTotal", BigDecimal.ZERO);
                        return ResponseEntity.ok((Object) empty);
                    }
                    // Use first farm (most users have one farm)
                    Long farmId = farms.get(0).getId();
                    return getFixedCosts(farmId);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // ==================== HELPERS ====================

    private void applySettings(UtilitySetting setting, Map<String, Object> request) {
        if (request.containsKey("powerKw")) {
            setting.setPowerKw(toBigDecimal(request.get("powerKw")));
        }
        if (request.containsKey("electricityRate")) {
            setting.setElectricityRate(toBigDecimal(request.get("electricityRate")));
        }
        if (request.containsKey("waterM3PerDay")) {
            setting.setWaterM3PerDay(toBigDecimal(request.get("waterM3PerDay")));
        }
        if (request.containsKey("waterRate")) {
            setting.setWaterRate(toBigDecimal(request.get("waterRate")));
        }
        if (request.containsKey("hoursPerDay")) {
            setting.setHoursPerDay(toInteger(request.get("hoursPerDay")));
        }
    }

    private ResponseEntity<?> validateSetting(UtilitySetting setting) {
        if (setting.getPowerKw() != null && setting.getPowerKw().compareTo(BigDecimal.ZERO) < 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Công suất điện không được âm"));
        }
        if (setting.getWaterM3PerDay() != null && setting.getWaterM3PerDay().compareTo(BigDecimal.ZERO) < 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Lượng nước không được âm"));
        }
        if (setting.getHoursPerDay() != null && (setting.getHoursPerDay() < 0 || setting.getHoursPerDay() > 24)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Số giờ hoạt động phải từ 0-24"));
        }
        if (setting.getElectricityRate() != null && setting.getElectricityRate().compareTo(BigDecimal.ZERO) < 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Giá điện không được âm"));
        }
        if (setting.getWaterRate() != null && setting.getWaterRate().compareTo(BigDecimal.ZERO) < 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Giá nước không được âm"));
        }
        return null; // valid
    }

    private Map<String, Object> buildEstimate(UtilitySetting setting) {
        Map<String, Object> estimate = new HashMap<>();
        estimate.put("monthlyElectricity", setting.getMonthlyElectricityCost());
        estimate.put("monthlyWater", setting.getMonthlyWaterCost());
        estimate.put("monthlyTotal", setting.getMonthlyTotalCost());
        estimate.put("powerKw", setting.getPowerKw() != null ? setting.getPowerKw() : BigDecimal.ZERO);
        estimate.put("hoursPerDay", setting.getHoursPerDay() != null ? setting.getHoursPerDay() : 0);
        return estimate;
    }

    private BigDecimal toBigDecimal(Object val) {
        if (val == null)
            return BigDecimal.ZERO;
        return new BigDecimal(val.toString());
    }

    private Integer toInteger(Object val) {
        if (val == null)
            return 12;
        return Integer.valueOf(val.toString());
    }
}
