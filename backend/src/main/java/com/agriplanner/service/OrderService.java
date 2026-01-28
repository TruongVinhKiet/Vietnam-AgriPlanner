package com.agriplanner.service;

import com.agriplanner.dto.OrderDTO.*;
import com.agriplanner.model.*;
import com.agriplanner.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderService {

    private final OrderRepository orderRepository;
    private final ShopItemRepository shopItemRepository;
    private final UserAddressRepository addressRepository;
    private final ShippingRateRepository shippingRateRepository;
    private final MarketPriceTrackingRepository marketPriceRepository;
    private final UserRepository userRepository;
    private final UserInventoryRepository userInventoryRepository;

    // Warehouse location (default origin for shipping calculation)
    private static final BigDecimal WAREHOUSE_LAT = new BigDecimal("10.8589");
    private static final BigDecimal WAREHOUSE_LNG = new BigDecimal("106.7839");
    private static final BigDecimal DISCOUNT_PERCENT = new BigDecimal("5");

    @Transactional
    public OrderResponse createOrder(Long userId, CreateOrderRequest request) {
        User user = userRepository.findById(Objects.requireNonNull(userId, "User ID cannot be null"))
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Generate order code
        String orderCode = orderRepository.generateOrderCode();

        Order order = Order.builder()
                .orderCode(orderCode)
                .user(user)
                .purchaseType(request.getPurchaseType())
                .status(Order.OrderStatus.PENDING)
                .notes(request.getNotes())
                .build();

        // Calculate subtotal from items
        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal totalWeight = BigDecimal.ZERO;
        List<OrderItem> orderItems = new ArrayList<>();

        for (OrderItemRequest itemReq : request.getItems()) {
            ShopItem shopItem = shopItemRepository
                    .findById(Objects.requireNonNull(itemReq.getShopItemId(), "Shop item ID cannot be null"))
                    .orElseThrow(() -> new RuntimeException("Shop item not found: " + itemReq.getShopItemId()));

            BigDecimal unitPrice = itemReq.getUnitPrice() != null ? itemReq.getUnitPrice() : shopItem.getPrice();
            BigDecimal itemTotal = unitPrice.multiply(BigDecimal.valueOf(itemReq.getQuantity()));
            BigDecimal itemWeight = shopItem.getWeightKg() != null
                    ? shopItem.getWeightKg().multiply(BigDecimal.valueOf(itemReq.getQuantity()))
                    : BigDecimal.ZERO;

            OrderItem orderItem = OrderItem.builder()
                    .order(order)
                    .shopItem(shopItem)
                    .quantity(itemReq.getQuantity())
                    .unitPrice(unitPrice)
                    .totalPrice(itemTotal)
                    .weightKg(itemWeight)
                    .build();

            orderItems.add(orderItem);
            subtotal = subtotal.add(itemTotal);
            totalWeight = totalWeight.add(itemWeight);
        }

        order.setSubtotal(subtotal);
        order.setItems(orderItems);

        if (request.getPurchaseType() == Order.PurchaseType.SELF_PURCHASE) {
            // Self purchase - user enters price they paid in market
            order.setSelfPurchasePrice(request.getSelfPurchasePrice());
            order.setTotalAmount(request.getSelfPurchasePrice());
            order.setStatus(Order.OrderStatus.DELIVERED);
            order.setIsPaid(true);
            order.setPaidAt(ZonedDateTime.now());
            order.setActualDeliveryDate(ZonedDateTime.now());

            // Deduct from balance
            deductFromBalance(user, request.getSelfPurchasePrice());

            // Add to inventory
            for (OrderItemRequest itemReq : request.getItems()) {
                addToInventory(Objects.requireNonNull(userId, "User ID cannot be null"),
                        Objects.requireNonNull(itemReq.getShopItemId(), "Shop item ID cannot be null"),
                        itemReq.getQuantity());
            }

            // Track market price
            for (OrderItemRequest itemReq : request.getItems()) {
                ShopItem item = shopItemRepository
                        .findById(Objects.requireNonNull(itemReq.getShopItemId(), "Shop item ID cannot be null"))
                        .orElse(null);
                if (item != null) {
                    BigDecimal pricePerUnit = request.getSelfPurchasePrice()
                            .divide(BigDecimal.valueOf(itemReq.getQuantity()), 2, RoundingMode.HALF_UP);

                    MarketPriceTracking tracking = MarketPriceTracking.builder()
                            .shopItem(Objects.requireNonNull(item, "Shop item cannot be null"))
                            .user(user)
                            .reportedPrice(pricePerUnit)
                            .quantity(BigDecimal.valueOf(itemReq.getQuantity()))
                            .notes(request.getNotes())
                            .build();
                    marketPriceRepository
                            .save(Objects.requireNonNull(tracking, "Market price tracking cannot be null"));
                }
            }

        } else {
            // Website order - full checkout flow
            order.setShippingType(request.getShippingType());
            order.setPaymentMethod(request.getPaymentMethod());

            // Get shipping address - support both database address and direct profile
            // address
            if (request.getShippingAddressId() != null) {
                // Address from database
                UserAddress address = addressRepository
                        .findById(Objects.requireNonNull(request.getShippingAddressId(),
                                "Shipping address ID cannot be null"))
                        .orElseThrow(() -> new RuntimeException("Address not found"));
                order.setShippingAddress(address);
                order.setShippingAddressText(address.getFullAddress());
                order.setDestLat(address.getLatitude());
                order.setDestLng(address.getLongitude());
            } else if (request.getDestLat() != null && request.getDestLng() != null) {
                // Address from user profile - use direct coordinates
                order.setShippingAddressText(request.getShippingAddressText());
                order.setDestLat(request.getDestLat());
                order.setDestLng(request.getDestLng());
            }

            // Set origin (warehouse)
            order.setOriginLat(WAREHOUSE_LAT);
            order.setOriginLng(WAREHOUSE_LNG);

            // Calculate shipping fee
            ShippingRate rate = shippingRateRepository.findByShippingType(request.getShippingType())
                    .orElseThrow(() -> new RuntimeException("Shipping rate not found"));

            BigDecimal distance = calculateDistance(WAREHOUSE_LAT, WAREHOUSE_LNG,
                    order.getDestLat(), order.getDestLng());
            order.setDistanceKm(distance);

            BigDecimal shippingFee = rate.calculateFee(distance, totalWeight);
            order.setShippingFee(shippingFee);

            // Calculate estimated delivery
            ZonedDateTime estimatedDelivery = ZonedDateTime.now().plusDays(rate.getMaxDays());
            order.setEstimatedDeliveryDate(estimatedDelivery);

            // Calculate totals
            BigDecimal totalBeforeDiscount = subtotal.add(shippingFee);

            if (request.getPaymentMethod() == Order.PaymentMethod.PAY_NOW) {
                // 5% discount for pay now
                order.setDiscountPercent(DISCOUNT_PERCENT);
                BigDecimal discountAmount = totalBeforeDiscount.multiply(DISCOUNT_PERCENT)
                        .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
                order.setDiscountAmount(discountAmount);
                order.setTotalAmount(totalBeforeDiscount.subtract(discountAmount));

                // Deduct from balance immediately
                deductFromBalance(user, order.getTotalAmount());
                order.setIsPaid(true);
                order.setPaidAt(ZonedDateTime.now());
            } else {
                // Pay on delivery - no discount
                order.setTotalAmount(totalBeforeDiscount);
                order.setIsPaid(false);
            }

            order.setStatus(Order.OrderStatus.PROCESSING);
        }

        Order savedOrder = orderRepository.save(order);
        return mapToResponse(savedOrder);
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> getUserOrders(Long userId) {
        return orderRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public OrderResponse getOrder(Long userId, Long orderId) {
        Order order = orderRepository.findByIdAndUserId(orderId, userId)
                .orElseThrow(() -> new RuntimeException("Order not found"));
        return mapToResponse(order);
    }

    @Transactional(readOnly = true)
    public OrderResponse getOrderByCode(String orderCode) {
        Order order = orderRepository.findByOrderCode(orderCode)
                .orElseThrow(() -> new RuntimeException("Order not found"));
        return mapToResponse(order);
    }

    @Transactional
    public OrderResponse startShipping(Long orderId) {
        Order order = orderRepository.findById(Objects.requireNonNull(orderId, "Order ID cannot be null"))
                .orElseThrow(() -> new RuntimeException("Order not found"));

        if (order.getStatus() != Order.OrderStatus.PROCESSING) {
            throw new RuntimeException("Order cannot be shipped");
        }

        order.setStatus(Order.OrderStatus.SHIPPING);
        order.setTrackingStartedAt(ZonedDateTime.now());
        order.setCurrentLat(order.getOriginLat());
        order.setCurrentLng(order.getOriginLng());

        return mapToResponse(orderRepository.save(order));
    }

    @Transactional
    public OrderResponse confirmDelivery(Long userId, Long orderId) {
        Order order = orderRepository.findByIdAndUserId(orderId, userId)
                .orElseThrow(() -> new RuntimeException("Order not found"));

        if (order.getStatus() != Order.OrderStatus.SHIPPING) {
            throw new RuntimeException("Order is not in shipping status");
        }

        order.setStatus(Order.OrderStatus.DELIVERED);
        order.setActualDeliveryDate(ZonedDateTime.now());

        // If pay on delivery, deduct from balance now
        if (!order.getIsPaid()) {
            User user = order.getUser();
            deductFromBalance(user, order.getTotalAmount());
            order.setIsPaid(true);
            order.setPaidAt(ZonedDateTime.now());
        }

        // Add items to inventory
        for (OrderItem item : order.getItems()) {
            addToInventory(Objects.requireNonNull(userId, "User ID cannot be null"),
                    Objects.requireNonNull(item.getShopItem().getId(), "Shop item ID cannot be null"),
                    item.getQuantity());
        }

        return mapToResponse(orderRepository.save(order));
    }

    @Transactional
    public OrderResponse cancelOrder(Long userId, Long orderId) {
        Order order = orderRepository.findByIdAndUserId(orderId, userId)
                .orElseThrow(() -> new RuntimeException("Order not found"));

        if (order.getStatus() == Order.OrderStatus.DELIVERED ||
                order.getStatus() == Order.OrderStatus.CANCELLED) {
            throw new RuntimeException("Cannot cancel this order");
        }

        // Refund if already paid
        if (order.getIsPaid()) {
            User user = order.getUser();
            user.setBalance(user.getBalance().add(order.getTotalAmount()));
            userRepository.save(user);
        }

        order.setStatus(Order.OrderStatus.CANCELLED);
        return mapToResponse(orderRepository.save(order));
    }

    @Transactional(readOnly = true)
    public TrackingInfo getTrackingInfo(Long orderId) {
        Order order = orderRepository.findById(Objects.requireNonNull(orderId, "Order ID cannot be null"))
                .orElseThrow(() -> new RuntimeException("Order not found"));

        if (order.getStatus() != Order.OrderStatus.SHIPPING || order.getTrackingStartedAt() == null) {
            return null;
        }

        // Calculate current position based on time elapsed and speed
        ShippingRate rate = shippingRateRepository.findByShippingType(order.getShippingType())
                .orElse(null);

        if (rate == null) {
            return buildTrackingInfo(order, BigDecimal.ZERO);
        }

        // Calculate elapsed time
        Duration elapsed = Duration.between(order.getTrackingStartedAt(), ZonedDateTime.now());
        double hoursElapsed = elapsed.toMinutes() / 60.0;
        double daysElapsed = hoursElapsed / 24.0;

        // Calculate distance traveled
        BigDecimal speedPerDay = rate.getSpeedKmPerDay();
        BigDecimal distanceTraveled = speedPerDay.multiply(BigDecimal.valueOf(daysElapsed));
        BigDecimal totalDistance = order.getDistanceKm();

        // Calculate progress
        BigDecimal progress;
        if (totalDistance.compareTo(BigDecimal.ZERO) > 0) {
            progress = distanceTraveled.divide(totalDistance, 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
                    .min(BigDecimal.valueOf(100));
        } else {
            progress = BigDecimal.valueOf(100);
        }

        // Calculate current position (linear interpolation)
        double progressRatio = progress.doubleValue() / 100.0;
        BigDecimal currentLat = interpolate(order.getOriginLat(), order.getDestLat(), progressRatio);
        BigDecimal currentLng = interpolate(order.getOriginLng(), order.getDestLng(), progressRatio);

        // Update order position
        order.setCurrentLat(currentLat);
        order.setCurrentLng(currentLng);

        return buildTrackingInfo(order, progress);
    }

    public ShippingCalculationResponse calculateShipping(Long userId, ShippingCalculationRequest request) {
        BigDecimal destLat = null;
        BigDecimal destLng = null;

        // Priority: direct coordinates > addressId lookup
        if (request.getLatitude() != null && request.getLongitude() != null) {
            destLat = request.getLatitude();
            destLng = request.getLongitude();
        } else if (request.getAddressId() != null) {
            UserAddress address = addressRepository.findByIdAndUserId(request.getAddressId(), userId)
                    .orElseThrow(() -> new RuntimeException("Address not found"));
            destLat = address.getLatitude();
            destLng = address.getLongitude();
        }

        // Calculate total weight
        BigDecimal totalWeight = BigDecimal.ZERO;
        for (OrderItemRequest item : request.getItems()) {
            ShopItem shopItem = shopItemRepository
                    .findById(Objects.requireNonNull(item.getShopItemId(), "Shop item ID cannot be null")).orElse(null);
            if (shopItem != null && shopItem.getWeightKg() != null) {
                totalWeight = totalWeight.add(
                        shopItem.getWeightKg().multiply(BigDecimal.valueOf(item.getQuantity())));
            }
        }

        // Calculate distance
        BigDecimal distance = BigDecimal.ZERO;
        if (destLat != null && destLng != null) {
            distance = calculateDistance(WAREHOUSE_LAT, WAREHOUSE_LNG, destLat, destLng);
        }

        // Get all shipping options
        List<ShippingRate> rates = shippingRateRepository.findByIsActiveTrueOrderByBaseFeeAsc();
        List<ShippingOption> options = new ArrayList<>();

        for (ShippingRate rate : rates) {
            BigDecimal fee = rate.calculateFee(distance, totalWeight);
            String estimatedDays = rate.getMinDays() == rate.getMaxDays()
                    ? rate.getMinDays() + " ngay"
                    : rate.getMinDays() + "-" + rate.getMaxDays() + " ngay";

            options.add(ShippingOption.builder()
                    .type(rate.getShippingType())
                    .displayName(rate.getDisplayName())
                    .fee(fee)
                    .estimatedDays(estimatedDays)
                    .minDays(rate.getMinDays())
                    .maxDays(rate.getMaxDays())
                    .build());
        }

        return ShippingCalculationResponse.builder()
                .distanceKm(distance)
                .totalWeightKg(totalWeight)
                .options(options)
                .build();
    }

    private void deductFromBalance(User user, BigDecimal amount) {
        if (user.getBalance().compareTo(amount) < 0) {
            throw new RuntimeException(
                    "Insufficient balance. Required: " + amount + ", Available: " + user.getBalance());
        }
        user.setBalance(user.getBalance().subtract(amount));
        userRepository.save(user);
    }

    private void addToInventory(Long userId, Long shopItemId, Integer quantity) {
        ShopItem shopItem = shopItemRepository
                .findById(Objects.requireNonNull(shopItemId, "Shop item ID cannot be null")).orElse(null);
        if (shopItem == null)
            return;

        Optional<UserInventory> existing = userInventoryRepository.findByUserIdAndShopItemId(
                Objects.requireNonNull(userId, "User ID cannot be null"),
                Objects.requireNonNull(shopItemId, "Shop item ID cannot be null"));
        UserInventory inventory;

        if (existing.isPresent()) {
            inventory = existing.get();
            inventory.addQuantity(BigDecimal.valueOf(quantity));
        } else {
            inventory = new UserInventory(userId, shopItem, BigDecimal.valueOf(quantity));
        }

        userInventoryRepository.save(inventory);
        log.info("[ORDER] Added {} x {} to user {} inventory", quantity, shopItem.getName(), userId);
    }

    private BigDecimal calculateDistance(BigDecimal lat1, BigDecimal lng1, BigDecimal lat2, BigDecimal lng2) {
        if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) {
            return BigDecimal.valueOf(10); // Default 10km if coordinates missing
        }

        // Haversine formula
        double R = 6371; // Earth radius in km
        double dLat = Math.toRadians(lat2.doubleValue() - lat1.doubleValue());
        double dLon = Math.toRadians(lng2.doubleValue() - lng1.doubleValue());
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1.doubleValue())) * Math.cos(Math.toRadians(lat2.doubleValue())) *
                        Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        double distance = R * c;

        return BigDecimal.valueOf(distance).setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal interpolate(BigDecimal start, BigDecimal end, double ratio) {
        if (start == null || end == null)
            return start;
        double startVal = start.doubleValue();
        double endVal = end.doubleValue();
        double result = startVal + (endVal - startVal) * ratio;
        return BigDecimal.valueOf(result).setScale(8, RoundingMode.HALF_UP);
    }

    private TrackingInfo buildTrackingInfo(Order order, BigDecimal progress) {
        String timeRemaining = "";
        if (order.getEstimatedDeliveryDate() != null) {
            Duration remaining = Duration.between(ZonedDateTime.now(), order.getEstimatedDeliveryDate());
            if (remaining.isNegative()) {
                timeRemaining = "Sap den";
            } else {
                long hours = remaining.toHours();
                if (hours >= 24) {
                    timeRemaining = (hours / 24) + " ngay";
                } else {
                    timeRemaining = hours + " gio";
                }
            }
        }

        return TrackingInfo.builder()
                .currentLat(order.getCurrentLat())
                .currentLng(order.getCurrentLng())
                .originLat(order.getOriginLat())
                .originLng(order.getOriginLng())
                .destLat(order.getDestLat())
                .destLng(order.getDestLng())
                .trackingStartedAt(order.getTrackingStartedAt())
                .progressPercent(progress)
                .estimatedTimeRemaining(timeRemaining)
                .build();
    }

    private OrderResponse mapToResponse(Order order) {
        List<OrderItemResponse> items = order.getItems().stream()
                .map(item -> OrderItemResponse.builder()
                        .id(item.getId())
                        .shopItemId(item.getShopItem().getId())
                        .itemName(item.getShopItem().getName())
                        .itemImage(item.getShopItem().getImageUrl())
                        .quantity(item.getQuantity())
                        .unitPrice(item.getUnitPrice())
                        .totalPrice(item.getTotalPrice())
                        .weightKg(item.getWeightKg())
                        .build())
                .collect(Collectors.toList());

        TrackingInfo tracking = null;
        if (order.getStatus() == Order.OrderStatus.SHIPPING) {
            tracking = getTrackingInfo(order.getId());
        }

        return OrderResponse.builder()
                .id(order.getId())
                .orderCode(order.getOrderCode())
                .purchaseType(order.getPurchaseType())
                .shippingType(order.getShippingType())
                .shippingAddressText(order.getShippingAddressText())
                .shippingFee(order.getShippingFee())
                .distanceKm(order.getDistanceKm())
                .paymentMethod(order.getPaymentMethod())
                .discountPercent(order.getDiscountPercent())
                .subtotal(order.getSubtotal())
                .discountAmount(order.getDiscountAmount())
                .totalAmount(order.getTotalAmount())
                .selfPurchasePrice(order.getSelfPurchasePrice())
                .status(order.getStatus())
                .estimatedDeliveryDate(order.getEstimatedDeliveryDate())
                .actualDeliveryDate(order.getActualDeliveryDate())
                .isPaid(order.getIsPaid())
                .paidAt(order.getPaidAt())
                .notes(order.getNotes())
                .createdAt(order.getCreatedAt())
                .items(items)
                .tracking(tracking)
                .build();
    }
}
