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
import java.time.LocalDate;
import java.time.LocalDateTime;
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
            Integer payDayOfMonth, Boolean isActive) {
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
        setting.setPayDayOfMonth(payDayOfMonth != null ? payDayOfMonth : 1);
        setting.setIsActive(isActive != null ? isActive : Boolean.TRUE);

        return salarySettingRepository.save(setting);
    }

    @Scheduled(cron = "0 5 0 * * *")
    @Transactional
    public void autoPaySalaries() {
        LocalDate today = LocalDate.now();
        List<SalarySetting> settings = salarySettingRepository.findByIsActiveTrue();

        for (SalarySetting setting : settings) {
            if (setting.getPayDayOfMonth() == null || setting.getSalaryAmount() == null) {
                continue;
            }
            if (today.getDayOfMonth() != setting.getPayDayOfMonth()) {
                continue;
            }

            LocalDateTime lastPaidAt = setting.getLastPaidAt();
            if (lastPaidAt != null && lastPaidAt.getYear() == today.getYear()
                    && lastPaidAt.getMonthValue() == today.getMonthValue()) {
                continue;
            }

            paySalary(setting.getId());
        }
    }

    @Transactional
    public SalaryPayment paySalary(Long salarySettingId) {
        SalarySetting setting = salarySettingRepository.findById(Objects.requireNonNull(salarySettingId))
                .orElseThrow(() -> new RuntimeException("Salary setting not found"));

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

        SalaryPayment payment = SalaryPayment.builder()
                .salarySetting(setting)
                .farm(setting.getFarm())
                .owner(owner)
                .worker(worker)
                .amount(amount)
                .payPeriodStart(LocalDate.now().withDayOfMonth(1))
                .payPeriodEnd(LocalDate.now().withDayOfMonth(LocalDate.now().lengthOfMonth()))
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
}
