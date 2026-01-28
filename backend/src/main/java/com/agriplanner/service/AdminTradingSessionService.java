package com.agriplanner.service;

import com.agriplanner.dto.AdminBuySessionResponse;
import com.agriplanner.dto.AdminSellSessionResponse;
import com.agriplanner.dto.CreateAdminBuySessionRequest;
import com.agriplanner.dto.CreateAdminSellSessionRequest;
import com.agriplanner.dto.MarketPriceInfo;
import com.agriplanner.model.AnimalDefinition;
import com.agriplanner.model.CropDefinition;
import com.agriplanner.model.GroupBuyCampaign;
import com.agriplanner.model.GroupSellCampaign;
import com.agriplanner.model.ShopItem;
import com.agriplanner.model.User;
import com.agriplanner.repository.AnimalDefinitionRepository;
import com.agriplanner.repository.CropDefinitionRepository;
import com.agriplanner.repository.GroupBuyCampaignRepository;
import com.agriplanner.repository.GroupSellCampaignRepository;
import com.agriplanner.repository.ShopItemRepository;
import com.agriplanner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminTradingSessionService {

        private final GroupBuyCampaignRepository groupBuyCampaignRepository;
        private final GroupSellCampaignRepository groupSellCampaignRepository;
        private final ShopItemRepository shopItemRepository;
        private final CropDefinitionRepository cropDefinitionRepository;
        private final AnimalDefinitionRepository animalDefinitionRepository;
        private final UserRepository userRepository;

        // ========== GROUP BUY (Admin sells to HTX) ==========

        @Transactional
        @SuppressWarnings("null")
        public AdminBuySessionResponse createBuySession(Long adminId, CreateAdminBuySessionRequest request) {
                Objects.requireNonNull(adminId, "Admin ID cannot be null");
                User admin = userRepository.findById(adminId)
                                .orElseThrow(() -> new RuntimeException("Admin not found"));

                Objects.requireNonNull(request.getShopItemId(), "Shop item ID cannot be null");
                ShopItem shopItem = shopItemRepository.findById(request.getShopItemId())
                                .orElseThrow(() -> new RuntimeException("Shop item not found"));

                // Validate: wholesale price must be less than retail price
                if (request.getWholesalePrice().compareTo(shopItem.getPrice()) >= 0) {
                        throw new RuntimeException("Giá gom phải nhỏ hơn giá bán lẻ!");
                }

                GroupBuyCampaign campaign = GroupBuyCampaign.builder()
                                .shopItem(shopItem)
                                .title(request.getTitle())
                                .targetQuantity(request.getTargetQuantity())
                                .wholesalePrice(request.getWholesalePrice())
                                .retailPrice(shopItem.getPrice())
                                .deadline(request.getDeadline())
                                .isAdminCreated(true)
                                .marketPrice(shopItem.getPrice()) // Market reference
                                .marketQuantity(shopItem.getStockQuantity())
                                .note(request.getNote())
                                .createdBy(admin)
                                .build();

                GroupBuyCampaign savedCampaign = groupBuyCampaignRepository.save(campaign);
                campaign = Objects.requireNonNull(savedCampaign, "Failed to save campaign");
                log.info("Admin {} created buy session {} for item {}", adminId, campaign.getId(), shopItem.getName());

                return toAdminBuySessionResponse(campaign);
        }

        public List<AdminBuySessionResponse> getAllBuySessions() {
                return groupBuyCampaignRepository.findAllAdminCreatedCampaigns()
                                .stream()
                                .map(this::toAdminBuySessionResponse)
                                .collect(Collectors.toList());
        }

        public List<AdminBuySessionResponse> getOpenBuySessions() {
                return groupBuyCampaignRepository.findAdminCreatedOpenCampaigns()
                                .stream()
                                .map(this::toAdminBuySessionResponse)
                                .collect(Collectors.toList());
        }

        // ========== GROUP SELL (Admin buys from HTX) ==========

        @Transactional
        @SuppressWarnings("null")
        public AdminSellSessionResponse createSellSession(Long adminId, CreateAdminSellSessionRequest request) {
                Objects.requireNonNull(adminId, "Admin ID cannot be null");
                User admin = userRepository.findById(adminId)
                                .orElseThrow(() -> new RuntimeException("Admin not found"));

                String productName;

                // Get product info based on type
                if (request.getCropDefinitionId() != null) {
                        Long cropId = Objects.requireNonNull(request.getCropDefinitionId());
                        CropDefinition crop = cropDefinitionRepository.findById(cropId)
                                        .orElseThrow(() -> new RuntimeException("Crop not found"));
                        productName = crop.getName();
                        // Use crop's market price
                        if (crop.getMarketPricePerKg() != null) {
                                request.setMarketPrice(crop.getMarketPricePerKg());
                        }
                } else if (request.getAnimalDefinitionId() != null) {
                        Long animalId = Objects.requireNonNull(request.getAnimalDefinitionId());
                        AnimalDefinition animal = animalDefinitionRepository.findById(animalId)
                                        .orElseThrow(() -> new RuntimeException("Animal not found"));
                        productName = animal.getName();
                } else {
                        productName = request.getProductName();
                }

                // Validate: buy price must be higher than market
                if (request.getMarketPrice() != null
                                && request.getMinPrice().compareTo(request.getMarketPrice()) <= 0) {
                        throw new RuntimeException("Giá gom bán phải cao hơn giá thị trường!");
                }

                GroupSellCampaign campaign = GroupSellCampaign.builder()
                                .productName(productName)
                                .description(request.getDescription())
                                .targetQuantity(request.getTargetQuantity())
                                .minPrice(request.getMinPrice())
                                .unit(request.getUnit())
                                .deadline(request.getDeadline())
                                .isAdminCreated(true)
                                .marketPrice(request.getMarketPrice())
                                .createdBy(admin)
                                .build();

                // Link to crop/animal definition
                if (request.getCropDefinitionId() != null) {
                        Long cropDefId = Objects.requireNonNull(request.getCropDefinitionId());
                        campaign.setCropDefinition(cropDefinitionRepository.findById(cropDefId).orElse(null));
                }
                if (request.getAnimalDefinitionId() != null) {
                        Long animalDefId = Objects.requireNonNull(request.getAnimalDefinitionId());
                        campaign.setAnimalDefinition(animalDefinitionRepository.findById(animalDefId).orElse(null));
                }

                GroupSellCampaign savedCampaign = groupSellCampaignRepository.save(campaign);
                campaign = Objects.requireNonNull(savedCampaign, "Failed to save campaign");
                log.info("Admin {} created sell session {} for product {}", adminId, campaign.getId(), productName);

                return toAdminSellSessionResponse(campaign);
        }

        public List<AdminSellSessionResponse> getAllSellSessions() {
                return groupSellCampaignRepository.findAllAdminCreatedCampaigns()
                                .stream()
                                .map(this::toAdminSellSessionResponse)
                                .collect(Collectors.toList());
        }

        public List<AdminSellSessionResponse> getOpenSellSessions() {
                return groupSellCampaignRepository.findAdminCreatedOpenCampaigns()
                                .stream()
                                .map(this::toAdminSellSessionResponse)
                                .collect(Collectors.toList());
        }

        // ========== MARKET PRICES (for reference) ==========

        public List<MarketPriceInfo> getMarketPricesForBuy() {
                // Get all shop items with their prices
                return shopItemRepository.findAll().stream()
                                .filter(item -> item.getStockQuantity() == null || item.getStockQuantity() == -1
                                                || item.getStockQuantity() > 0)
                                .map(item -> MarketPriceInfo.builder()
                                                .id(item.getId())
                                                .name(item.getName())
                                                .category(item.getCategory())
                                                .price(item.getPrice())
                                                .stock(item.getStockQuantity())
                                                .unit(item.getUnit())
                                                .imageUrl(item.getImageUrl())
                                                .build())
                                .collect(Collectors.toList());
        }

        public List<MarketPriceInfo> getMarketPricesForSell() {
                // Get crops that can be sold
                List<MarketPriceInfo> result = new java.util.ArrayList<>(cropDefinitionRepository.findAll().stream()
                                .map(crop -> MarketPriceInfo.builder()
                                                .id(crop.getId())
                                                .name(crop.getName())
                                                .category("CROP")
                                                .price(crop.getMarketPricePerKg())
                                                .unit("kg")
                                                .imageUrl(crop.getImageUrl())
                                                .productType("CROP")
                                                .build())
                                .collect(Collectors.toList()));

                // Add animals
                animalDefinitionRepository.findAll().forEach(animal -> {
                        result.add(MarketPriceInfo.builder()
                                        .id(animal.getId())
                                        .name(animal.getName())
                                        .category("ANIMAL")
                                        .price(animal.getSellPricePerUnit())
                                        .unit(animal.getUnit() != null ? animal.getUnit() : "con")
                                        .imageUrl(animal.getImageUrl())
                                        .productType("ANIMAL")
                                        .build());
                });

                return result;
        }

        // ========== MAPPERS ==========

        private AdminBuySessionResponse toAdminBuySessionResponse(GroupBuyCampaign campaign) {
                return AdminBuySessionResponse.builder()
                                .id(campaign.getId())
                                .title(campaign.getTitle())
                                .shopItemId(campaign.getShopItem() != null ? campaign.getShopItem().getId() : null)
                                .shopItemName(campaign.getShopItem() != null ? campaign.getShopItem().getName() : null)
                                .shopItemImage(campaign.getShopItem() != null ? campaign.getShopItem().getImageUrl()
                                                : null)
                                .targetQuantity(campaign.getTargetQuantity())
                                .currentQuantity(campaign.getCurrentQuantity())
                                .wholesalePrice(campaign.getWholesalePrice())
                                .retailPrice(campaign.getRetailPrice())
                                .marketPrice(campaign.getMarketPrice())
                                .discountPercent(campaign.getDiscountPercent())
                                .progressPercent(campaign.getProgressPercent())
                                .deadline(campaign.getDeadline())
                                .status(campaign.getStatus().name())
                                .note(campaign.getNote())
                                .createdAt(campaign.getCreatedAt())
                                .participatingCoops(campaign.getContributions().stream()
                                                .map(c -> c.getMember().getCooperative().getName())
                                                .distinct()
                                                .collect(Collectors.toList()))
                                .build();
        }

        private AdminSellSessionResponse toAdminSellSessionResponse(GroupSellCampaign campaign) {
                return AdminSellSessionResponse.builder()
                                .id(campaign.getId())
                                .productName(campaign.getProductName())
                                .description(campaign.getDescription())
                                .targetQuantity(campaign.getTargetQuantity())
                                .currentQuantity(campaign.getCurrentQuantity())
                                .minPrice(campaign.getMinPrice())
                                .marketPrice(campaign.getMarketPrice())
                                .unit(campaign.getUnit())
                                .progressPercent(campaign.getProgressPercent())
                                .deadline(campaign.getDeadline())
                                .status(campaign.getStatus().name())
                                .createdAt(campaign.getCreatedAt())
                                .participatingCoops(campaign.getContributions().stream()
                                                .map(c -> c.getMember().getCooperative().getName())
                                                .distinct()
                                                .collect(Collectors.toList()))
                                .build();
        }

        // ========== FORCE CLOSE SESSIONS ==========

        @Transactional
        public void forceCloseBuySession(Long adminId, Long sessionId, String reason) {
                Objects.requireNonNull(adminId, "Admin ID cannot be null");
                User admin = userRepository.findById(adminId)
                                .orElseThrow(() -> new RuntimeException("Admin not found"));

                Objects.requireNonNull(sessionId, "Session ID cannot be null");
                GroupBuyCampaign campaign = groupBuyCampaignRepository.findById(sessionId)
                                .orElseThrow(() -> new RuntimeException("Session not found"));

                if (campaign.getStatus() != GroupBuyCampaign.CampaignStatus.OPEN) {
                        throw new RuntimeException("Chỉ có thể đóng phiên đang mở");
                }

                campaign.forceClose(admin, reason);
                groupBuyCampaignRepository.save(campaign);
                log.warn("Admin {} force closed buy session {} with reason: {}", adminId, sessionId, reason);
        }

        @Transactional
        public void forceCloseSellSession(Long adminId, Long sessionId, String reason) {
                Objects.requireNonNull(adminId, "Admin ID cannot be null");
                User admin = userRepository.findById(adminId)
                                .orElseThrow(() -> new RuntimeException("Admin not found"));

                Objects.requireNonNull(sessionId, "Session ID cannot be null");
                GroupSellCampaign campaign = groupSellCampaignRepository.findById(sessionId)
                                .orElseThrow(() -> new RuntimeException("Session not found"));

                if (campaign.getStatus() != GroupSellCampaign.SellCampaignStatus.OPEN) {
                        throw new RuntimeException("Chỉ có thể đóng phiên đang mở");
                }

                campaign.forceClose(admin, reason);
                groupSellCampaignRepository.save(campaign);
                log.warn("Admin {} force closed sell session {} with reason: {}", adminId, sessionId, reason);
        }
}
