package com.agriplanner.config;

import com.agriplanner.model.*;
import com.agriplanner.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Initializes shop items from existing definition tables
 * Lấy dữ liệu từ các bảng có sẵn: crop_definitions, fertilizer_definitions,
 * feed_definitions, animal_definitions, machinery_definitions, pest_definitions
 */
@Component
@Order(3)
public class ShopDataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(ShopDataInitializer.class);

    private final ShopItemRepository shopItemRepository;
    private final CropDefinitionRepository cropDefinitionRepository;
    private final FertilizerDefinitionRepository fertilizerDefinitionRepository;
    private final FeedDefinitionRepository feedDefinitionRepository;
    private final AnimalDefinitionRepository animalDefinitionRepository;
    private final MachineryDefinitionRepository machineryDefinitionRepository;
    private final PestDefinitionRepository pestDefinitionRepository;

    public ShopDataInitializer(
            ShopItemRepository shopItemRepository,
            CropDefinitionRepository cropDefinitionRepository,
            FertilizerDefinitionRepository fertilizerDefinitionRepository,
            FeedDefinitionRepository feedDefinitionRepository,
            AnimalDefinitionRepository animalDefinitionRepository,
            MachineryDefinitionRepository machineryDefinitionRepository,
            PestDefinitionRepository pestDefinitionRepository) {
        this.shopItemRepository = shopItemRepository;
        this.cropDefinitionRepository = cropDefinitionRepository;
        this.fertilizerDefinitionRepository = fertilizerDefinitionRepository;
        this.feedDefinitionRepository = feedDefinitionRepository;
        this.animalDefinitionRepository = animalDefinitionRepository;
        this.machineryDefinitionRepository = machineryDefinitionRepository;
        this.pestDefinitionRepository = pestDefinitionRepository;
    }

    @Override
    public void run(String... args) {
        log.info("=== ShopDataInitializer Starting ===");
        
        if (shopItemRepository.count() > 0) {
            log.info("Shop items already exist ({}), skipping seed...", shopItemRepository.count());
            return;
        }

        List<ShopItem> items = new ArrayList<>();

        // ===================== HAT GIONG - Tu crop_definitions =====================
        log.info("Loading seeds from crop_definitions...");
        List<CropDefinition> crops = cropDefinitionRepository.findAll();
        for (CropDefinition crop : crops) {
            ShopItem seed = new ShopItem();
            seed.setName("Hat giong " + crop.getName());
            seed.setCategory("HAT_GIONG");
            seed.setSubCategory(crop.getCategory());
            seed.setDescription(crop.getDescription() != null ? crop.getDescription() : 
                "Hat giong " + crop.getName() + " chat luong cao");
            seed.setUnit("kg");
            seed.setPrice(crop.getSeedCostPerKg() != null ? crop.getSeedCostPerKg() : new BigDecimal("50000"));
            seed.setIconName("fa-seedling");
            seed.setImageUrl(crop.getImageUrl());
            seed.setCropDefinitionId(crop.getId());
            seed.setIsFeatured("VEGETABLE".equals(crop.getCategory()));
            items.add(seed);
        }
        log.info("Added {} seed items from crop_definitions", crops.size());

        // ===================== PHAN BON - Tu fertilizer_definitions =====================
        log.info("Loading fertilizers from fertilizer_definitions...");
        List<FertilizerDefinition> fertilizers = fertilizerDefinitionRepository.findAll();
        for (FertilizerDefinition fert : fertilizers) {
            ShopItem fertItem = new ShopItem();
            fertItem.setName(fert.getName());
            fertItem.setCategory("PHAN_BON");
            fertItem.setSubCategory(fert.getType());
            fertItem.setDescription(fert.getDescription() != null ? fert.getDescription() :
                "Phan bon " + fert.getName());
            fertItem.setUnit("kg");
            fertItem.setPrice(fert.getCostPerKg() != null ? fert.getCostPerKg() : new BigDecimal("25000"));
            fertItem.setIconName("fa-leaf");
            fertItem.setImageUrl(fert.getImageUrl());
            fertItem.setIsFeatured("organic".equalsIgnoreCase(fert.getType()));
            items.add(fertItem);
        }
        log.info("Added {} fertilizer items from fertilizer_definitions", fertilizers.size());

        // ===================== THUC AN - Tu feed_definitions =====================
        log.info("Loading feeds from feed_definitions...");
        List<FeedDefinition> feeds = feedDefinitionRepository.findAll();
        for (FeedDefinition feed : feeds) {
            ShopItem feedItem = new ShopItem();
            feedItem.setName(feed.getName());
            feedItem.setCategory("THUC_AN");
            feedItem.setSubCategory(feed.getCategory());
            feedItem.setDescription(feed.getDescription() != null ? feed.getDescription() :
                "Thuc an " + feed.getName());
            feedItem.setUnit(feed.getUnit() != null ? feed.getUnit() : "kg");
            feedItem.setPrice(feed.getPricePerUnit() != null ? feed.getPricePerUnit() : new BigDecimal("20000"));
            feedItem.setIconName("fa-bowl-food");
            feedItem.setFeedDefinitionId(feed.getId());
            feedItem.setIsFeatured(feed.getProteinPercent() != null && 
                feed.getProteinPercent().compareTo(new BigDecimal("20")) > 0);
            items.add(feedItem);
        }
        log.info("Added {} feed items from feed_definitions", feeds.size());

        // ===================== CON GIONG - Tu animal_definitions =====================
        log.info("Loading animals from animal_definitions...");
        List<AnimalDefinition> animals = animalDefinitionRepository.findAll();
        for (AnimalDefinition animal : animals) {
            ShopItem animalItem = new ShopItem();
            animalItem.setName("Con giong " + animal.getName());
            animalItem.setCategory("CON_GIONG");
            animalItem.setSubCategory(animal.getCategory());
            animalItem.setDescription(animal.getDescription() != null ? animal.getDescription() :
                "Con giong " + animal.getName() + " khoe manh");
            animalItem.setUnit(animal.getUnit() != null ? animal.getUnit() : "con");
            animalItem.setPrice(animal.getBuyPricePerUnit() != null ? animal.getBuyPricePerUnit() : new BigDecimal("100000"));
            animalItem.setIconName(animal.getIconName() != null ? animal.getIconName() : "fa-paw");
            animalItem.setImageUrl(animal.getImageUrl());
            animalItem.setIsFeatured("LAND".equals(animal.getCategory()));
            items.add(animalItem);
        }
        log.info("Added {} animal items from animal_definitions", animals.size());

        // ===================== MAY MOC - Tu machinery_definitions =====================
        log.info("Loading machinery from machinery_definitions...");
        List<MachineryDefinition> machines = machineryDefinitionRepository.findAll();
        for (MachineryDefinition machine : machines) {
            ShopItem machineItem = new ShopItem();
            machineItem.setName(machine.getName());
            machineItem.setCategory("MAY_MOC");
            machineItem.setSubCategory(machine.getType());
            machineItem.setDescription(machine.getDescription() != null ? machine.getDescription() :
                "May moc " + machine.getName());
            machineItem.setUnit("cai");
            // Giá thuê/giờ x 100 giờ = giá mua ước tính
            BigDecimal price = machine.getRentalCostPerHour() != null ? 
                machine.getRentalCostPerHour().multiply(new BigDecimal("100")) : new BigDecimal("5000000");
            machineItem.setPrice(price);
            machineItem.setIconName("fa-tractor");
            machineItem.setIsFeatured(true);
            items.add(machineItem);
        }
        log.info("Added {} machinery items from machinery_definitions", machines.size());

        // ===================== THUOC TRU SAU - Tu pest_definitions (thuoc tri) =====================
        log.info("Loading pesticides from pest_definitions...");
        List<PestDefinition> pests = pestDefinitionRepository.findAll();
        for (PestDefinition pest : pests) {
            ShopItem pestItem = new ShopItem();
            pestItem.setName("Thuoc tri " + pest.getName());
            pestItem.setCategory("THUOC_TRU_SAU");
            pestItem.setSubCategory(pest.getSeverity());
            pestItem.setDescription(pest.getTreatment() != null ? pest.getTreatment() :
                "Thuoc dac tri " + pest.getName());
            pestItem.setUnit("lit");
            // Gia theo muc do nghiem trong
            String severity = pest.getSeverity() != null ? pest.getSeverity() : "MEDIUM";
            BigDecimal price;
            switch (severity) {
                case "CRITICAL" -> price = new BigDecimal("350000");
                case "HIGH" -> price = new BigDecimal("250000");
                case "MEDIUM" -> price = new BigDecimal("150000");
                default -> price = new BigDecimal("85000");
            }
            pestItem.setPrice(price);
            pestItem.setIconName("fa-bug-slash");
            pestItem.setImageUrl(pest.getImageUrl());
            pestItem.setIsFeatured("HIGH".equals(pest.getSeverity()) || "CRITICAL".equals(pest.getSeverity()));
            items.add(pestItem);
        }
        log.info("Added {} pesticide items from pest_definitions", pests.size());

        // Save all items
        if (!items.isEmpty()) {
            shopItemRepository.saveAll(items);
            log.info("=== ShopDataInitializer Complete: Created {} shop items from definition tables ===", items.size());
        } else {
            log.warn("No items found in definition tables to create shop items");
        }
    }
}
