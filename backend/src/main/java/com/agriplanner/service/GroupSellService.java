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
import java.util.HashMap;

@Service
@RequiredArgsConstructor
@Slf4j
@SuppressWarnings("null")
public class GroupSellService {

        private final CooperativeRepository cooperativeRepository;
        private final CooperativeMemberRepository memberRepository;
        private final CooperativeTransactionRepository transactionRepository;
        private final CooperativeInventoryRepository inventoryRepository;
        private final CooperativeInventoryLogRepository inventoryLogRepository;
        private final GroupSellCampaignRepository campaignRepository;
        private final GroupSellContributionRepository contributionRepository;

        // ========== HTX contributes inventory to Admin sell session ==========

        @Transactional
        public Map<String, Object> contributeToAdminSession(Long sessionId, Long cooperativeId, Long userId,
                        Long inventoryId, int quantity) {

                GroupSellCampaign campaign = campaignRepository.findById(sessionId)
                                .orElseThrow(() -> new RuntimeException("Phiên gom bán không tồn tại"));

                if (campaign.getStatus() != GroupSellCampaign.SellCampaignStatus.OPEN) {
                        throw new RuntimeException("Phiên gom bán đã đóng, không thể bán hàng");
                }

                Cooperative coop = cooperativeRepository.findById(cooperativeId)
                                .orElseThrow(() -> new RuntimeException("Cooperative not found"));

                CooperativeMember member = memberRepository.findByCooperative_IdAndUser_Id(cooperativeId, userId)
                                .orElseThrow(() -> new RuntimeException("Bạn không phải thành viên HTX này"));

                if (!member.isLeader()) {
                        throw new RuntimeException("Chỉ trưởng nhóm mới được bán hàng cho Admin");
                }

                // Check minimum 2 members
                long memberCount = memberRepository.countByCooperative_Id(cooperativeId);
                if (memberCount < 2) {
                        throw new RuntimeException("HTX cần tối thiểu 2 thành viên để thực hiện gom bán");
                }

                CooperativeInventory inventory = inventoryRepository.findById(inventoryId)
                                .orElseThrow(() -> new RuntimeException("Sản phẩm trong kho không tồn tại"));

                // Validate inventory belongs to this cooperative
                if (!inventory.getCooperative().getId().equals(cooperativeId)) {
                        throw new RuntimeException("Sản phẩm này không thuộc kho của HTX bạn");
                }

                // Check sufficient quantity
                if (inventory.getQuantity().compareTo(BigDecimal.valueOf(quantity)) < 0) {
                        throw new RuntimeException(
                                        "Kho không đủ số lượng. Tồn kho: " + inventory.getQuantity() + " "
                                                        + inventory.getUnit());
                }

                // Deduct from cooperative inventory
                inventory.subtractQuantity(BigDecimal.valueOf(quantity));
                inventoryRepository.save(inventory);

                // Check if already contributed, update or create
                GroupSellContribution contribution = contributionRepository
                                .findByCampaign_IdAndMember_Id(sessionId, member.getId())
                                .orElse(null);

                if (contribution != null) {
                        contribution.setQuantity(contribution.getQuantity() + quantity);
                        contributionRepository.save(contribution);
                } else {
                        contribution = GroupSellContribution.builder()
                                        .campaign(campaign)
                                        .member(member)
                                        .quantity(quantity)
                                        .notes("Bán từ kho HTX: " + inventory.getProductName())
                                        .build();
                        contributionRepository.save(contribution);
                }

                // Update campaign total
                campaign.addContribution(quantity);
                campaignRepository.save(campaign);

                // Log inventory export
                CooperativeInventoryLog logEntry = CooperativeInventoryLog.builder()
                                .cooperative(coop)
                                .inventory(inventory)
                                .action(CooperativeInventoryLog.LogAction.EXPORT)
                                .quantity(BigDecimal.valueOf(quantity))
                                .description("Xuất kho bán cho Admin - Phiên: " + campaign.getProductName())
                                .performedBy(member.getUser())
                                .referenceType("GROUP_SELL")
                                .referenceId(sessionId)
                                .build();
                inventoryLogRepository.save(logEntry);

                log.info("[GROUP_SELL] HTX {} contributed {} units of {} to admin sell session {}",
                                coop.getName(), quantity, inventory.getProductName(), sessionId);

                Map<String, Object> result = new HashMap<>();
                result.put("success", true);
                result.put("contributed", quantity);
                result.put("campaignProgress", campaign.getProgressPercent());
                result.put("remainingInventory", inventory.getQuantity());
                result.put("message", "Đã bán " + quantity + " " + (inventory.getUnit() != null ? inventory.getUnit() : "")
                                + " " + inventory.getProductName() + " cho Admin");
                return result;
        }

