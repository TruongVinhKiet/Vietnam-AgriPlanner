package com.agriplanner.controller;

import com.agriplanner.dto.*;
import com.agriplanner.service.ReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ReviewController {
    private final ReviewService reviewService;

    @GetMapping("/product/{shopItemId}")
    public ResponseEntity<ProductReviewSummaryDTO> getProductReviews(@PathVariable Long shopItemId) {
        return ResponseEntity.ok(reviewService.getProductReviews(shopItemId));
    }

    @PostMapping
    public ResponseEntity<?> createReview(@RequestBody CreateReviewRequest request) {
        try {
            ProductReviewDTO review = reviewService.createReview(request);
            return ResponseEntity.ok(review);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/unrevieweed")
    public ResponseEntity<List<PurchaseHistoryDTO>> getUnreviewedPurchases(@RequestParam String userEmail) {
        return ResponseEntity.ok(reviewService.getUnreviewedPurchases(userEmail));
    }

    @GetMapping("/purchases")
    public ResponseEntity<List<PurchaseHistoryDTO>> getPurchaseHistory(@RequestParam String userEmail) {
        return ResponseEntity.ok(reviewService.getPurchaseHistory(userEmail));
    }

    @GetMapping("/my-reviews")
    public ResponseEntity<List<ProductReviewDTO>> getUserReviews(@RequestParam String userEmail) {
        return ResponseEntity.ok(reviewService.getUserReviews(userEmail));
    }
}
