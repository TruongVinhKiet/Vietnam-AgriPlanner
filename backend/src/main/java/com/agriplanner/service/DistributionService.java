package com.agriplanner.service;

import com.agriplanner.model.*;
import com.agriplanner.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
@SuppressWarnings("null")
public class DistributionService {

        private final DistributionPlanRepository planRepository;
        private final DistributionPlanItemRepository itemRepository;
        private final DistributionVoteRepository voteRepository;
        private final CooperativeInventoryRepository inventoryRepository;
        private final CooperativeInventoryLogRepository logRepository;
        private final CooperativeMemberRepository memberRepository;
        private final CooperativeRepository cooperativeRepository;

        // ========== PLAN MANAGEMENT ==========

        @Transactional
        public DistributionPlan createPlan(Long cooperativeId, Long memberId, Long inventoryId,
                        String title, Map<Long, BigDecimal> allocations) {

                Cooperative coop = cooperativeRepository.findById(cooperativeId)
                                .orElseThrow(() -> new RuntimeException("Cooperative not found"));

                CooperativeMember leader = memberRepository.findById(memberId)
                                .orElseThrow(() -> new RuntimeException("Member not found"));

                if (!leader.isLeader()) {
                        throw new RuntimeException("Chỉ trưởng nhóm mới tạo được kế hoạch phân bổ");
                }

                // Check minimum 2 members
                long memberCount = memberRepository.countByCooperative_Id(cooperativeId);
                if (memberCount < 2) {
                        throw new RuntimeException("HTX cần tối thiểu 2 thành viên để thực hiện phân bổ");
                }

                CooperativeInventory inventory = inventoryRepository.findById(inventoryId)
                                .orElseThrow(() -> new RuntimeException("Inventory not found"));

                // Calculate total allocation
                BigDecimal totalAllocation = allocations.values().stream()
                                .reduce(BigDecimal.ZERO, BigDecimal::add);

                if (totalAllocation.compareTo(inventory.getQuantity()) > 0) {
                        throw new RuntimeException("Tổng phân bổ vượt quá số lượng trong kho");
                }

                // Determine required votes (minimum 2 or total members, whichever is smaller)
                int requiredVotes = Math.min(2, (int) memberCount);

                DistributionPlan plan = DistributionPlan.builder()
                                .cooperative(coop)
                                .inventory(inventory)
                                .createdBy(leader)
                                .title(title)
                                .totalQuantity(totalAllocation)
                                .unit(inventory.getUnit())
                                .requiredVotes(requiredVotes)
                                .build();

                plan = planRepository.save(plan);

                // Create plan items
                for (Map.Entry<Long, BigDecimal> entry : allocations.entrySet()) {
                        CooperativeMember member = memberRepository.findById(entry.getKey())
                                        .orElseThrow(() -> new RuntimeException("Member " + entry.getKey() + " not found"));

                        DistributionPlanItem item = DistributionPlanItem.builder()
                                        .plan(plan)
                                        .member(member)
                                        .quantity(entry.getValue())
                                        .build();
                        itemRepository.save(item);
                }

                log.info("[DISTRIBUTION] Plan '{}' created for coop {} with {} allocations",
                                title, cooperativeId, allocations.size());

                return plan;
        }

        // ========== VOTING ==========

        @Transactional
        public DistributionVote castVote(Long planId, Long memberId, DistributionVote.VoteType voteType, String comment) {

                DistributionPlan plan = planRepository.findById(planId)
                                .orElseThrow(() -> new RuntimeException("Plan not found"));

                if (plan.getStatus() != DistributionPlan.PlanStatus.PENDING) {
                        throw new RuntimeException("Kế hoạch đã kết thúc, không thể bỏ phiếu");
                }

                CooperativeMember member = memberRepository.findById(memberId)
                                .orElseThrow(() -> new RuntimeException("Member not found"));

                // Check if already voted
                if (voteRepository.findByPlan_IdAndMember_Id(planId, memberId).isPresent()) {
                        throw new RuntimeException("Bạn đã bỏ phiếu cho kế hoạch này rồi");
                }

                DistributionVote vote = DistributionVote.builder()
                                .plan(plan)
                                .member(member)
                                .vote(voteType)
                                .comment(comment)
                                .build();

                vote = voteRepository.save(vote);

                // Update plan counts
                if (voteType == DistributionVote.VoteType.APPROVE) {
                        plan.addApproval();
                } else {
                        plan.addRejection();
                }
                planRepository.save(plan);

                log.info("[DISTRIBUTION] Member {} voted {} on plan {}", memberId, voteType, planId);

                // Auto-execute if approved
                if (plan.getStatus() == DistributionPlan.PlanStatus.APPROVED) {
                        executePlan(planId);
                }

                return vote;
        }

