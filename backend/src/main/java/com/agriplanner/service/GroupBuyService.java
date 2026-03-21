package com.agriplanner.service;

import com.agriplanner.dto.CooperativeDTO.*;
import com.agriplanner.model.*;
import com.agriplanner.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.time.ZonedDateTime;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@SuppressWarnings("null")
public class GroupBuyService {

        private final CooperativeRepository cooperativeRepository;
        private final CooperativeMemberRepository memberRepository;
        private final CooperativeTransactionRepository transactionRepository;
        private final GroupBuyCampaignRepository campaignRepository;
        private final GroupBuyContributionRepository contributionRepository;
        private final ShopItemRepository shopItemRepository;
        private final UserAddressRepository addressRepository;
        private final CooperativeInventoryService inventoryService;
        private final CooperativeInventoryLogRepository logRepository;

        @Transactional
        public GroupBuyResponse createCampaign(Long cooperativeId, Long userId, CreateGroupBuyRequest request) {
                Cooperative cooperative = cooperativeRepository.findById(cooperativeId)
                                .orElseThrow(() -> new RuntimeException("Cooperative not found"));

                CooperativeMember member = memberRepository.findByCooperative_IdAndUser_Id(cooperativeId, userId)
                                .orElseThrow(() -> new RuntimeException("Not a member of this cooperative"));

                if (!member.isLeader()) {
                        throw new RuntimeException("Only leaders can create campaigns");
                }

                ShopItem shopItem = shopItemRepository.findById(request.getShopItemId())
                                .orElseThrow(() -> new RuntimeException("Shop item not found"));

                GroupBuyCampaign campaign = GroupBuyCampaign.builder()
                                .cooperative(cooperative)
                                .shopItem(shopItem)
                                .title(request.getTitle())
                                .targetQuantity(request.getTargetQuantity())
                                .wholesalePrice(request.getWholesalePrice())
                                .retailPrice(shopItem.getPrice())
                                .deadline(request.getDeadline())
                                .createdBy(member.getUser())
                                .build();

                campaign = campaignRepository.save(campaign);

                log.info("[GROUP_BUY] Campaign '{}' created in cooperative '{}'", request.getTitle(),
                                cooperative.getName());

                return mapToResponse(campaign, userId);
        }

        @Transactional(readOnly = true)
        public List<GroupBuyResponse> getCampaigns(Long cooperativeId, Long userId) {
                List<GroupBuyCampaign> campaigns = campaignRepository
                                .findByCooperative_IdOrderByCreatedAtDesc(cooperativeId);
                return campaigns.stream()
                                .map(c -> mapToResponse(c, userId))
                                .collect(Collectors.toList());
        }

        @Transactional(readOnly = true)
        public List<GroupBuyResponse> getOpenCampaigns(Long cooperativeId, Long userId) {
                List<GroupBuyCampaign> campaigns = campaignRepository.findOpenByCooperativeId(cooperativeId);
                return campaigns.stream()
                                .map(c -> mapToResponse(c, userId))
                                .collect(Collectors.toList());
        }

        @Transactional
        public GroupBuyResponse contribute(Long campaignId, Long userId, ContributeRequest request) {
                GroupBuyCampaign campaign = campaignRepository.findById(campaignId)
                                .orElseThrow(() -> new RuntimeException("Campaign not found"));

                if (campaign.getStatus() != GroupBuyCampaign.CampaignStatus.OPEN) {
                        throw new RuntimeException("Campaign is not accepting contributions");
                }

                CooperativeMember member = memberRepository
                                .findByCooperative_IdAndUser_Id(campaign.getCooperative().getId(), userId)
                                .orElseThrow(() -> new RuntimeException("Not a member of this cooperative"));

                UserAddress address = null;
                if (request.getShippingAddressId() != null) {
                        address = addressRepository.findById(request.getShippingAddressId())
                                        .orElseThrow(() -> new RuntimeException("Address not found"));
                }

                // Check if already contributed, update or create
                GroupBuyContribution contribution = contributionRepository
                                .findByCampaign_IdAndMember_Id(campaignId, member.getId())
                                .orElse(null);

                if (contribution != null) {
                        // Update existing contribution
                        contribution.setQuantity(contribution.getQuantity() + request.getQuantity());
                        contribution.setShippingAddress(address);
                        contributionRepository.save(contribution);

                        // Update campaign total
                        campaign.addContribution(request.getQuantity());
                } else {
                        // New contribution
                        contribution = GroupBuyContribution.builder()
                                        .campaign(campaign)
                                        .member(member)
                                        .quantity(request.getQuantity())
                                        .shippingAddress(address)
                                        .build();
                        contributionRepository.save(contribution);

                        campaign.addContribution(request.getQuantity());
                }

                campaignRepository.save(campaign);

                log.info("[GROUP_BUY] User {} contributed {} to campaign '{}'",
                                member.getUser().getEmail(), request.getQuantity(), campaign.getTitle());

                return mapToResponse(campaign, userId);
        }

