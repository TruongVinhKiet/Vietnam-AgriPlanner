package com.agriplanner.service;

import com.agriplanner.dto.CooperativeInventoryDTO;
import com.agriplanner.dto.ContributionStatsDTO;
import com.agriplanner.dto.ContributionSummaryDTO;
import com.agriplanner.model.Cooperative;
import com.agriplanner.model.CooperativeInventory;
import com.agriplanner.model.CooperativeInventoryContribution;
import com.agriplanner.model.CooperativeMember;
import com.agriplanner.model.CooperativeTransaction;
import com.agriplanner.repository.CooperativeInventoryContributionRepository;
import com.agriplanner.repository.CooperativeInventoryRepository;
import com.agriplanner.repository.CooperativeMemberRepository;
import com.agriplanner.repository.CooperativeRepository;
import com.agriplanner.repository.CooperativeTransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CooperativeInventoryService {

        private final CooperativeInventoryRepository inventoryRepository;
        private final CooperativeInventoryContributionRepository contributionRepository;
        private final CooperativeRepository cooperativeRepository;
        private final CooperativeMemberRepository memberRepository;
        private final CooperativeTransactionRepository transactionRepository;

        // ========== INVENTORY MANAGEMENT ==========

        public List<CooperativeInventoryDTO> getInventory(Long cooperativeId) {
                return inventoryRepository.findByCooperative_IdOrderByUpdatedAtDesc(cooperativeId)
                                .stream()
                                .map(this::toDTO)
                                .collect(Collectors.toList());
        }

        public List<CooperativeInventoryDTO> getAvailableInventory(Long cooperativeId) {
                return inventoryRepository.findAvailableByCooperativeId(cooperativeId)
                                .stream()
                                .map(this::toDTO)
                                .collect(Collectors.toList());
        }

        @Transactional
        public CooperativeInventory addToInventory(Long cooperativeId, Long shopItemId,
                        String productName, CooperativeInventory.ProductType productType,
                        BigDecimal quantity, String unit, BigDecimal unitPrice) {

                Objects.requireNonNull(cooperativeId, "Cooperative ID cannot be null");
                Cooperative coop = cooperativeRepository.findById(cooperativeId)
                                .orElseThrow(() -> new RuntimeException("Cooperative not found"));

                // Find or create inventory entry
                CooperativeInventory inventory = inventoryRepository
                                .findByCooperative_IdAndShopItem_Id(cooperativeId, shopItemId)
                                .orElseGet(() -> CooperativeInventory.builder()
                                                .cooperative(coop)
                                                .productName(productName)
                                                .productType(productType)
                                                .unit(unit)
                                                .build());

                inventory.addQuantity(quantity);
                inventory.setTotalValue(inventory.getTotalValue().add(quantity.multiply(unitPrice)));

                return inventoryRepository.save(inventory);
        }

        // ========== CONTRIBUTION MANAGEMENT ==========

        @Transactional
        @SuppressWarnings("null")
        public void contributeToInventory(Long memberId, Long inventoryId, BigDecimal quantity, String notes) {
                Objects.requireNonNull(memberId, "Member ID cannot be null");
                CooperativeMember member = memberRepository.findById(memberId)
                                .orElseThrow(() -> new RuntimeException("Member not found"));

                Objects.requireNonNull(inventoryId, "Inventory ID cannot be null");
                CooperativeInventory inventory = inventoryRepository.findById(inventoryId)
                                .orElseThrow(() -> new RuntimeException("Inventory not found"));

                // Add contribution
                CooperativeInventoryContribution contribution = CooperativeInventoryContribution.builder()
                                .inventory(inventory)
                                .member(member)
                                .quantity(quantity)
                                .notes(notes)
                                .build();

                CooperativeInventoryContribution savedContribution = contributionRepository.save(contribution);
                Objects.requireNonNull(savedContribution, "Failed to save contribution");
                inventory.addQuantity(quantity);
                inventoryRepository.save(inventory);

                // Log transaction
                logTransaction(inventory.getCooperative(), member,
                                CooperativeTransaction.TransactionType.CONTRIBUTE_PRODUCT,
                                BigDecimal.ZERO, // No money involved yet
                                "Góp " + quantity + " " + inventory.getUnit() + " " + inventory.getProductName());

                log.info("Member {} contributed {} {} to inventory {}",
                                memberId, quantity, inventory.getUnit(), inventoryId);
        }

        @Transactional
        public void distributeEarnings(Long campaignId, BigDecimal totalEarnings) {
                List<CooperativeInventoryContribution> contributions = contributionRepository
                                .findByCampaign_Id(campaignId);

                BigDecimal totalQty = contributions.stream()
                                .map(CooperativeInventoryContribution::getQuantity)
                                .reduce(BigDecimal.ZERO, BigDecimal::add);

                for (CooperativeInventoryContribution c : contributions) {
                        BigDecimal percent = c.getQuantity().divide(totalQty, 4, java.math.RoundingMode.HALF_UP);
                        BigDecimal earnings = totalEarnings.multiply(percent);
                        c.setEarnings(earnings);
                        contributionRepository.save(c);
                }

                log.info("Distributed {} earnings among {} contributors for campaign {}",
                                totalEarnings, contributions.size(), campaignId);
        }

        @Transactional
        public BigDecimal claimEarnings(Long memberId) {
                List<CooperativeInventoryContribution> unclaimed = contributionRepository
                                .findUnclaimedEarnings(memberId);

                BigDecimal total = BigDecimal.ZERO;
                for (CooperativeInventoryContribution c : unclaimed) {
                        total = total.add(c.getEarnings());
                        c.setIsClaimed(true);
                        c.setClaimedAt(ZonedDateTime.now());
                        contributionRepository.save(c);

                        // Log transaction
                        logTransaction(c.getInventory().getCooperative(), c.getMember(),
                                        CooperativeTransaction.TransactionType.CLAIM_EARNINGS,
                                        c.getEarnings(),
                                        "Nhận tiền từ bán " + c.getInventory().getProductName());
                }

                log.info("Member {} claimed {} earnings from {} contributions", memberId, total, unclaimed.size());
                return total;
        }

        // ========== DISTRIBUTION STATS (for charts) ==========

        public List<ContributionStatsDTO> getContributionStats(Long campaignId) {
                return contributionRepository.findByCampaignIdOrderByQuantityDesc(campaignId)
                                .stream()
                                .map(c -> ContributionStatsDTO.builder()
                                                .memberId(c.getMember().getId())
                                                .memberName(c.getMember().getUser().getFullName())
                                                .quantity(c.getQuantity())
                                                .earnings(c.getEarnings())
                                                .percent(c.getContributionPercent(
                                                                contributionRepository.sumQuantityByInventoryId(
                                                                                c.getInventory().getId())))
                                                .isClaimed(c.getIsClaimed())
                                                .build())
                                .collect(Collectors.toList());
        }

        public ContributionSummaryDTO getContributionSummary(Long cooperativeId) {
                List<CooperativeInventory> inventories = inventoryRepository
                                .findByCooperative_IdOrderByUpdatedAtDesc(cooperativeId);

                BigDecimal totalValue = inventories.stream()
                                .map(CooperativeInventory::getTotalValue)
                                .reduce(BigDecimal.ZERO, BigDecimal::add);

                int totalProducts = inventories.size();
                int totalContributions = inventories.stream()
                                .mapToInt(i -> i.getContributions().size())
                                .sum();

                return ContributionSummaryDTO.builder()
                                .totalProducts(totalProducts)
                                .totalContributions(totalContributions)
                                .totalValue(totalValue)
                                .build();
        }

        // ========== HELPERS ==========

        @SuppressWarnings("null")
        private void logTransaction(Cooperative coop, CooperativeMember member,
                        CooperativeTransaction.TransactionType type, BigDecimal amount, String description) {
                CooperativeTransaction tx = CooperativeTransaction.builder()
                                .cooperative(coop)
                                .member(member)
                                .type(type)
                                .amount(amount)
                                .balanceAfter(coop.getBalance())
                                .description(description)
                                .build();
                CooperativeTransaction savedTx = transactionRepository.save(tx);
                Objects.requireNonNull(savedTx, "Failed to save transaction");
        }

        private CooperativeInventoryDTO toDTO(CooperativeInventory inv) {
                return CooperativeInventoryDTO.builder()
                                .id(inv.getId())
                                .productName(inv.getProductName())
                                .productType(inv.getProductType().name())
                                .quantity(inv.getQuantity())
                                .unit(inv.getUnit())
                                .totalValue(inv.getTotalValue())
                                .contributorCount(inv.getContributions().size())
                                .updatedAt(inv.getUpdatedAt())
                                .build();
        }
}
