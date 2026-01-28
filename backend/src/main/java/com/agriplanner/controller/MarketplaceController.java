package com.agriplanner.controller;

import com.agriplanner.model.MarketPrice;
import com.agriplanner.model.CropDefinition;
import com.agriplanner.repository.MarketPriceRepository;
import com.agriplanner.repository.CropDefinitionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * REST Controller for Marketplace
 */
@RestController
@RequestMapping("/api/marketplace")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class MarketplaceController {

    private final MarketPriceRepository marketPriceRepository;
    private final CropDefinitionRepository cropDefinitionRepository;

    @GetMapping("/prices")
    public ResponseEntity<List<MarketPrice>> getAllPrices() {
        return ResponseEntity.ok(marketPriceRepository.findTop20ByOrderByPriceDateDesc());
    }

    @GetMapping("/prices/crop/{cropId}")
    public ResponseEntity<List<MarketPrice>> getPricesByCrop(@PathVariable Long cropId) {
        return ResponseEntity.ok(marketPriceRepository.findByCropIdOrderByPriceDateDesc(cropId));
    }

    @GetMapping("/overview")
    public ResponseEntity<List<Map<String, Object>>> getMarketOverview() {
        List<CropDefinition> crops = cropDefinitionRepository.findAll();
        List<Map<String, Object>> overview = new ArrayList<>();

        for (CropDefinition crop : crops) {
            if (crop.getMarketPricePerKg() == null)
                continue;

            Map<String, Object> item = new HashMap<>();
            item.put("cropId", crop.getId());
            item.put("cropName", crop.getName());
            item.put("category", crop.getCategory());
            item.put("currentPrice", crop.getMarketPricePerKg());
            item.put("imageUrl", crop.getImageUrl());

            // Calculate change based on history
            // Get most recent previous price (limit 2 to get current and previous)
            List<MarketPrice> history = marketPriceRepository.findByCropIdOrderByPriceDateDesc(crop.getId());

            double change = 0.0;
            String trend = "stable";

            if (history.size() >= 2) {
                // history[0] is often the current one we just fetched from crop def
                // history[1] is the previous one

                java.math.BigDecimal current = crop.getMarketPricePerKg();
                java.math.BigDecimal previous = history.get(1).getPricePerKg();

                if (previous.compareTo(java.math.BigDecimal.ZERO) > 0) {
                    // ((current - previous) / previous) * 100
                    java.math.BigDecimal diff = current.subtract(previous);
                    double percent = diff.divide(previous, 4, java.math.RoundingMode.HALF_UP).doubleValue() * 100.0;
                    change = percent;
                }

                if (change > 0.1)
                    trend = "up";
                else if (change < -0.1)
                    trend = "down";
            } else {
                // Fallback for initial data (simulate small random change for liveliness if
                // empty)
                change = (Math.random() * 2) - 1;
            }

            item.put("priceChange", Math.round(change * 100.0) / 100.0);
            item.put("trend", trend);

            overview.add(item);
        }

        return ResponseEntity.ok(overview);
    }
}
