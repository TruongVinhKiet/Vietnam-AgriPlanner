package com.agriplanner.controller;

import com.agriplanner.model.SalaryPayment;
import com.agriplanner.model.SalarySetting;
import com.agriplanner.repository.SalaryPaymentRepository;
import com.agriplanner.repository.SalarySettingRepository;
import com.agriplanner.service.PayrollService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/payroll")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@SuppressWarnings("null")
public class PayrollController {

    private final PayrollService payrollService;
    private final SalarySettingRepository salarySettingRepository;
    private final SalaryPaymentRepository salaryPaymentRepository;

    @PostMapping("/settings")
    public ResponseEntity<?> upsertSetting(@RequestBody Map<String, Object> request) {
        try {
            Long farmId = Long.valueOf(request.get("farmId").toString());
            Long ownerId = Long.valueOf(request.get("ownerId").toString());
            Long workerId = Long.valueOf(request.get("workerId").toString());

            BigDecimal salaryAmount = request.get("salaryAmount") != null
                    ? new BigDecimal(request.get("salaryAmount").toString())
                    : null;

            Integer payDayOfMonth = request.get("payDayOfMonth") != null
                    ? Integer.valueOf(request.get("payDayOfMonth").toString())
                    : null;

            Boolean isActive = request.get("isActive") != null
                    ? Boolean.valueOf(request.get("isActive").toString())
                    : null;

            SalarySetting setting = payrollService.upsertSalarySetting(farmId, ownerId, workerId, salaryAmount,
                    payDayOfMonth, isActive);
            return ResponseEntity.ok(setting);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/settings/owner/{ownerId}")
    public ResponseEntity<List<SalarySetting>> getSettingsByOwner(@PathVariable Long ownerId) {
        return ResponseEntity.ok(salarySettingRepository.findByOwner_Id(ownerId));
    }

    @GetMapping("/settings/worker/{workerId}")
    public ResponseEntity<List<SalarySetting>> getSettingsByWorker(@PathVariable Long workerId) {
        return ResponseEntity.ok(salarySettingRepository.findByWorker_Id(workerId));
    }

    @PostMapping("/settings/{settingId}/pay")
    public ResponseEntity<?> manualPay(@PathVariable Long settingId) {
        try {
            SalaryPayment payment = payrollService.paySalary(settingId);
            return ResponseEntity.ok(payment);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/payments/owner/{ownerId}")
    public ResponseEntity<List<SalaryPayment>> getPaymentsByOwner(@PathVariable Long ownerId) {
        return ResponseEntity.ok(salaryPaymentRepository.findByOwner_IdOrderByPaidAtDesc(ownerId));
    }

    @GetMapping("/payments/worker/{workerId}")
    public ResponseEntity<List<SalaryPayment>> getPaymentsByWorker(@PathVariable Long workerId) {
        return ResponseEntity.ok(salaryPaymentRepository.findByWorker_IdOrderByPaidAtDesc(workerId));
    }
}
