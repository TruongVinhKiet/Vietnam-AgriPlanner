package com.agriplanner.service;

import com.agriplanner.model.AssetTransaction;
import com.agriplanner.model.Farm;
import com.agriplanner.model.SalaryPayment;
import com.agriplanner.model.SalarySetting;
import com.agriplanner.model.User;
import com.agriplanner.repository.AssetTransactionRepository;
import com.agriplanner.repository.FarmRepository;
import com.agriplanner.repository.SalaryPaymentRepository;
import com.agriplanner.repository.SalarySettingRepository;
import com.agriplanner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.TemporalAdjusters;
import java.time.temporal.WeekFields;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class PayrollService {

    private final SalarySettingRepository salarySettingRepository;
    private final SalaryPaymentRepository salaryPaymentRepository;
    private final UserRepository userRepository;
    private final FarmRepository farmRepository;
    private final AssetTransactionRepository assetTransactionRepository;

    @Transactional
    public SalarySetting upsertSalarySetting(Long farmId, Long ownerId, Long workerId, BigDecimal salaryAmount,
            String payFrequency, Integer payDayOfMonth, Integer payDayOfWeek, Boolean isActive) {
        if (farmId == null || ownerId == null || workerId == null) {
            throw new IllegalArgumentException("farmId/ownerId/workerId required");
        }

        Farm farm = farmRepository.findById(Objects.requireNonNull(farmId))
                .orElseThrow(() -> new RuntimeException("Farm not found"));
        User owner = userRepository.findById(Objects.requireNonNull(ownerId))
                .orElseThrow(() -> new RuntimeException("Owner not found"));
        User worker = userRepository.findById(Objects.requireNonNull(workerId))
                .orElseThrow(() -> new RuntimeException("Worker not found"));

        SalarySetting setting = salarySettingRepository.findByFarm_IdAndWorker_Id(farmId, workerId)
                .orElseGet(SalarySetting::new);

        setting.setFarm(farm);
        setting.setOwner(owner);
        setting.setWorker(worker);
        setting.setSalaryAmount(salaryAmount != null ? salaryAmount : BigDecimal.ZERO);

        String normalizedFrequency = normalizePayFrequency(payFrequency);
        setting.setPayFrequency(normalizedFrequency);

        setting.setPayDayOfMonth(payDayOfMonth != null ? payDayOfMonth : 1);

        if ("WEEKLY".equals(normalizedFrequency)) {
            Integer dow = payDayOfWeek != null ? payDayOfWeek : 1;
            int normalizedDow = Math.max(1, Math.min(7, dow));
            setting.setPayDayOfWeek(normalizedDow);
        } else {
            setting.setPayDayOfWeek(payDayOfWeek);
        }
        setting.setIsActive(isActive != null ? isActive : Boolean.TRUE);

        return salarySettingRepository.save(setting);
    }

    @Scheduled(cron = "0 5 0 * * *")
    @Transactional
    public void autoPaySalaries() {
        LocalDate today = LocalDate.now();
        List<SalarySetting> settings = salarySettingRepository.findByIsActiveTrue();

        for (SalarySetting setting : settings) {
            if (setting.getSalaryAmount() == null || setting.getSalaryAmount().compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }

            String frequency = normalizePayFrequency(setting.getPayFrequency());

            if (!isDueForFrequency(setting, today, frequency)) {
                continue;
            }

            LocalDateTime lastPaidAt = setting.getLastPaidAt();
            if (lastPaidAt != null && isSamePayPeriod(lastPaidAt.toLocalDate(), today, frequency)) {
                continue;
            }

            paySalary(setting.getId());
        }
    }

    @Transactional
    public SalaryPayment paySalary(Long salarySettingId) {
        SalarySetting setting = salarySettingRepository.findById(Objects.requireNonNull(salarySettingId))
                .orElseThrow(() -> new RuntimeException("Salary setting not found"));

        String frequency = normalizePayFrequency(setting.getPayFrequency());

        BigDecimal amount = setting.getSalaryAmount() != null ? setting.getSalaryAmount() : BigDecimal.ZERO;
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new RuntimeException("Salary amount must be > 0");
        }

        Long ownerId = setting.getOwner() != null ? setting.getOwner().getId() : null;
        Long workerId = setting.getWorker() != null ? setting.getWorker().getId() : null;
        if (ownerId == null || workerId == null) {
            throw new RuntimeException("Owner/Worker missing");
        }

        User owner = userRepository.findById(ownerId)
                .orElseThrow(() -> new RuntimeException("Owner not found"));
        User worker = userRepository.findById(workerId)
                .orElseThrow(() -> new RuntimeException("Worker not found"));

        BigDecimal ownerBalance = owner.getBalance() != null ? owner.getBalance() : BigDecimal.ZERO;
        LocalDateTime now = LocalDateTime.now();

        LocalDate today = LocalDate.now();
        LocalDate payPeriodStart = today.withDayOfMonth(1);
        LocalDate payPeriodEnd = today.withDayOfMonth(today.lengthOfMonth());
        if ("DAILY".equals(frequency)) {
            payPeriodStart = today;
            payPeriodEnd = today;
        } else if ("WEEKLY".equals(frequency)) {
            LocalDate weekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            payPeriodStart = weekStart;
            payPeriodEnd = weekStart.plusDays(6);
        }

        SalaryPayment payment = SalaryPayment.builder()
                .salarySetting(setting)
                .farm(setting.getFarm())
                .owner(owner)
                .worker(worker)
                .amount(amount)
                .payPeriodStart(payPeriodStart)
                .payPeriodEnd(payPeriodEnd)
                .paidAt(now)
                .build();

        if (ownerBalance.compareTo(amount) < 0) {
            payment.setStatus("FAILED");
            payment.setDescription("Insufficient funds");
            salaryPaymentRepository.save(payment);
            return payment;
        }

        owner.setBalance(ownerBalance.subtract(amount));
        worker.setBalance((worker.getBalance() != null ? worker.getBalance() : BigDecimal.ZERO).add(amount));
        userRepository.save(owner);
        userRepository.save(worker);

        assetTransactionRepository.save(AssetTransaction.builder()
                .userId(ownerId)
                .amount(amount)
                .transactionType("EXPENSE")
                .category("PAYROLL")
                .description("Trả lương cho " + (worker.getFullName() != null ? worker.getFullName() : ("Worker#" + workerId)))
                .build());

        assetTransactionRepository.save(AssetTransaction.builder()
                .userId(workerId)
                .amount(amount)
                .transactionType("INCOME")
                .category("PAYROLL")
                .description("Nhận lương từ " + (owner.getFullName() != null ? owner.getFullName() : ("Owner#" + ownerId)))
                .build());

        payment.setStatus("PAID");
        salaryPaymentRepository.save(payment);

        setting.setLastPaidAt(now);
        salarySettingRepository.save(setting);

        return payment;
    }

    private String normalizePayFrequency(String value) {
        String v = value != null ? value.trim().toUpperCase() : "MONTHLY";
        if (!"DAILY".equals(v) && !"WEEKLY".equals(v) && !"MONTHLY".equals(v)) {
            return "MONTHLY";
        }
        return v;
    }

    private boolean isDueForFrequency(SalarySetting setting, LocalDate today, String frequency) {
        if ("DAILY".equals(frequency)) {
            return true;
        }

        if ("WEEKLY".equals(frequency)) {
            int dow = setting.getPayDayOfWeek() != null ? setting.getPayDayOfWeek() : 1;
            int normalizedDow = Math.max(1, Math.min(7, dow));
            return today.getDayOfWeek().getValue() == normalizedDow;
        }

        int dom = setting.getPayDayOfMonth() != null ? setting.getPayDayOfMonth() : 1;
        int normalizedDom = Math.max(1, Math.min(31, dom));
        int dueDay = Math.min(normalizedDom, today.lengthOfMonth());
        return today.getDayOfMonth() == dueDay;
    }

    private boolean isSamePayPeriod(LocalDate a, LocalDate b, String frequency) {
        if (a == null || b == null) return false;
        if ("DAILY".equals(frequency)) {
            return a.equals(b);
        }
        if ("WEEKLY".equals(frequency)) {
            WeekFields wf = WeekFields.ISO;
            return a.get(wf.weekBasedYear()) == b.get(wf.weekBasedYear())
                    && a.get(wf.weekOfWeekBasedYear()) == b.get(wf.weekOfWeekBasedYear());
        }
        return a.getYear() == b.getYear() && a.getMonthValue() == b.getMonthValue();
    }
}
