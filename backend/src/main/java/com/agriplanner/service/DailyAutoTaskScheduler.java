package com.agriplanner.service;

import com.agriplanner.model.AnimalFeedCompatibility;
import com.agriplanner.model.CropDefinition;
import com.agriplanner.model.Farm;
import com.agriplanner.model.Field;
import com.agriplanner.model.HealthRecord;
import com.agriplanner.model.IrrigationSchedule;
import com.agriplanner.model.PestDetection;
import com.agriplanner.model.Pen;
import com.agriplanner.model.ShopItem;
import com.agriplanner.model.Task;
import com.agriplanner.model.TaskType;
import com.agriplanner.model.User;
import com.agriplanner.repository.AnimalFeedCompatibilityRepository;
import com.agriplanner.repository.CropDefinitionRepository;
import com.agriplanner.repository.FarmRepository;
import com.agriplanner.repository.FieldRepository;
import com.agriplanner.repository.HealthRecordRepository;
import com.agriplanner.repository.IrrigationScheduleRepository;
import com.agriplanner.repository.PenRepository;
import com.agriplanner.repository.PestDetectionRepository;
import com.agriplanner.repository.ShopItemRepository;
import com.agriplanner.repository.TaskRepository;
import com.agriplanner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Objects;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class DailyAutoTaskScheduler {

    private static final List<String> ACTIVE_TASK_STATUSES = List.of("PENDING", "IN_PROGRESS");

    private final FarmRepository farmRepository;
    private final UserRepository userRepository;
    private final FieldRepository fieldRepository;
    private final PenRepository penRepository;
    private final TaskRepository taskRepository;
    private final TaskService taskService;
    private final IrrigationScheduleRepository irrigationScheduleRepository;
    private final AnimalFeedCompatibilityRepository animalFeedCompatibilityRepository;
    private final ShopItemRepository shopItemRepository;
    private final CropDefinitionRepository cropDefinitionRepository;
    private final PestDetectionRepository pestDetectionRepository;
    private final HealthRecordRepository healthRecordRepository;

    @Scheduled(cron = "0 0 7 * * *")
    @Transactional
    public void generateDailyAutoTasks() {
        LocalDate today = LocalDate.now();
        LocalDateTime start = today.atStartOfDay();
        LocalDateTime end = today.plusDays(1).atStartOfDay().minusNanos(1);
        LocalDateTime now = LocalDateTime.now();

        List<Farm> farms = farmRepository.findAll();
        for (Farm farm : farms) {
            Long farmId = farm.getId();
            Long ownerId = farm.getOwnerId();
            if (farmId == null || ownerId == null) {
                continue;
            }

            User owner = userRepository.findById(Objects.requireNonNull(ownerId)).orElse(null);
            if (owner == null) {
                continue;
            }

            List<Field> fields = fieldRepository.findByFarmId(farmId);
            for (Field field : fields) {
                if (field.getId() == null) {
                    continue;
                }

                createFieldCheckTaskIfMissing(farm, owner, field, start, end, today, now);
                createWaterTaskIfNeeded(farm, owner, field, start, end, today, now);
                createFertilizeTaskIfNeeded(farm, owner, field, today, now);
                createSeedTaskIfNeeded(farm, owner, field, today, now);
                createPestControlTaskIfNeeded(farm, owner, field, start, end, today, now);
                createHarvestTaskIfNeeded(farm, owner, field, today, now);
            }

            List<Pen> pens = penRepository.findByFarmId(farmId);
            for (Pen pen : pens) {
                if (pen.getId() == null) {
                    continue;
                }

                createPenCheckTaskIfMissing(farm, owner, pen, start, end, today, now);
                createCleanTaskIfNeeded(farm, owner, pen, start, end, today, now);
                createFeedTaskIfNeeded(farm, owner, pen, start, end, today, now);
                createVaccinateTaskIfNeeded(farm, owner, pen, today, now);
            }
        }

        log.info("DailyAutoTaskScheduler completed for {} farms", farms.size());
    }

    private void createFieldCheckTaskIfMissing(Farm farm, User owner, Field field, LocalDateTime start, LocalDateTime end,
            LocalDate today, LocalDateTime now) {
        boolean exists = taskRepository.existsByFarm_IdAndTaskTypeAndField_IdAndIsAutoCreatedTrueAndDueDateBetween(
                farm.getId(), TaskType.OTHER, field.getId(), start, end);
        if (exists) {
            return;
        }

        Task task = new Task();
        task.setFarm(farm);
        task.setOwner(owner);
        task.setField(field);
        task.setName("Kiểm tra ruộng: " + field.getName());
        task.setDescription("Hệ thống tự tạo: Kiểm tra tình trạng ruộng hằng ngày.");
        task.setTaskType(TaskType.OTHER);
        task.setPriority("NORMAL");
        task.setStatus("PENDING");
        task.setIsAutoCreated(true);

        LocalDateTime due = LocalDateTime.of(today, LocalTime.of(7, 0));
        if (due.isBefore(now)) {
            due = now.plusMinutes(1);
        }
        task.setDueDate(due);

        taskService.assignTask(task);
    }

    private void createFertilizeTaskIfNeeded(Farm farm, User owner, Field field, LocalDate today, LocalDateTime now) {
        String stage = field.getWorkflowStage();
        if (!"CROP_SELECTED".equals(stage)) {
            return;
        }
        if (field.getCurrentCropId() == null) {
            return;
        }

        boolean exists = taskRepository.existsByFarm_IdAndTaskTypeAndField_IdAndIsAutoCreatedTrueAndStatusIn(
                farm.getId(), TaskType.FERTILIZE, field.getId(), ACTIVE_TASK_STATUSES);
        if (exists) {
            return;
        }

        LocalDateTime due = LocalDateTime.of(today, LocalTime.of(9, 0));
        if (due.isBefore(now)) {
            due = now.plusMinutes(1);
        }

        ShopItem relatedItem = null;
        BigDecimal quantityRequired = null;
        List<ShopItem> fertilizerItems = shopItemRepository.findByCategoryAndIsActiveTrue("PHAN_BON");
        if (fertilizerItems != null && !fertilizerItems.isEmpty()) {
            relatedItem = fertilizerItems.get(0);
            if (field.getAreaSqm() != null && field.getAreaSqm().compareTo(BigDecimal.ZERO) > 0) {
                quantityRequired = field.getAreaSqm()
                        .divide(BigDecimal.valueOf(1000), 2, java.math.RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(10));
            } else {
                quantityRequired = BigDecimal.ONE;
            }
            if (quantityRequired.compareTo(BigDecimal.ONE) < 0) {
                quantityRequired = BigDecimal.ONE;
            }
        }

        Task task = new Task();
        task.setFarm(farm);
        task.setOwner(owner);
        task.setField(field);
        task.setName("Bón phân: " + field.getName());
        task.setDescription("Hệ thống tự tạo: Bón phân theo giai đoạn.");
        task.setTaskType(TaskType.FERTILIZE);
        task.setPriority("NORMAL");
        task.setStatus("PENDING");
        task.setIsAutoCreated(true);
        task.setDueDate(due);

        if (relatedItem != null && relatedItem.getId() != null && quantityRequired != null
                && quantityRequired.compareTo(BigDecimal.ZERO) > 0) {
            task.setRelatedItem(relatedItem);
            task.setQuantityRequired(quantityRequired);
        }

        taskService.assignTask(task);
    }

    private void createSeedTaskIfNeeded(Farm farm, User owner, Field field, LocalDate today, LocalDateTime now) {
        String stage = field.getWorkflowStage();
        if (!"FERTILIZED".equals(stage)) {
            return;
        }
        Long cropId = field.getCurrentCropId();
        if (cropId == null) {
            return;
        }

        boolean exists = taskRepository.existsByFarm_IdAndTaskTypeAndField_IdAndIsAutoCreatedTrueAndStatusIn(
                farm.getId(), TaskType.SEED, field.getId(), ACTIVE_TASK_STATUSES);
        if (exists) {
            return;
        }

        CropDefinition crop = cropDefinitionRepository.findById(cropId).orElse(null);

        int waitDays = 1;
        if (crop != null) {
            boolean isTestCrop = (crop.getGrowthDurationDays() != null && crop.getGrowthDurationDays() == 0)
                    || (crop.getName() != null && crop.getName().contains("Test"));
            if (isTestCrop) {
                waitDays = 0;
            }
        }

        LocalDateTime due = LocalDateTime.of(today, LocalTime.of(10, 0));
        if (field.getLastFertilizedAt() != null) {
            LocalDateTime earliest = field.getLastFertilizedAt().plusDays(waitDays);
            if (earliest.isAfter(due)) {
                due = earliest;
            }
        }
        if (due.isBefore(now)) {
            due = now.plusMinutes(1);
        }

        ShopItem relatedItem = shopItemRepository.findByCropDefinitionId(cropId).orElse(null);
        BigDecimal quantityRequired = null;
        if (crop != null && crop.getSeedsPerSqm() != null && field.getAreaSqm() != null) {
            quantityRequired = crop.getSeedsPerSqm().multiply(field.getAreaSqm());
            if (quantityRequired.compareTo(BigDecimal.ONE) < 0) {
                quantityRequired = BigDecimal.ONE;
            }
        }

        Task task = new Task();
        task.setFarm(farm);
        task.setOwner(owner);
        task.setField(field);
        task.setName("Gieo hạt: " + field.getName());
        task.setDescription("Hệ thống tự tạo: Gieo hạt theo giai đoạn.");
        task.setTaskType(TaskType.SEED);
        task.setPriority("HIGH");
        task.setStatus("PENDING");
        task.setIsAutoCreated(true);
        task.setDueDate(due);

        if (relatedItem != null && relatedItem.getId() != null && quantityRequired != null
                && quantityRequired.compareTo(BigDecimal.ZERO) > 0) {
            task.setRelatedItem(relatedItem);
            task.setQuantityRequired(quantityRequired);
        }

        taskService.assignTask(task);
    }

    private void createPestControlTaskIfNeeded(Farm farm, User owner, Field field, LocalDateTime start,
            LocalDateTime end, LocalDate today, LocalDateTime now) {
        String stage = field.getWorkflowStage();
        if (stage == null) {
            return;
        }
        if (!"SEEDED".equals(stage) && !"GROWING".equals(stage) && !"READY_HARVEST".equals(stage)) {
            return;
        }

        boolean alreadyActive = taskRepository.existsByFarm_IdAndTaskTypeAndField_IdAndIsAutoCreatedTrueAndStatusIn(
                farm.getId(), TaskType.PEST_CONTROL, field.getId(), ACTIVE_TASK_STATUSES);
        if (alreadyActive) {
            return;
        }

        List<PestDetection> activeDetections = pestDetectionRepository
                .findByFieldIdAndResolvedAtIsNull(field.getId());
        PestDetection firstDetection = (activeDetections != null && !activeDetections.isEmpty()) ? activeDetections.get(0)
                : null;
        boolean hasActivePests = firstDetection != null;

        CropDefinition crop = null;
        Long cropId = field.getCurrentCropId();
        if (cropId != null) {
            crop = cropDefinitionRepository.findById(cropId).orElse(null);
        }

        int intervalDays = 14;
        if (crop != null && crop.getPesticideIntervalDays() != null && crop.getPesticideIntervalDays() > 0) {
            intervalDays = crop.getPesticideIntervalDays();
        }

        LocalDateTime dueCandidate;
        String description;
        String priority;

        if (hasActivePests) {
            dueCandidate = LocalDateTime.of(today, LocalTime.of(8, 30));
            priority = "HIGH";

            String pestName = firstDetection.getPestName() != null ? firstDetection.getPestName() : "sâu bệnh";
            description = "Hệ thống tự tạo: Phun thuốc do phát hiện sâu bệnh (" + pestName + ").";
        } else {
            if (field.getLastPesticideAt() != null) {
                dueCandidate = field.getLastPesticideAt().plusDays(intervalDays);
            } else {
                dueCandidate = LocalDateTime.of(today, LocalTime.of(8, 30));
            }

            if (dueCandidate.isAfter(end)) {
                return;
            }
            priority = "NORMAL";
            description = "Hệ thống tự tạo: Phun thuốc theo định kỳ.";
        }

        LocalDateTime due = dueCandidate;
        if (due.isBefore(now)) {
            due = now.plusMinutes(1);
        }

        ShopItem relatedItem = null;
        BigDecimal quantityRequired = null;

        if (hasActivePests) {
            String keyword = firstDetection.getPestName();
            if (keyword != null && !keyword.isBlank()) {
                List<ShopItem> byKeyword = shopItemRepository.searchByKeyword(keyword);
                if (byKeyword != null) {
                    for (ShopItem it : byKeyword) {
                        if (it != null && "THUOC_TRU_SAU".equals(it.getCategory())) {
                            relatedItem = it;
                            break;
                        }
                    }
                }
            }
        }

        if (relatedItem == null) {
            List<ShopItem> pesticideItems = shopItemRepository.findByCategoryAndIsActiveTrue("THUOC_TRU_SAU");
            if (pesticideItems != null && !pesticideItems.isEmpty()) {
                relatedItem = pesticideItems.get(0);
            }
        }

        if (field.getAreaSqm() != null && field.getAreaSqm().compareTo(BigDecimal.ZERO) > 0) {
            quantityRequired = field.getAreaSqm()
                    .divide(BigDecimal.valueOf(1000), 2, java.math.RoundingMode.CEILING);
            if (quantityRequired.compareTo(BigDecimal.ONE) < 0) {
                quantityRequired = BigDecimal.ONE;
            }
        } else {
            quantityRequired = BigDecimal.ONE;
        }

        Task task = new Task();
        task.setFarm(farm);
        task.setOwner(owner);
        task.setField(field);
        task.setName("Phun thuốc: " + field.getName());
        task.setDescription(description);
        task.setTaskType(TaskType.PEST_CONTROL);
        task.setPriority(priority);
        task.setStatus("PENDING");
        task.setIsAutoCreated(true);
        task.setDueDate(due);

        if (relatedItem != null && relatedItem.getId() != null && quantityRequired != null
                && quantityRequired.compareTo(BigDecimal.ZERO) > 0) {
            task.setRelatedItem(relatedItem);
            task.setQuantityRequired(quantityRequired);
        }

        taskService.assignTask(task);
    }

    private void createHarvestTaskIfNeeded(Farm farm, User owner, Field field, LocalDate today, LocalDateTime now) {
        if (field.getExpectedHarvestDate() == null) {
            return;
        }

        String stage = field.getWorkflowStage();
        if (stage == null) {
            return;
        }
        if (!"SEEDED".equals(stage) && !"GROWING".equals(stage) && !"READY_HARVEST".equals(stage)) {
            return;
        }

        if (field.getExpectedHarvestDate().isAfter(today)) {
            return;
        }

        boolean exists = taskRepository.existsByFarm_IdAndTaskTypeAndField_IdAndIsAutoCreatedTrueAndStatusIn(
                farm.getId(), TaskType.HARVEST, field.getId(), ACTIVE_TASK_STATUSES);
        if (exists) {
            return;
        }

        LocalDateTime due = LocalDateTime.of(today, LocalTime.of(15, 0));
        if (due.isBefore(now)) {
            due = now.plusMinutes(1);
        }

        Task task = new Task();
        task.setFarm(farm);
        task.setOwner(owner);
        task.setField(field);
        task.setName("Thu hoạch: " + field.getName());
        task.setDescription("Hệ thống tự tạo: Thu hoạch (đến hạn).");
        task.setTaskType(TaskType.HARVEST);
        task.setPriority("HIGH");
        task.setStatus("PENDING");
        task.setIsAutoCreated(true);
        task.setDueDate(due);

        taskService.assignTask(task);
    }

    private void createWaterTaskIfNeeded(Farm farm, User owner, Field field, LocalDateTime start, LocalDateTime end,
            LocalDate today, LocalDateTime now) {
        String stage = field.getWorkflowStage();
        if (stage == null) {
            return;
        }
        if (!"SEEDED".equals(stage) && !"GROWING".equals(stage) && !"READY_HARVEST".equals(stage)) {
            return;
        }

        boolean exists = taskRepository.existsByFarm_IdAndTaskTypeAndField_IdAndIsAutoCreatedTrueAndDueDateBetween(
                farm.getId(), TaskType.WATER, field.getId(), start, end);
        if (exists) {
            return;
        }

        LocalTime dueTime = LocalTime.of(8, 0);
        Optional<IrrigationSchedule> scheduleOpt = irrigationScheduleRepository.findByFieldIdAndIsActiveTrue(field.getId());
        if (scheduleOpt.isPresent() && scheduleOpt.get().getTimeOfDay() != null) {
            dueTime = scheduleOpt.get().getTimeOfDay();
        }

        LocalDateTime due = LocalDateTime.of(today, dueTime);
        if (due.isBefore(now)) {
            due = now.plusMinutes(1);
        }

        Task task = new Task();
        task.setFarm(farm);
        task.setOwner(owner);
        task.setField(field);
        task.setName("Tưới nước ruộng: " + field.getName());
        task.setDescription("Hệ thống tự tạo: Tưới nước theo lịch.");
        task.setTaskType(TaskType.WATER);
        task.setPriority("NORMAL");
        task.setStatus("PENDING");
        task.setIsAutoCreated(true);
        task.setDueDate(due);

        taskService.assignTask(task);
    }

    private void createPenCheckTaskIfMissing(Farm farm, User owner, Pen pen, LocalDateTime start, LocalDateTime end,
            LocalDate today, LocalDateTime now) {
        boolean exists = taskRepository.existsByFarm_IdAndTaskTypeAndPen_IdAndIsAutoCreatedTrueAndDueDateBetween(
                farm.getId(), TaskType.OTHER, pen.getId(), start, end);
        if (exists) {
            return;
        }

        String code = pen.getCode() != null ? pen.getCode() : ("Pen#" + pen.getId());

        Task task = new Task();
        task.setFarm(farm);
        task.setOwner(owner);
        task.setPen(pen);
        task.setName("Kiểm tra chuồng: " + code);
        task.setDescription("Hệ thống tự tạo: Kiểm tra tình trạng chuồng hằng ngày.");
        task.setTaskType(TaskType.OTHER);
        task.setPriority("NORMAL");
        task.setStatus("PENDING");
        task.setIsAutoCreated(true);

        LocalDateTime due = LocalDateTime.of(today, LocalTime.of(7, 0));
        if (due.isBefore(now)) {
            due = now.plusMinutes(1);
        }
        task.setDueDate(due);

        taskService.assignTask(task);
    }

    private void createCleanTaskIfNeeded(Farm farm, User owner, Pen pen, LocalDateTime start, LocalDateTime end,
            LocalDate today, LocalDateTime now) {
        if (!"DIRTY".equals(pen.getStatus())) {
            return;
        }

        boolean exists = taskRepository.existsByFarm_IdAndTaskTypeAndPen_IdAndIsAutoCreatedTrueAndDueDateBetween(
                farm.getId(), TaskType.CLEAN, pen.getId(), start, end);
        if (exists) {
            return;
        }

        String code = pen.getCode() != null ? pen.getCode() : ("Pen#" + pen.getId());

        LocalDateTime due = LocalDateTime.of(today, LocalTime.of(9, 0));
        if (due.isBefore(now)) {
            due = now.plusMinutes(1);
        }

        Task task = new Task();
        task.setFarm(farm);
        task.setOwner(owner);
        task.setPen(pen);
        task.setName("Dọn chuồng: " + code);
        task.setDescription("Hệ thống tự tạo: Dọn chuồng do trạng thái DIRTY.");
        task.setTaskType(TaskType.CLEAN);
        task.setPriority("HIGH");
        task.setStatus("PENDING");
        task.setIsAutoCreated(true);
        task.setDueDate(due);

        taskService.assignTask(task);
    }

    private void createFeedTaskIfNeeded(Farm farm, User owner, Pen pen, LocalDateTime start, LocalDateTime end,
            LocalDate today, LocalDateTime now) {
        Integer count = pen.getAnimalCount();
        if (count == null || count <= 0) {
            return;
        }

        boolean exists = taskRepository.existsByFarm_IdAndTaskTypeAndPen_IdAndIsAutoCreatedTrueAndDueDateBetween(
                farm.getId(), TaskType.FEED, pen.getId(), start, end);
        if (exists) {
            return;
        }

        LocalDateTime due = null;
        if (pen.getNextFeedingAt() != null) {
            LocalDate nextDate = pen.getNextFeedingAt().toLocalDate();
            if (nextDate.isAfter(today)) {
                return;
            }
            due = pen.getNextFeedingAt();
        } else {
            due = LocalDateTime.of(today, LocalTime.of(8, 0));
        }

        if (due.isBefore(now)) {
            due = now.plusMinutes(1);
        }

        ShopItem relatedItem = null;
        BigDecimal quantityRequired = null;

        if (pen.getAnimalDefinition() != null && pen.getAnimalDefinition().getId() != null) {
            Long animalDefId = pen.getAnimalDefinition().getId();
            List<AnimalFeedCompatibility> compatList = animalFeedCompatibilityRepository
                    .findByAnimalDefinitionIdOrderByIsPrimaryDesc(animalDefId);
            if (!compatList.isEmpty()) {
                AnimalFeedCompatibility compat = compatList.get(0);
                if (compat.getFeedDefinitionId() != null) {
                    relatedItem = shopItemRepository.findByFeedDefinitionId(compat.getFeedDefinitionId()).orElse(null);

                    if (compat.getDailyAmountPerUnit() != null
                            && compat.getDailyAmountPerUnit().compareTo(BigDecimal.ZERO) > 0) {
                        quantityRequired = compat.getDailyAmountPerUnit().multiply(BigDecimal.valueOf(count));
                    }
                }
            }
        }

        String code = pen.getCode() != null ? pen.getCode() : ("Pen#" + pen.getId());

        Task task = new Task();
        task.setFarm(farm);
        task.setOwner(owner);
        task.setPen(pen);
        task.setName("Cho ăn: " + code);
        task.setDescription("Hệ thống tự tạo: Cho ăn cho vật nuôi.");
        task.setTaskType(TaskType.FEED);
        task.setPriority("HIGH");
        task.setStatus("PENDING");
        task.setIsAutoCreated(true);
        task.setDueDate(due);

        if (relatedItem != null && relatedItem.getId() != null && quantityRequired != null
                && quantityRequired.compareTo(BigDecimal.ZERO) > 0) {
            task.setRelatedItem(relatedItem);
            task.setQuantityRequired(quantityRequired);
        }

        taskService.assignTask(task);
    }

    private void createVaccinateTaskIfNeeded(Farm farm, User owner, Pen pen, LocalDate today, LocalDateTime now) {
        Integer count = pen.getAnimalCount();
        if (count == null || count <= 0) {
            return;
        }

        List<HealthRecord> records = healthRecordRepository.findByPenIdOrderByEventDateAsc(pen.getId());
        if (records == null || records.isEmpty()) {
            return;
        }

        HealthRecord next = null;
        for (HealthRecord r : records) {
            if (r == null) {
                continue;
            }
            if (!"VACCINE".equals(r.getEventType())) {
                continue;
            }
            if ("COMPLETED".equals(r.getStatus())) {
                continue;
            }
            next = r;
            break;
        }
        if (next == null || next.getEventDate() == null) {
            return;
        }

        if (next.getEventDate().isAfter(today)) {
            return;
        }

        if (next.getEventDate().isBefore(today) && "PLANNED".equals(next.getStatus())) {
            try {
                next.setStatus("OVERDUE");
                healthRecordRepository.save(next);
            } catch (Exception ignored) {
            }
        }

        boolean exists = taskRepository.existsByFarm_IdAndTaskTypeAndPen_IdAndIsAutoCreatedTrueAndStatusIn(
                farm.getId(), TaskType.VACCINATE, pen.getId(), ACTIVE_TASK_STATUSES);
        if (exists) {
            return;
        }

        String code = pen.getCode() != null ? pen.getCode() : ("Pen#" + pen.getId());
        LocalDateTime due = LocalDateTime.of(today, LocalTime.of(10, 0));
        if (due.isBefore(now)) {
            due = now.plusMinutes(1);
        }

        Task task = new Task();
        task.setFarm(farm);
        task.setOwner(owner);
        task.setPen(pen);
        task.setName("Tiêm phòng: " + code + " - " + next.getName());
        task.setDescription("Hệ thống tự tạo: Lịch tiêm phòng đến hạn (" + next.getEventDate() + ").");
        task.setTaskType(TaskType.VACCINATE);
        task.setPriority("HIGH");
        task.setStatus("PENDING");
        task.setIsAutoCreated(true);
        task.setDueDate(due);

        taskService.assignTask(task);
    }
}
