package com.agriplanner.controller;

import com.agriplanner.model.IrrigationSchedule;
import com.agriplanner.repository.IrrigationScheduleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

/**
 * REST Controller for Irrigation Schedules
 */
@RestController
@RequestMapping("/api/irrigation")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@SuppressWarnings("null")
public class IrrigationController {

    private final IrrigationScheduleRepository irrigationRepository;

    @GetMapping("/field/{fieldId}")
    public ResponseEntity<List<IrrigationSchedule>> getByField(@PathVariable Long fieldId) {
        return ResponseEntity.ok(irrigationRepository.findByFieldId(fieldId));
    }

    @GetMapping("/field/{fieldId}/active")
    public ResponseEntity<?> getActiveSchedule(@PathVariable Long fieldId) {
        return irrigationRepository.findByFieldIdAndIsActiveTrue(fieldId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> request) {
        try {
            IrrigationSchedule schedule = IrrigationSchedule.builder()
                    .fieldId(Long.valueOf(request.get("fieldId").toString()))
                    .scheduleType((String) request.get("scheduleType"))
                    .timeOfDay(request.get("timeOfDay") != null
                            ? LocalTime.parse(request.get("timeOfDay").toString())
                            : LocalTime.of(6, 0))
                    .durationMinutes(request.get("durationMinutes") != null
                            ? Integer.parseInt(request.get("durationMinutes").toString())
                            : 30)
                    .waterAmountLiters(request.get("waterAmountLiters") != null
                            ? new BigDecimal(request.get("waterAmountLiters").toString())
                            : null)
                    .notes((String) request.get("notes"))
                    .build();
            return ResponseEntity.ok(irrigationRepository.save(schedule));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        return irrigationRepository.findById(id)
                .map(schedule -> {
                    if (request.containsKey("scheduleType")) {
                        schedule.setScheduleType((String) request.get("scheduleType"));
                    }
                    if (request.containsKey("timeOfDay")) {
                        schedule.setTimeOfDay(LocalTime.parse(request.get("timeOfDay").toString()));
                    }
                    if (request.containsKey("durationMinutes")) {
                        schedule.setDurationMinutes(Integer.parseInt(request.get("durationMinutes").toString()));
                    }
                    if (request.containsKey("isActive")) {
                        schedule.setIsActive(Boolean.parseBoolean(request.get("isActive").toString()));
                    }
                    if (request.containsKey("notes")) {
                        schedule.setNotes((String) request.get("notes"));
                    }
                    return ResponseEntity.ok(irrigationRepository.save(schedule));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/toggle")
    public ResponseEntity<?> toggleActive(@PathVariable Long id) {
        return irrigationRepository.findById(id)
                .map(schedule -> {
                    schedule.setIsActive(!schedule.getIsActive());
                    return ResponseEntity.ok(irrigationRepository.save(schedule));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        irrigationRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Deleted successfully"));
    }
}
