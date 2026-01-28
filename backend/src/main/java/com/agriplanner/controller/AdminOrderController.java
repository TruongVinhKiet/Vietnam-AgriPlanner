package com.agriplanner.controller;

import com.agriplanner.model.*;
import com.agriplanner.model.Order.OrderStatus;
import com.agriplanner.model.Order.PurchaseType;

import com.agriplanner.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('SYSTEM_ADMIN')")
public class AdminOrderController {

    private final OrderRepository orderRepository;
    private final MarketPriceTrackingRepository marketPriceTrackingRepository;
    private final StoreConfigRepository storeConfigRepository;
    private final ShopItemRepository shopItemRepository;

    // =============================================
    // ORDERS MANAGEMENT
    // =============================================

    @GetMapping("/orders")
    public ResponseEntity<List<OrderSummary>> getAllOrders(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String purchaseType) {

        List<Order> orders;
        if (status != null && !status.isEmpty()) {
            OrderStatus orderStatus = OrderStatus.valueOf(status);
            orders = orderRepository.findByStatus(orderStatus);
        } else {
            orders = orderRepository.findAll();
        }

        // Sort by createdAt desc
        orders.sort((a, b) -> {
            if (b.getCreatedAt() == null)
                return -1;
            if (a.getCreatedAt() == null)
                return 1;
            return b.getCreatedAt().compareTo(a.getCreatedAt());
        });

        if (purchaseType != null && !purchaseType.isEmpty()) {
            PurchaseType pt = PurchaseType.valueOf(purchaseType);
            orders = orders.stream()
                    .filter(o -> pt.equals(o.getPurchaseType()))
                    .collect(Collectors.toList());
        }

        List<OrderSummary> summaries = orders.stream()
                .map(this::toOrderSummary)
                .collect(Collectors.toList());

        return ResponseEntity.ok(summaries);
    }

