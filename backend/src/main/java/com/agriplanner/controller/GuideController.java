package com.agriplanner.controller;

import com.agriplanner.model.Guide;
import com.agriplanner.model.GuideCategory;
import com.agriplanner.repository.GuideCategoryRepository;
import com.agriplanner.repository.GuideRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/guides")
@RequiredArgsConstructor
public class GuideController {

    private final GuideRepository guideRepository;
    private final GuideCategoryRepository categoryRepository;

    // ==================== PUBLIC ENDPOINTS ====================

    @GetMapping
    public ResponseEntity<Page<Guide>> getPublishedGuides(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(
                guideRepository.findByIsPublishedTrueOrderByCreatedAtDesc(PageRequest.of(page, size)));
    }

    @GetMapping("/{slug}")
    public ResponseEntity<Guide> getGuideBySlug(@PathVariable String slug) {
        return guideRepository.findBySlug(slug)
                .filter(Guide::getIsPublished)
                .map(guide -> {
                    // Increment view count
                    guide.setViewCount(guide.getViewCount() + 1);
                    guideRepository.save(guide);
                    return ResponseEntity.ok(guide);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/category/{slug}")
    public ResponseEntity<Page<Guide>> getGuidesByCategory(
            @PathVariable String slug,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return categoryRepository.findBySlug(slug)
                .map(category -> ResponseEntity.ok(
                        guideRepository.findByCategoryIdAndIsPublishedTrueOrderByCreatedAtDesc(
                                category.getId(), PageRequest.of(page, size))))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/featured")
    public ResponseEntity<List<Guide>> getFeaturedGuides() {
        return ResponseEntity.ok(guideRepository.findByIsFeaturedTrueAndIsPublishedTrueOrderByCreatedAtDesc());
    }

    @GetMapping("/search")
    public ResponseEntity<Page<Guide>> searchGuides(
            @RequestParam String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(guideRepository.searchPublished(q, PageRequest.of(page, size)));
    }

    // ==================== CATEGORIES ====================

    @GetMapping("/categories")
    public ResponseEntity<List<GuideCategory>> getCategories() {
        return ResponseEntity.ok(categoryRepository.findByParentIsNullOrderBySortOrderAsc());
    }

    @GetMapping("/categories/{slug}")
    public ResponseEntity<GuideCategory> getCategoryBySlug(@PathVariable String slug) {
        return categoryRepository.findBySlug(slug)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