        @Transactional
        public GroupBuyResponse completeCampaign(Long campaignId, Long userId) {
                GroupBuyCampaign campaign = campaignRepository.findById(campaignId)
                                .orElseThrow(() -> new RuntimeException("Campaign not found"));

                CooperativeMember member = memberRepository
                                .findByCooperative_IdAndUser_Id(campaign.getCooperative().getId(), userId)
                                .orElseThrow(() -> new RuntimeException("Not a member of this cooperative"));

                if (!member.isLeader()) {
                        throw new RuntimeException("Only leaders can complete campaigns");
                }

                if (campaign.getStatus() != GroupBuyCampaign.CampaignStatus.COMPLETED) {
                        throw new RuntimeException("Campaign target not reached yet");
                }

                Cooperative cooperative = campaign.getCooperative();

                // Calculate total cost
                BigDecimal totalCost = campaign.getWholesalePrice()
                                .multiply(BigDecimal.valueOf(campaign.getCurrentQuantity()));

                // Check cooperative balance
                if (cooperative.getBalance().compareTo(totalCost) < 0) {
                        throw new RuntimeException(
                                        "Insufficient cooperative fund. Required: " + totalCost + ", Available: "
                                                        + cooperative.getBalance());
                }

                // Deduct from cooperative fund
                cooperative.subtractBalance(totalCost);
                cooperativeRepository.save(cooperative);

                // Record transaction
                CooperativeTransaction tx = CooperativeTransaction.builder()
                                .cooperative(cooperative)
                                .type(CooperativeTransaction.TransactionType.PURCHASE)
                                .amount(totalCost)
                                .balanceAfter(cooperative.getBalance())
                                .description("Mua chung: " + campaign.getTitle() + " x" + campaign.getCurrentQuantity())
                                .build();
                transactionRepository.save(tx);

                // Mark campaign as ordered
                campaign.setStatus(GroupBuyCampaign.CampaignStatus.ORDERED);
                campaignRepository.save(campaign);

                // Add to Cooperative Inventory
                CooperativeInventory savedInventory = inventoryService.addToInventory(
                        cooperative.getId(),
                        campaign.getShopItem().getId(),
                        campaign.getShopItem().getName(),
                        CooperativeInventory.ProductType.SHOP_ITEM,
                        BigDecimal.valueOf(campaign.getCurrentQuantity()),
                        campaign.getShopItem().getUnit(),
                        campaign.getWholesalePrice()
                );

                // Log inventory import
                CooperativeInventoryLog logEntry = CooperativeInventoryLog.builder()
                        .cooperative(cooperative)
                        .inventory(savedInventory)
                        .action(CooperativeInventoryLog.LogAction.IMPORT)
                        .quantity(BigDecimal.valueOf(campaign.getCurrentQuantity()))
                        .unit(campaign.getShopItem().getUnit())
                        .productName(campaign.getShopItem().getName())
                        .description("Nhập kho từ đơn gom mua: " + campaign.getTitle())
                        .performedBy(member.getUser())
                        .referenceType("GROUP_BUY")
                        .referenceId(campaign.getId())
                        .build();
                logRepository.save(logEntry);

                // Note: Future improvement - Create individual orders for each contributor
                // This would involve creating Order entities for each contribution
                // with their respective shipping addresses

                log.info("[GROUP_BUY] Campaign '{}' completed. Total: {}", campaign.getTitle(), totalCost);

                return mapToResponse(campaign, userId);
        }