    @GetMapping("/orders/{id}")
    public ResponseEntity<Order> getOrderDetail(@PathVariable @NonNull Long id) {
        return orderRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/orders/{id}/status")
    public ResponseEntity<Order> updateOrderStatus(
            @PathVariable @NonNull Long id,
            @RequestBody StatusUpdateRequest request) {

        return orderRepository.findById(id).map(order -> {
            OrderStatus newStatus = OrderStatus.valueOf(request.getStatus());
            order.setStatus(newStatus);

            if (OrderStatus.SHIPPING.equals(newStatus) && order.getTrackingStartedAt() == null) {
                order.setTrackingStartedAt(java.time.ZonedDateTime.now());
            }
            if (OrderStatus.DELIVERED.equals(newStatus)) {
                order.setActualDeliveryDate(java.time.ZonedDateTime.now());
            }

            return ResponseEntity.ok(orderRepository.save(order));
        }).orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/orders/stats")
    public ResponseEntity<OrderStats> getOrderStats() {
        List<Order> allOrders = orderRepository.findAll();

        long pending = allOrders.stream().filter(o -> OrderStatus.PENDING.equals(o.getStatus())).count();
        long processing = allOrders.stream().filter(o -> OrderStatus.PROCESSING.equals(o.getStatus())).count();
        long shipping = allOrders.stream().filter(o -> OrderStatus.SHIPPING.equals(o.getStatus())).count();
        long delivered = allOrders.stream().filter(o -> OrderStatus.DELIVERED.equals(o.getStatus())).count();
        long cancelled = allOrders.stream().filter(o -> OrderStatus.CANCELLED.equals(o.getStatus())).count();

        long websiteOrders = allOrders.stream().filter(o -> PurchaseType.WEBSITE_ORDER.equals(o.getPurchaseType()))
                .count();
        long selfPurchase = allOrders.stream().filter(o -> PurchaseType.SELF_PURCHASE.equals(o.getPurchaseType()))
                .count();

        BigDecimal totalRevenue = allOrders.stream()
                .filter(o -> OrderStatus.DELIVERED.equals(o.getStatus()))
                .map(Order::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        OrderStats stats = new OrderStats();
        stats.setTotal(allOrders.size());
        stats.setPending(pending);
        stats.setProcessing(processing);
        stats.setShipping(shipping);
        stats.setDelivered(delivered);
        stats.setCancelled(cancelled);
        stats.setWebsiteOrders(websiteOrders);
        stats.setSelfPurchase(selfPurchase);
        stats.setTotalRevenue(totalRevenue);

        return ResponseEntity.ok(stats);
    }

    // =============================================
    // STORE CONFIG
    // =============================================

    @GetMapping("/store-config")
    public ResponseEntity<StoreConfig> getStoreConfig() {
        return ResponseEntity.ok(storeConfigRepository.getConfig());
    }

    @PutMapping("/store-config")
    public ResponseEntity<StoreConfig> updateStoreConfig(@RequestBody StoreConfig config) {
        StoreConfig existing = storeConfigRepository.getConfig();
        existing.setStoreName(config.getStoreName());
        existing.setAddress(config.getAddress());
        existing.setLatitude(config.getLatitude());
        existing.setLongitude(config.getLongitude());
        existing.setPhone(config.getPhone());
        existing.setEmail(config.getEmail());
        return ResponseEntity.ok(storeConfigRepository.save(existing));
    }

    // =============================================
    // MARKET PRICE ANALYSIS
    // =============================================

    @GetMapping("/market-prices")
    public ResponseEntity<List<MarketPriceTracking>> getMarketPrices(
            @RequestParam(required = false) Long itemId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {

        List<MarketPriceTracking> prices;

        if (itemId != null) {
            prices = marketPriceTrackingRepository.findByShopItemIdOrderByPurchaseDateDesc(itemId);
        } else {
            prices = marketPriceTrackingRepository.findAll();
            // Sort by purchase date desc
            prices.sort((a, b) -> {
                if (b.getPurchaseDate() == null)
                    return -1;
                if (a.getPurchaseDate() == null)
                    return 1;
                return b.getPurchaseDate().compareTo(a.getPurchaseDate());
            });
        }

        // Filter by date range if provided
        if (from != null) {
            LocalDate fromDate = LocalDate.parse(from);
            prices = prices.stream()
                    .filter(p -> !p.getPurchaseDate().isBefore(fromDate))
                    .collect(Collectors.toList());
        }
        if (to != null) {
            LocalDate toDate = LocalDate.parse(to);
            prices = prices.stream()
                    .filter(p -> !p.getPurchaseDate().isAfter(toDate))
                    .collect(Collectors.toList());
        }

        return ResponseEntity.ok(prices);
    }

    @GetMapping("/price-analysis")
    public ResponseEntity<List<PriceAnalysis>> getPriceAnalysis() {
        List<ShopItem> items = shopItemRepository.findAll();
        List<MarketPriceTracking> allPrices = marketPriceTrackingRepository.findAll();

        List<PriceAnalysis> analysis = new ArrayList<>();

        for (ShopItem item : items) {
            List<MarketPriceTracking> itemPrices = allPrices.stream()
                    .filter(p -> p.getShopItem().getId().equals(item.getId()))
                    .collect(Collectors.toList());

            if (itemPrices.isEmpty())
                continue;

            BigDecimal avgMarketPrice = itemPrices.stream()
                    .map(MarketPriceTracking::getReportedPrice)
                    .reduce(BigDecimal.ZERO, BigDecimal::add)
                    .divide(new BigDecimal(itemPrices.size()), 2, RoundingMode.HALF_UP);

            BigDecimal websitePrice = item.getPrice();
            BigDecimal priceDiff = websitePrice.subtract(avgMarketPrice);
            BigDecimal priceDiffPercent = priceDiff.divide(websitePrice, 4, RoundingMode.HALF_UP)
                    .multiply(new BigDecimal("100"));

            // Recommendation: If website price is >10% higher, suggest reduction
            String recommendation = null;
            BigDecimal suggestedPrice = null;

            if (priceDiffPercent.compareTo(new BigDecimal("10")) > 0) {
                suggestedPrice = avgMarketPrice.multiply(new BigDecimal("1.05"))
                        .setScale(0, RoundingMode.HALF_UP);
                recommendation = "Gia website cao hon thi truong " + priceDiffPercent.setScale(1, RoundingMode.HALF_UP)
                        + "%. De xuat giam xuong " + formatCurrency(suggestedPrice);
            } else if (priceDiffPercent.compareTo(new BigDecimal("-10")) < 0) {
                recommendation = "Gia website thap hon thi truong. Co the tang gia de toi uu loi nhuan.";
                suggestedPrice = avgMarketPrice.setScale(0, RoundingMode.HALF_UP);
            }

            PriceAnalysis pa = new PriceAnalysis();
            pa.setItemId(item.getId());
            pa.setItemName(item.getName());
            pa.setCategory(item.getCategory());
            pa.setWebsitePrice(websitePrice);
            pa.setAvgMarketPrice(avgMarketPrice);
            pa.setPriceDiff(priceDiff);
            pa.setPriceDiffPercent(priceDiffPercent);
            pa.setReportCount(itemPrices.size());
            pa.setRecommendation(recommendation);
            pa.setSuggestedPrice(suggestedPrice);

            analysis.add(pa);
        }

        // Sort by price diff (highest first - items needing attention)
        analysis.sort((a, b) -> b.getPriceDiffPercent().compareTo(a.getPriceDiffPercent()));

        return ResponseEntity.ok(analysis);
    }

    // =============================================
    // DTOs
    // =============================================

    private OrderSummary toOrderSummary(Order order) {
        OrderSummary s = new OrderSummary();
        s.setId(order.getId());
        s.setOrderCode(order.getOrderCode());
        s.setPurchaseType(order.getPurchaseType() != null ? order.getPurchaseType().name() : null);
        s.setStatus(order.getStatus() != null ? order.getStatus().name() : null);
        s.setTotalAmount(order.getTotalAmount());
        s.setPaymentMethod(order.getPaymentMethod() != null ? order.getPaymentMethod().name() : null);
        s.setShippingType(order.getShippingType() != null ? order.getShippingType().name() : null);
        s.setCreatedAt(order.getCreatedAt());
        s.setIsPaid(order.getIsPaid());

        if (order.getUser() != null) {
            s.setUserName(order.getUser().getFullName());
            s.setUserEmail(order.getUser().getEmail());
        }

        return s;
    }

    private String formatCurrency(BigDecimal amount) {
        return String.format("%,.0f VND", amount);
    }

    // Inner DTOs
    @lombok.Data
    public static class OrderSummary {
        private Long id;
        private String orderCode;
        private String userName;
        private String userEmail;
        private String purchaseType;
        private String status;
        private BigDecimal totalAmount;
        private String paymentMethod;
        private String shippingType;
        private java.time.ZonedDateTime createdAt;
        private Boolean isPaid;
    }

    @lombok.Data
    public static class StatusUpdateRequest {
        private String status;
    }

    @lombok.Data
    public static class OrderStats {
        private int total;
        private long pending;
        private long processing;
        private long shipping;
        private long delivered;
        private long cancelled;
        private long websiteOrders;
        private long selfPurchase;
        private BigDecimal totalRevenue;
    }

    @lombok.Data
    public static class PriceAnalysis {
        private Long itemId;
        private String itemName;
        private String category;
        private BigDecimal websitePrice;
        private BigDecimal avgMarketPrice;
        private BigDecimal priceDiff;
        private BigDecimal priceDiffPercent;
        private int reportCount;
        private String recommendation;
        private BigDecimal suggestedPrice;
    }
}
