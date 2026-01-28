package com.agriplanner.service;

import com.agriplanner.dto.*;
import com.agriplanner.model.*;
import com.agriplanner.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class ReviewService {
    private final ProductReviewRepository reviewRepository;
    private final PurchaseHistoryRepository purchaseRepository;
    private final ShopItemRepository shopItemRepository;
    private final UserRepository userRepository;

    public ProductReviewSummaryDTO getProductReviews(Long shopItemId) {
        List<ProductReview> reviews = reviewRepository.findByShopItemIdOrderByCreatedAtDesc(shopItemId);
        
        Double avgRating = reviewRepository.getAverageRatingByShopItemId(shopItemId);
        int totalReviews = reviewRepository.countByShopItemId(shopItemId);
        
        // Get rating distribution
        Map<Integer, Integer> distribution = new HashMap<>();
        for (int i = 1; i <= 5; i++) {
            distribution.put(i, 0);
        }
        List<Object[]> distData = reviewRepository.getRatingDistributionByShopItemId(shopItemId);
        for (Object[] row : distData) {
            distribution.put((Integer) row[0], ((Long) row[1]).intValue());
        }
        
        // Get recent reviews (limit 10)
        List<ProductReviewDTO> recentReviews = reviews.stream()
                .limit(10)
                .map(this::toReviewDTO)
                .collect(Collectors.toList());
        
        return ProductReviewSummaryDTO.builder()
                .averageRating(avgRating != null ? avgRating : 5.0)
                .totalReviews(totalReviews)
                .ratingDistribution(distribution)
                .recentReviews(recentReviews)
                .build();
    }

    @Transactional
    public ProductReviewDTO createReview(CreateReviewRequest request) {
        User user = userRepository.findByEmail(request.getUserEmail())
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        PurchaseHistory purchase = purchaseRepository.findById(request.getPurchaseId())
                .orElseThrow(() -> new RuntimeException("Purchase not found"));
        
        // Verify ownership
        if (!purchase.getUser().getId().equals(user.getId())) {
            throw new RuntimeException("Not authorized to review this purchase");
        }
        
        // Check if already reviewed
        if (reviewRepository.existsByPurchaseId(request.getPurchaseId())) {
            throw new RuntimeException("This purchase has already been reviewed");
        }
        
        // Validate rating
        if (request.getRating() < 1 || request.getRating() > 5) {
            throw new RuntimeException("Rating must be between 1 and 5");
        }
        
        ProductReview review = ProductReview.builder()
                .user(user)
                .shopItem(purchase.getShopItem())
                .purchase(purchase)
                .rating(request.getRating())
                .comment(request.getComment())
                .isVerifiedPurchase(true)
                .build();
        
        review = reviewRepository.save(review);
        
        // Update shop item average rating
        updateShopItemRating(purchase.getShopItem().getId());
        
        return toReviewDTO(review);
    }

    public List<PurchaseHistoryDTO> getUnreviewedPurchases(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        List<PurchaseHistory> purchases = purchaseRepository.findUnreviewedPurchasesByUserId(user.getId());
        
        return purchases.stream()
                .map(this::toPurchaseHistoryDTO)
                .collect(Collectors.toList());
    }

    public List<PurchaseHistoryDTO> getPurchaseHistory(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        List<PurchaseHistory> purchases = purchaseRepository.findByUserIdOrderByPurchasedAtDesc(user.getId());
        
        return purchases.stream()
                .map(this::toPurchaseHistoryDTO)
                .collect(Collectors.toList());
    }

    public List<ProductReviewDTO> getUserReviews(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        return reviewRepository.findByUserIdOrderByCreatedAtDesc(user.getId()).stream()
                .map(this::toReviewDTO)
                .collect(Collectors.toList());
    }

    private void updateShopItemRating(Long shopItemId) {
        Double avgRating = reviewRepository.getAverageRatingByShopItemId(shopItemId);
        if (avgRating != null) {
            ShopItem item = shopItemRepository.findById(shopItemId).orElse(null);
            if (item != null) {
                item.setRating(java.math.BigDecimal.valueOf(avgRating));
                shopItemRepository.save(item);
            }
        }
    }

    private ProductReviewDTO toReviewDTO(ProductReview review) {
        return ProductReviewDTO.builder()
                .id(review.getId())
                .shopItemId(review.getShopItem().getId())
                .purchaseId(review.getPurchase().getId())
                .userName(review.getUser().getFullName())
                .userAvatar(review.getUser().getAvatarUrl())
                .rating(review.getRating())
                .comment(review.getComment())
                .isVerifiedPurchase(review.getIsVerifiedPurchase())
                .createdAt(review.getCreatedAt())
                .build();
    }

    private PurchaseHistoryDTO toPurchaseHistoryDTO(PurchaseHistory purchase) {
        ShopItem item = purchase.getShopItem();
        ProductReview review = purchase.getReview();
        
        return PurchaseHistoryDTO.builder()
                .id(purchase.getId())
                .shopItemId(item.getId())
                .itemName(item.getName())
                .itemCategory(item.getCategory())
                .imageUrl(item.getImageUrl())
                .iconName(item.getIconName())
                .quantity(purchase.getQuantity())
                .unit(item.getUnit())
                .unitPrice(purchase.getUnitPrice())
                .totalPrice(purchase.getTotalPrice())
                .purchasedAt(purchase.getPurchasedAt())
                .isReviewed(review != null)
                .review(review != null ? toReviewDTO(review) : null)
                .build();
    }
}