        @Transactional
        public Map<String, Object> contributeToAdminSession(Long sessionId, Long cooperativeId, Long userId, int quantity) {
                GroupBuyCampaign campaign = campaignRepository.findById(sessionId)
                                .orElseThrow(() -> new RuntimeException("Phiên gom mua không tồn tại"));

                if (campaign.getStatus() != GroupBuyCampaign.CampaignStatus.OPEN) {
                        throw new RuntimeException("Phiên gom mua đã đóng, không thể tham gia");
                }

                Cooperative coop = cooperativeRepository.findById(cooperativeId)
                                .orElseThrow(() -> new RuntimeException("HTX không tồn tại"));

                CooperativeMember member = memberRepository.findByCooperative_IdAndUser_Id(cooperativeId, userId)
                                .orElseThrow(() -> new RuntimeException("Bạn không phải thành viên HTX này"));

                if (!member.isLeader()) {
                        throw new RuntimeException("Chỉ trưởng nhóm mới được mua hàng từ Admin");
                }

                // Check if already contributed
                GroupBuyContribution contribution = contributionRepository
                                .findByCampaign_IdAndMember_Id(sessionId, member.getId())
                                .orElse(null);

                if (contribution != null) {
                        contribution.setQuantity(contribution.getQuantity() + quantity);
                        contributionRepository.save(contribution);
                        campaign.addContribution(quantity);
                } else {
                        contribution = GroupBuyContribution.builder()
                                        .campaign(campaign)
                                        .member(member)
                                        .quantity(quantity)
                                        .build();
                        contributionRepository.save(contribution);
                        campaign.addContribution(quantity);
                }

                campaignRepository.save(campaign);

                log.info("[GROUP_BUY] HTX {} contributed {} units to admin buy session {}",
                                coop.getName(), quantity, sessionId);

                Map<String, Object> result = new HashMap<>();
                result.put("success", true);
                result.put("contributed", quantity);
                result.put("campaignProgress", campaign.getProgressPercent());
                result.put("message", "Đã đăng ký mua " + quantity + " sản phẩm từ Admin");
                return result;
        }

