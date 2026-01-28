package com.agriplanner.service;

import com.agriplanner.model.CropDefinition;
import com.agriplanner.model.MarketPrice;
import com.agriplanner.repository.CropDefinitionRepository;
import com.agriplanner.repository.MarketPriceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Random;

@Service
@RequiredArgsConstructor
@Slf4j
public class MarketSimulationTask {

    private final CropDefinitionRepository cropDefinitionRepository;
    private final MarketPriceRepository marketPriceRepository;
    private final Random random = new Random();

    // Volatility settings (percentage)
    private static final double MAX_VOLATILITY = 0.03; // 3.0%

    // Trend settings
    private double globalMarketTrend = 0.0; // Positive = Bull, Negative = Bear

    @Scheduled(fixedRate = 10000) // Run every 10 seconds
    @Transactional
    public void simulateMarketMovement() {
        List<CropDefinition> crops = cropDefinitionRepository.findAll();

        // Occasionally shift global market trend (10% chance)
        if (random.nextDouble() < 0.1) {
            updateGlobalTrend();
        }

        for (CropDefinition crop : crops) {
            if (crop.getMarketPricePerKg() == null)
                continue;

            java.math.BigDecimal currentPrice = crop.getMarketPricePerKg();

            // Random volatility between -MAX and +MAX
            double volatility = (random.nextDouble() * (MAX_VOLATILITY * 2)) - MAX_VOLATILITY;

            // Individual crop bias (randomly favorable or unfavorable)
            double cropBias = (random.nextDouble() * 0.01) - 0.005;

            double percentChange = globalMarketTrend + volatility + cropBias;

            // Apply change
            java.math.BigDecimal changeFactor = java.math.BigDecimal.valueOf(1 + percentChange);
            java.math.BigDecimal newPrice = currentPrice.multiply(changeFactor);

            // Ensure price doesn't drop too low (< 1000)
            if (newPrice.compareTo(java.math.BigDecimal.valueOf(1000)) < 0) {
                newPrice = java.math.BigDecimal.valueOf(1000);
            }

            // Round to nearest 100
            // Divide by 100, round, multiply by 100
            newPrice = newPrice.divide(java.math.BigDecimal.valueOf(100), 0, java.math.RoundingMode.HALF_UP)
                    .multiply(java.math.BigDecimal.valueOf(100));

            // Update crop definition
            crop.setMarketPricePerKg(newPrice);
            cropDefinitionRepository.save(crop);

            // Save to price history
            MarketPrice history = new MarketPrice();
            history.setCropId(crop.getId());
            history.setPricePerKg(newPrice);
            history.setPriceDate(LocalDateTime.now());
            // Store trend for UI - We'll calculate it dynamically
            marketPriceRepository.save(history);
        }

        log.info("Market simulation updated {} crops. Global Trend: {}", crops.size(),
                String.format("%.4f", globalMarketTrend));
    }

    private void updateGlobalTrend() {
        // Shift trend slightly
        double shift = (random.nextDouble() * 0.01) - 0.005; // +/- 0.5%
        globalMarketTrend += shift;

        // Cap trend to reasonable limits (-2% to +2%)
        if (globalMarketTrend > 0.02)
            globalMarketTrend = 0.02;
        if (globalMarketTrend < -0.02)
            globalMarketTrend = -0.02;
    }
}