        // ========== Admin completes sell session & pays cooperatives ==========

        @Transactional
        public Map<String, Object> adminCompleteSellSession(Long sessionId, Long adminId, BigDecimal finalPrice) {

                GroupSellCampaign campaign = campaignRepository.findById(sessionId)
                                .orElseThrow(() -> new RuntimeException("Phiên gom bán không tồn tại"));

                if (campaign.getStatus() == GroupSellCampaign.SellCampaignStatus.SOLD
                                || campaign.getStatus() == GroupSellCampaign.SellCampaignStatus.CANCELLED) {
                        throw new RuntimeException("Phiên gom bán đã kết thúc");
                }

                if (campaign.getCurrentQuantity() == 0) {
                        throw new RuntimeException("Chưa có HTX nào giao hàng, không thể chốt đơn");
                }

                campaign.setFinalPrice(finalPrice);
                campaign.setStatus(GroupSellCampaign.SellCampaignStatus.SOLD);
                campaign.setClosedAt(ZonedDateTime.now());
                campaign.setClosedReason(GroupSellCampaign.CloseReason.AUTO_COMPLETED);
                campaignRepository.save(campaign);

                // Pay each cooperative
                List<GroupSellContribution> contributions = contributionRepository.findByCampaign_Id(sessionId);

                BigDecimal totalPaid = BigDecimal.ZERO;
                int coopsPaid = 0;

                for (GroupSellContribution c : contributions) {
                        BigDecimal payment = finalPrice.multiply(BigDecimal.valueOf(c.getQuantity()));

                        // Add money to cooperative fund
                        Cooperative coop = c.getMember().getCooperative();
                        coop.addBalance(payment);
                        cooperativeRepository.save(coop);

                        // Record transaction
                        CooperativeTransaction tx = CooperativeTransaction.builder()
                                        .cooperative(coop)
                                        .member(c.getMember())
                                        .type(CooperativeTransaction.TransactionType.REVENUE)
                                        .amount(payment)
                                        .balanceAfter(coop.getBalance())
                                        .description("Thu nhập bán hàng: " + campaign.getProductName()
                                                        + " x" + c.getQuantity() + " @ "
                                                        + finalPrice.toPlainString() + "đ/"
                                                        + (campaign.getUnit() != null ? campaign.getUnit() : "đv"))
                                        .build();
                        transactionRepository.save(tx);

                        totalPaid = totalPaid.add(payment);
                        coopsPaid++;

                        log.info("[GROUP_SELL] Paid {} to cooperative {} for {} units",
                                        payment, coop.getName(), c.getQuantity());
                }

                log.info("[GROUP_SELL] Session {} completed. Total paid: {} to {} cooperatives",
                                sessionId, totalPaid, coopsPaid);

                Map<String, Object> result = new HashMap<>();
                result.put("success", true);
                result.put("totalQuantitySold", campaign.getCurrentQuantity());
                result.put("finalPrice", finalPrice);
                result.put("totalPaid", totalPaid);
                result.put("cooperativesPaid", coopsPaid);
                result.put("message", "Đã chốt phiên gom bán và thanh toán " + totalPaid.toPlainString()
                                + "đ cho " + coopsPaid + " HTX");
                return result;
        }

        // ========== Query methods ==========

        public List<GroupSellCampaign> getOpenAdminSessions() {
                return campaignRepository.findAdminCreatedOpenCampaigns();
        }

        public List<GroupSellCampaign> getAllAdminSessions() {
                return campaignRepository.findAllAdminCreatedCampaigns();
        }

        public List<GroupSellContribution> getContributions(Long campaignId) {
                return contributionRepository.findByCampaign_Id(campaignId);
        }
}