        @Transactional
        public Map<String, Object> adminCompleteBuySession(Long sessionId, Long adminId) {
                GroupBuyCampaign campaign = campaignRepository.findById(sessionId)
                                .orElseThrow(() -> new RuntimeException("Phiên gom mua không tồn tại"));

                if (campaign.getStatus() == GroupBuyCampaign.CampaignStatus.ORDERED
                                || campaign.getStatus() == GroupBuyCampaign.CampaignStatus.CANCELLED) {
                        throw new RuntimeException("Phiên gom mua đã được chốt hoặc đã hủy");
                }

                if (campaign.getCurrentQuantity() == 0) {
                        throw new RuntimeException("Chưa có HTX nào đăng ký mua, không thể chốt đơn");
                }

                campaign.setStatus(GroupBuyCampaign.CampaignStatus.ORDERED);
                campaign.setClosedAt(ZonedDateTime.now());
                campaign.setClosedReason(GroupBuyCampaign.CloseReason.AUTO_COMPLETED);
                campaignRepository.save(campaign);

                List<GroupBuyContribution> contributions = contributionRepository.findByCampaign_Id(sessionId);

                BigDecimal totalReceived = BigDecimal.ZERO;
                int coopsPaid = 0;

                for (GroupBuyContribution c : contributions) {
                        BigDecimal cost = campaign.getWholesalePrice().multiply(BigDecimal.valueOf(c.getQuantity()));

                        Cooperative coop = c.getMember().getCooperative();

                        if (coop.getBalance().compareTo(cost) < 0) {
                                log.warn("HTX {} không đủ tiền (Cần {}, Có {}). Bỏ qua HTX này.", 
                                                coop.getName(), cost, coop.getBalance());
                                continue;
                        }

                        coop.subtractBalance(cost);
                        cooperativeRepository.save(coop);

                        // Record transaction
                        CooperativeTransaction tx = CooperativeTransaction.builder()
                                        .cooperative(coop)
                                        .member(c.getMember())
                                        .type(CooperativeTransaction.TransactionType.PURCHASE)
                                        .amount(cost)
                                        .balanceAfter(coop.getBalance())
                                        .description("Mua hàng từ Admin: " + campaign.getShopItem().getName()
                                                        + " x" + c.getQuantity() + " @ "
                                                        + campaign.getWholesalePrice().toPlainString() + "đ/"
                                                        + (campaign.getShopItem().getUnit() != null ? campaign.getShopItem().getUnit() : "đv"))
                                        .build();
                        transactionRepository.save(tx);

                        // Add to Inventory
                        CooperativeInventory savedInventory = inventoryService.addToInventory(
                                        coop.getId(),
                                        campaign.getShopItem().getId(),
                                        campaign.getShopItem().getName(),
                                        CooperativeInventory.ProductType.SHOP_ITEM,
                                        BigDecimal.valueOf(c.getQuantity()),
                                        campaign.getShopItem().getUnit(),
                                        campaign.getWholesalePrice()
                        );

                        // Log inventory
                        CooperativeInventoryLog logEntry = CooperativeInventoryLog.builder()
                                        .cooperative(coop)
                                        .inventory(savedInventory)
                                        .action(CooperativeInventoryLog.LogAction.IMPORT)
                                        .quantity(BigDecimal.valueOf(c.getQuantity()))
                                        .unit(campaign.getShopItem().getUnit())
                                        .productName(campaign.getShopItem().getName())
                                        .description("Nhập kho từ Admin Gom Mua: " + campaign.getTitle())
                                        .performedBy(c.getMember().getUser())
                                        .referenceType("GROUP_BUY")
                                        .referenceId(campaign.getId())
                                        .build();
                        logRepository.save(logEntry);

                        totalReceived = totalReceived.add(cost);
                        coopsPaid++;
                }

                Map<String, Object> result = new HashMap<>();
                result.put("success", true);
                result.put("totalQuantityBought", campaign.getCurrentQuantity());
                result.put("wholesalePrice", campaign.getWholesalePrice());
                result.put("totalReceived", totalReceived);
                result.put("cooperativesPaid", coopsPaid);
                result.put("message", "Đã chốt phiên gom mua, thu " + totalReceived.toPlainString()
                                + "đ từ " + coopsPaid + " HTX và chuyển hàng vào kho.");
                return result;
        }

        private GroupBuyResponse mapToResponse(GroupBuyCampaign c, Long userId) {
                CooperativeMember member = memberRepository
                                .findByCooperative_IdAndUser_Id(c.getCooperative().getId(), userId)
                                .orElse(null);
                Integer myContribution = null;
                if (member != null) {
                        GroupBuyContribution contrib = contributionRepository
                                        .findByCampaign_IdAndMember_Id(c.getId(), member.getId())
                                        .orElse(null);
                        if (contrib != null) {
                                myContribution = contrib.getQuantity();
                        }
                }

                return GroupBuyResponse.builder()
                                .id(c.getId())
                                .title(c.getTitle())
                                .shopItemId(c.getShopItem().getId())
                                .shopItemName(c.getShopItem().getName())
                                .shopItemImage(c.getShopItem().getImageUrl())
                                .shopItemUnit(c.getShopItem().getUnit())
                                .targetQuantity(c.getTargetQuantity())
                                .currentQuantity(c.getCurrentQuantity())
                                .progressPercent(c.getProgressPercent())
                                .wholesalePrice(c.getWholesalePrice())
                                .retailPrice(c.getRetailPrice())
                                .discountPercent(c.getDiscountPercent())
                                .deadline(c.getDeadline())
                                .status(c.getStatus().name())
                                .createdAt(c.getCreatedAt())
                                .createdByName(c.getCreatedBy() != null ? c.getCreatedBy().getFullName() : null)
                                .contributorCount(c.getContributions().size())
                                .myContribution(myContribution)
                                .build();
        }
}
