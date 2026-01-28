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

                // Note: Future improvement - Create individual orders for each contributor
                // This would involve creating Order entities for each contribution
                // with their respective shipping addresses

                log.info("[GROUP_BUY] Campaign '{}' completed. Total: {}", campaign.getTitle(), totalCost);

                return mapToResponse(campaign, userId);
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