        // ========== EXECUTE PLAN ==========

        @Transactional
        public void executePlan(Long planId) {
                DistributionPlan plan = planRepository.findById(planId)
                                .orElseThrow(() -> new RuntimeException("Plan not found"));

                if (plan.getStatus() != DistributionPlan.PlanStatus.APPROVED) {
                        throw new RuntimeException("Kế hoạch chưa được duyệt");
                }

                CooperativeInventory inventory = plan.getInventory();

                if (inventory.getQuantity().compareTo(plan.getTotalQuantity()) < 0) {
                        throw new RuntimeException("Không đủ số lượng trong kho để phân bổ (Có: " 
                                        + inventory.getQuantity() + " " + inventory.getUnit() + ", Cần: " 
                                        + plan.getTotalQuantity() + " " + inventory.getUnit() + ")");
                }

                // Subtract from HTX inventory
                inventory.subtractQuantity(plan.getTotalQuantity());
                inventoryRepository.save(inventory);

                // Mark items as received and log
                List<DistributionPlanItem> items = itemRepository.findByPlan_Id(planId);
                for (DistributionPlanItem item : items) {
                        item.setReceived(true);
                        item.setReceivedAt(ZonedDateTime.now());
                        itemRepository.save(item);

                        // Log the distribution
                        CooperativeInventoryLog inventoryLog = CooperativeInventoryLog.builder()
                                        .cooperative(plan.getCooperative())
                                        .inventory(inventory)
                                        .action(CooperativeInventoryLog.LogAction.DISTRIBUTE)
                                        .productName(inventory.getProductName())
                                        .quantity(item.getQuantity())
                                        .unit(inventory.getUnit())
                                        .description("Phân bổ từ KH \"" + plan.getTitle() + "\" cho "
                                                        + item.getMember().getUser().getFullName())
                                        .performedBy(plan.getCreatedBy().getUser())
                                        .referenceType("DISTRIBUTION")
                                        .referenceId(planId)
                                        .build();
                        logRepository.save(inventoryLog);
                }

                plan.setStatus(DistributionPlan.PlanStatus.EXECUTED);
                plan.setExecutedAt(ZonedDateTime.now());
                planRepository.save(plan);

                log.info("[DISTRIBUTION] Plan {} executed - {} {} distributed from inventory {}",
                                planId, plan.getTotalQuantity(), plan.getUnit(), inventory.getId());
        }

        // ========== QUERIES ==========

        public List<DistributionPlan> getPlans(Long cooperativeId) {
                return planRepository.findByCooperative_IdOrderByCreatedAtDesc(cooperativeId);
        }

        public List<DistributionPlan> getPendingPlans(Long cooperativeId) {
                return planRepository.findPendingByCooperativeId(cooperativeId);
        }

        public DistributionPlan getPlan(Long planId) {
                return planRepository.findById(planId)
                                .orElseThrow(() -> new RuntimeException("Plan not found"));
        }

        public List<DistributionPlanItem> getPlanItems(Long planId) {
                return itemRepository.findByPlan_Id(planId);
        }

        public List<DistributionVote> getPlanVotes(Long planId) {
                return voteRepository.findByPlan_Id(planId);
        }

        public boolean hasVoted(Long planId, Long memberId) {
                return voteRepository.findByPlan_IdAndMember_Id(planId, memberId).isPresent();
        }

        // ========== INVENTORY LOGS ==========

        public List<CooperativeInventoryLog> getInventoryLogs(Long cooperativeId) {
                return logRepository.findByCooperative_IdOrderByCreatedAtDesc(cooperativeId);
        }

        // ========== LOG HELPER (used by other services) ==========

        @Transactional
        public void logInventoryAction(Cooperative coop, CooperativeInventory inventory,
                        CooperativeInventoryLog.LogAction action, BigDecimal quantity,
                        String description, User performedBy, String refType, Long refId) {

                CooperativeInventoryLog inventoryLog = CooperativeInventoryLog.builder()
                                .cooperative(coop)
                                .inventory(inventory)
                                .action(action)
                                .productName(inventory != null ? inventory.getProductName() : "")
                                .quantity(quantity)
                                .unit(inventory != null ? inventory.getUnit() : "")
                                .description(description)
                                .performedBy(performedBy)
                                .referenceType(refType)
                                .referenceId(refId)
                                .build();
                logRepository.save(inventoryLog);
        }
}
