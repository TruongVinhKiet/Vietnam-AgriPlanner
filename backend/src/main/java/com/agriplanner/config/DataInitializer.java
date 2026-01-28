package com.agriplanner.config;

import com.agriplanner.model.*;
import com.agriplanner.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.util.List;

/**
 * Data initializer that creates default data on startup
 * When ddl-auto=create, this seeds ALL required data
 */
@Component
@RequiredArgsConstructor
@Slf4j
@SuppressWarnings({ "null", "unused" })
public class DataInitializer implements CommandLineRunner {

        private final UserRepository userRepository;
        private final PasswordEncoder passwordEncoder;
        private final FertilizerDefinitionRepository fertilizerRepository;
        private final MachineryDefinitionRepository machineryRepository;
        private final CropDefinitionRepository cropRepository;
        private final PestDefinitionRepository pestRepository;
        private final AnimalDefinitionRepository animalRepository;
        private final VaccinationScheduleRepository vaccinationScheduleRepository;
        private final InventoryRepository inventoryRepository;
        private final FarmRepository farmRepository;
        private final JdbcTemplate jdbcTemplate;

        private static final String ADMIN_EMAIL = "superadmin@gmail.com";
        private static final String ADMIN_PASSWORD = "123456";

        @Override
        public void run(String... args) {
                log.info("=== DataInitializer Starting ===");
                fixDatabaseSchema();
                createDefaultAdminIfNotExists();
                createCropsIfNotExists();
                createTestCropIfNotExists();
                patchMissingCropTimings();
                forceUpdateTestCrop();
                createFertilizersIfNotExists();
                createMachineryIfNotExists();
                createPestsIfNotExists();
                createAnimalsIfNotExists();
                createAnimalsIfNotExists();
                createVaccinationSchedules();
                // createInventoryItems(); // Temporary disable to fix crash
                log.info("=== DataInitializer Complete ===");
        }

        private void createVaccinationSchedules() {
                if (vaccinationScheduleRepository.count() > 0) {
                        log.info("Vaccination schedules already exist, skipping...");
                        return;
                }

                List<AnimalDefinition> animals = animalRepository.findAll();
                for (AnimalDefinition animal : animals) {
                        String name = animal.getName().toLowerCase();
                        if (name.contains("heo") || name.contains("lợn")) {
                                saveVaccine(animal.getId(), "Tiêm sắt (Lần 1)", 3, true, "Phòng thiếu máu");
                                saveVaccine(animal.getId(), "Tiêm sắt (Lần 2)", 10, true, "Phòng thiếu máu");
                                saveVaccine(animal.getId(), "Phó thương hàn", 21, true, "Phòng tiêu chảy/thương hàn");
                                saveVaccine(animal.getId(), "Dịch tả (Lần 1)", 35, true, "Bệnh dịch tả cổ điển");
                                saveVaccine(animal.getId(), "Lở mồm long móng (FMD)", 45, true, "Phòng bệnh LMLM");
                                saveVaccine(animal.getId(), "Dịch tả (Lần 2)", 65, true, "Nhắc lại dịch tả");
                        } else if (name.contains("gà") || name.contains("vịt") || name.contains("ngan")) {
                                saveVaccine(animal.getId(), "Marek", 1, true, "Phòng bệnh Marek (tiêm dưới da cổ)");
                                saveVaccine(animal.getId(), "Newcastle (Lần 1)", 5, true, "Nhỏ mắt/mũi");
                                saveVaccine(animal.getId(), "Gumboro (Lần 1)", 7, true, "Nhỏ miệng");
                                saveVaccine(animal.getId(), "Cúm gia cầm", 14, true, "Tiêm dưới da");
                                saveVaccine(animal.getId(), "Newcastle (Lần 2)", 21, true, "Nhắc lại");
                        } else if (name.contains("bò") || name.contains("trâu")) {
                                saveVaccine(animal.getId(), "Tụ huyết trùng", 150, true, "Định kỳ 6 tháng/lần");
                                saveVaccine(animal.getId(), "Lở mồm long móng", 180, true, "Định kỳ 6 tháng/lần");
                                saveVaccine(animal.getId(), "Viêm da nổi cục", 90, true, "Mỗi năm 1 lần");
                        } else if (name.contains("cá") || name.contains("tôm")) {
                                // Thủy sản ít vắc xin, chủ yếu xử lý môi trường
                                saveVaccine(animal.getId(), "Xử lý môi trường định kỳ", 15, false, "Đánh vôi/Zeolite");
                                saveVaccine(animal.getId(), "Bổ sung Vitamin C", 30, false, "Tăng sức đề kháng");
                        }
                }
                log.info("Seeded vaccination schedules");
        }

        private void saveVaccine(Long animalId, String name, int days, boolean mandatory, String desc) {
                vaccinationScheduleRepository.save(VaccinationSchedule.builder()
                                .animalDefinitionId(animalId)
                                .name(name)
                                .ageDays(days)
                                .isMandatory(mandatory)
                                .description(desc)
                                .build());
        }

        private void createInventoryItems() {
                if (inventoryRepository.count() > 0)
                        return;

                Farm farm = farmRepository.findAll().stream().findFirst().orElse(null);
                if (farm == null) {
                        // Create default farm if missing
                        User admin = userRepository.findByEmail(ADMIN_EMAIL).orElse(null);
                        if (admin != null) {
                                farm = farmRepository.save(Farm.builder()
                                                .ownerId(admin.getId())
                                                .name("Nông trại AgriPlanner")
                                                .address("Vietnam")
                                                .build());
                        } else {
                                log.warn("Cannot seed inventory: Admin user not found");
                                return;
                        }
                }

                saveInventoryItem(farm, "Cám Heo Con", "FEED", 1000, "kg", 15000);
                saveInventoryItem(farm, "Cám Heo Thịt", "FEED", 2000, "kg", 12000);
                saveInventoryItem(farm, "Cám Gà", "FEED", 500, "kg", 14000);
                saveInventoryItem(farm, "Thức ăn Thủy sản (Viên nổi)", "FEED", 1000, "kg", 18000);
                saveInventoryItem(farm, "Vắc-xin Dịch tả", "MEDICINE", 50, "liều", 25000);
        }

        private void saveInventoryItem(Farm farm, String name, String type, double qty, String unit, double cost) {
                inventoryRepository.save(InventoryItem.builder()
                                .farmId(farm.getId())
                                .name(name)
                                .type(type)
                                .quantity(new BigDecimal(qty))
                                .unit(unit)
                                .costPerUnit(new BigDecimal(cost))
                                .minThreshold(new BigDecimal(10))
                                .build()); // Removed farm association from InventoryItem model based on Step 538 view?
        }

        private void fixDatabaseSchema() {
                try {
                        log.info("Attempting to fix database schema...");
                        jdbcTemplate.execute("ALTER TABLE users ALTER COLUMN avatar_url TYPE TEXT");
                        log.info("Successfully altered avatar_url to TEXT");
                } catch (Exception e) {
                        log.warn("Schema fix skipped (probably already applied): {}", e.getMessage());
                }
        }

        private void createDefaultAdminIfNotExists() {
                if (!userRepository.existsByEmail(ADMIN_EMAIL)) {
                        User admin = User.builder()
                                        .fullName("Super Administrator")
                                        .email(ADMIN_EMAIL)
                                        .passwordHash(passwordEncoder.encode(ADMIN_PASSWORD))
                                        .role(UserRole.SYSTEM_ADMIN)
                                        .isActive(true)
                                        .build();

                        userRepository.save(admin);
                        log.info("Created SYSTEM_ADMIN account: {}", ADMIN_EMAIL);
                } else {
                        log.info("SYSTEM_ADMIN account already exists: {}", ADMIN_EMAIL);
                }
        }

        // =============================================
        // CROPS - 29 Vietnamese crops
        // =============================================
        private void createCropsIfNotExists() {
                if (cropRepository.count() > 0) {
                        log.info("Crops already exist ({}), skipping seed to preserve data...", cropRepository.count());
                        return;
                }

                // GRAINS
                cropRepository.save(CropDefinition.builder()
                                .name("Lúa nước")
                                .imageUrl("https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=400")
                                .category("GRAIN")
                                .idealTempRange("{\"min\": 20, \"max\": 35}")
                                .idealHumidityRange("{\"min\": 70, \"max\": 90}")
                                .growthDurationDays(120)
                                .seedsPerSqm(new BigDecimal("0.15"))
                                .seedCostPerKg(new BigDecimal("25000"))
                                .careCostPerSqm(new BigDecimal("3000"))
                                .expectedYieldPerSqm(new BigDecimal("0.6"))
                                .marketPricePerKg(new BigDecimal("8000"))
                                .minTemp(18).maxTemp(38)
                                .avoidWeather("[\"snow\", \"frost\", \"hail\"]")
                                .idealSeasons("[\"spring\", \"summer\"]")
                                .commonPests("[{\"name\": \"Rầy nâu\", \"treatment\": \"Phun thuốc Bassa 50EC\"}, {\"name\": \"Sâu đục thân\", \"treatment\": \"Phun thuốc Regent\"}]")
                                .waterNeeds("HIGH")
                                .soilTypePreferred("Đất phù sa, đất sét")
                                .description("Cây lương thực chính của Việt Nam, trồng chủ yếu ở đồng bằng sông Cửu Long và sông Hồng.")
                                .fertilizerIntervalDays(30)
                                .germinationDays(5)
                                .wateringIntervalDays(1)
                                .pesticideIntervalDays(14)
                                .build());

                cropRepository.save(CropDefinition.builder()
                                .name("Ngô (Bắp)")
                                .imageUrl("https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=400")
                                .category("GRAIN")
                                .idealTempRange("{\"min\": 20, \"max\": 32}")
                                .idealHumidityRange("{\"min\": 60, \"max\": 80}")
                                .growthDurationDays(100)
                                .seedsPerSqm(new BigDecimal("0.08"))
                                .seedCostPerKg(new BigDecimal("45000"))
                                .careCostPerSqm(new BigDecimal("2800"))
                                .expectedYieldPerSqm(new BigDecimal("0.8"))
                                .marketPricePerKg(new BigDecimal("6500"))
                                .minTemp(15).maxTemp(35)
                                .avoidWeather("[\"frost\", \"waterlogging\", \"drought\"]")
                                .idealSeasons("[\"spring\", \"summer\", \"fall\"]")
                                .commonPests("[{\"name\": \"Sâu đục thân ngô\", \"treatment\": \"Phun thuốc Dupont Prevathon\"}, {\"name\": \"Bệnh khô vằn\", \"treatment\": \"Phun Validacin\"}]")
                                .waterNeeds("MEDIUM")
                                .soilTypePreferred("Đất phù sa, đất đỏ bazan")
                                .description("Cây trồng đa năng, dùng làm thức ăn chăn nuôi và lương thực.")
                                .fertilizerIntervalDays(25)
                                .germinationDays(7)
                                .wateringIntervalDays(3)
                                .pesticideIntervalDays(21)
                                .build());

                // FRUITS
                cropRepository.save(CropDefinition.builder()
                                .name("Thanh long")
                                .imageUrl("https://images.unsplash.com/photo-1527325678964-54921661f888?w=400")
                                .category("FRUIT")
                                .idealTempRange("{\"min\": 20, \"max\": 35}")
                                .idealHumidityRange("{\"min\": 60, \"max\": 80}")
                                .growthDurationDays(365)
                                .seedsPerSqm(new BigDecimal("0.04"))
                                .seedCostPerKg(new BigDecimal("150000"))
                                .careCostPerSqm(new BigDecimal("8000"))
                                .expectedYieldPerSqm(new BigDecimal("2.5"))
                                .marketPricePerKg(new BigDecimal("25000"))
                                .minTemp(15).maxTemp(40)
                                .avoidWeather("[\"frost\", \"prolonged rain\", \"flooding\"]")
                                .idealSeasons("[\"spring\", \"summer\", \"fall\"]")
                                .commonPests("[{\"name\": \"Bệnh thối đầu cành\", \"treatment\": \"Phun Ridomil Gold\"}, {\"name\": \"Kiến đỏ\", \"treatment\": \"Phun Regent\"}]")
                                .waterNeeds("LOW")
                                .soilTypePreferred("Đất pha cát, thoát nước tốt")
                                .description("Cây ăn quả đặc sản Việt Nam, xuất khẩu nhiều sang Trung Quốc và châu Âu.")
                                .fertilizerIntervalDays(45)
                                .germinationDays(30)
                                .wateringIntervalDays(7)
                                .pesticideIntervalDays(30)
                                .build());

                cropRepository.save(CropDefinition.builder()
                                .name("Xoài")
                                .imageUrl("https://images.unsplash.com/photo-1553279768-865429fa0078?w=400")
                                .category("FRUIT")
                                .idealTempRange("{\"min\": 24, \"max\": 35}")
                                .idealHumidityRange("{\"min\": 50, \"max\": 60}")
                                .growthDurationDays(1095)
                                .seedsPerSqm(new BigDecimal("0.01"))
                                .seedCostPerKg(new BigDecimal("200000"))
                                .careCostPerSqm(new BigDecimal("5000"))
                                .expectedYieldPerSqm(new BigDecimal("3.0"))
                                .marketPricePerKg(new BigDecimal("30000"))
                                .minTemp(20).maxTemp(40)
                                .avoidWeather("[\"frost\", \"heavy rain during flowering\", \"strong wind\"]")
                                .idealSeasons("[\"summer\"]")
                                .commonPests("[{\"name\": \"Ruồi đục quả\", \"treatment\": \"Bẫy Methyl Eugenol\"}, {\"name\": \"Bệnh thán thư\", \"treatment\": \"Phun Score 250EC\"}]")
                                .waterNeeds("MEDIUM")
                                .soilTypePreferred("Đất thịt, giàu dinh dưỡng")
                                .description("Trái cây nhiệt đới phổ biến, có nhiều giống như cát Hòa Lộc, xoài Đài Loan.")
                                .fertilizerIntervalDays(60)
                                .germinationDays(0)
                                .wateringIntervalDays(7)
                                .pesticideIntervalDays(45)
                                .build());

                cropRepository.save(CropDefinition.builder()
                                .name("Bưởi")
                                .imageUrl("https://images.unsplash.com/photo-1577234286642-fc512a5f8f11?w=400")
                                .category("FRUIT")
                                .idealTempRange("{\"min\": 23, \"max\": 32}")
                                .idealHumidityRange("{\"min\": 70, \"max\": 85}")
                                .growthDurationDays(1460)
                                .seedsPerSqm(new BigDecimal("0.004"))
                                .seedCostPerKg(new BigDecimal("300000"))
                                .careCostPerSqm(new BigDecimal("6000"))
                                .expectedYieldPerSqm(new BigDecimal("4.0"))
                                .marketPricePerKg(new BigDecimal("35000"))
                                .minTemp(18).maxTemp(38)
                                .avoidWeather("[\"frost\", \"hail\", \"strong wind\"]")
                                .idealSeasons("[\"spring\", \"summer\"]")
                                .commonPests("[{\"name\": \"Sâu vẽ bùa\", \"treatment\": \"Phun Regent 800WG\"}, {\"name\": \"Nhện đỏ\", \"treatment\": \"Phun Comite\"}]")
                                .waterNeeds("HIGH")
                                .soilTypePreferred("Đất phù sa ven sông")
                                .description("Bưởi Năm Roi, bưởi da xanh là đặc sản miền Tây Nam Bộ.")
                                .fertilizerIntervalDays(60)
                                .germinationDays(0)
                                .wateringIntervalDays(5)
                                .pesticideIntervalDays(45)
                                .build());

                cropRepository.save(CropDefinition.builder()
                                .name("Sầu riêng")
                                .imageUrl("https://images.unsplash.com/photo-1558818498-28c1e002674f?w=400")
                                .category("FRUIT")
                                .idealTempRange("{\"min\": 24, \"max\": 32}")
                                .idealHumidityRange("{\"min\": 75, \"max\": 85}")
                                .growthDurationDays(1825)
                                .seedsPerSqm(new BigDecimal("0.002"))
                                .seedCostPerKg(new BigDecimal("500000"))
                                .careCostPerSqm(new BigDecimal("15000"))
                                .expectedYieldPerSqm(new BigDecimal("2.0"))
                                .marketPricePerKg(new BigDecimal("80000"))
                                .minTemp(20).maxTemp(35)
                                .avoidWeather("[\"frost\", \"drought\", \"strong wind\"]")
                                .idealSeasons("[\"summer\"]")
                                .commonPests("[{\"name\": \"Bệnh thối rễ Phytophthora\", \"treatment\": \"Phun Aliette 80WP\"}, {\"name\": \"Rệp sáp\", \"treatment\": \"Phun Supracide\"}]")
                                .waterNeeds("HIGH")
                                .soilTypePreferred("Đất đỏ bazan, thoát nước tốt")
                                .description("Vua trái cây nhiệt đới, giá trị kinh tế cao, xuất khẩu nhiều.")
                                .fertilizerIntervalDays(60)
                                .germinationDays(0)
                                .wateringIntervalDays(3)
                                .pesticideIntervalDays(30)
                                .build());

                cropRepository.save(CropDefinition.builder()
                                .name("Dưa hấu")
                                .imageUrl("https://images.unsplash.com/photo-1589984662646-e7b2e4962f18?w=400")
                                .category("FRUIT")
                                .idealTempRange("{\"min\": 22, \"max\": 35}")
                                .idealHumidityRange("{\"min\": 50, \"max\": 70}")
                                .growthDurationDays(75)
                                .seedsPerSqm(new BigDecimal("0.04"))
                                .seedCostPerKg(new BigDecimal("80000"))
                                .careCostPerSqm(new BigDecimal("4500"))
                                .expectedYieldPerSqm(new BigDecimal("4.0"))
                                .marketPricePerKg(new BigDecimal("8000"))
                                .minTemp(18).maxTemp(38)
                                .avoidWeather("[\"frost\", \"heavy rain\", \"waterlogging\"]")
                                .idealSeasons("[\"spring\", \"summer\"]")
                                .commonPests("[{\"name\": \"Bệnh đốm lá\", \"treatment\": \"Phun Daconil\"}, {\"name\": \"Bọ trĩ\", \"treatment\": \"Phun Confidor\"}]")
                                .waterNeeds("MEDIUM")
                                .soilTypePreferred("Đất cát pha")
                                .description("Trái cây giải nhiệt mùa hè, trồng nhiều ở miền Trung và miền Nam.")
                                .build());

                // VEGETABLES
                cropRepository.save(CropDefinition.builder()
                                .name("Cà chua")
                                .imageUrl("https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=400")
                                .category("VEGETABLE")
                                .idealTempRange("{\"min\": 18, \"max\": 28}")
                                .idealHumidityRange("{\"min\": 50, \"max\": 70}")
                                .growthDurationDays(90)
                                .seedsPerSqm(new BigDecimal("0.04"))
                                .seedCostPerKg(new BigDecimal("500000"))
                                .careCostPerSqm(new BigDecimal("5000"))
                                .expectedYieldPerSqm(new BigDecimal("4.0"))
                                .marketPricePerKg(new BigDecimal("15000"))
                                .minTemp(15).maxTemp(32)
                                .avoidWeather("[\"frost\", \"heavy rain\", \"high humidity\"]")
                                .idealSeasons("[\"spring\", \"fall\", \"winter\"]")
                                .commonPests("[{\"name\": \"Sâu xanh\", \"treatment\": \"Phun Bt\"}, {\"name\": \"Bệnh mốc sương\", \"treatment\": \"Phun Ridomil Gold\"}]")
                                .waterNeeds("HIGH")
                                .soilTypePreferred("Đất thịt nhẹ, giàu mùn")
                                .description("Rau ăn quả phổ biến, nhiều vitamin C và lycopene.")
                                .build());

                cropRepository.save(CropDefinition.builder()
                                .name("Ớt")
                                .imageUrl("https://images.unsplash.com/photo-1518288774672-b94e808873ff?w=400")
                                .category("VEGETABLE")
                                .idealTempRange("{\"min\": 20, \"max\": 32}")
                                .idealHumidityRange("{\"min\": 50, \"max\": 70}")
                                .growthDurationDays(120)
                                .seedsPerSqm(new BigDecimal("0.05"))
                                .seedCostPerKg(new BigDecimal("600000"))
                                .careCostPerSqm(new BigDecimal("4000"))
                                .expectedYieldPerSqm(new BigDecimal("1.5"))
                                .marketPricePerKg(new BigDecimal("25000"))
                                .minTemp(18).maxTemp(35)
                                .avoidWeather("[\"frost\", \"waterlogging\"]")
                                .idealSeasons("[\"spring\", \"summer\", \"fall\"]")
                                .commonPests("[{\"name\": \"Bệnh thán thư\", \"treatment\": \"Phun Score 250EC\"}, {\"name\": \"Rệp muội\", \"treatment\": \"Phun Confidor\"}]")
                                .waterNeeds("MEDIUM")
                                .soilTypePreferred("Đất thịt pha cát")
                                .description("Gia vị quan trọng trong ẩm thực Việt Nam, nhiều loại từ ớt hiểm đến ớt chỉ thiên.")
                                .build());

                cropRepository.save(CropDefinition.builder()
                                .name("Cà rốt")
                                .imageUrl("https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400")
                                .category("VEGETABLE")
                                .idealTempRange("{\"min\": 15, \"max\": 25}")
                                .idealHumidityRange("{\"min\": 60, \"max\": 80}")
                                .growthDurationDays(90)
                                .seedsPerSqm(new BigDecimal("0.5"))
                                .seedCostPerKg(new BigDecimal("300000"))
                                .careCostPerSqm(new BigDecimal("3000"))
                                .expectedYieldPerSqm(new BigDecimal("3.0"))
                                .marketPricePerKg(new BigDecimal("12000"))
                                .minTemp(10).maxTemp(28)
                                .avoidWeather("[\"extreme heat\", \"waterlogging\"]")
                                .idealSeasons("[\"fall\", \"winter\", \"spring\"]")
                                .commonPests("[{\"name\": \"Sâu xám\", \"treatment\": \"Phun thuốc Regent\"}, {\"name\": \"Bệnh lở cổ rễ\", \"treatment\": \"Xử lý đất bằng vôi\"}]")
                                .waterNeeds("MEDIUM")
                                .soilTypePreferred("Đất cát pha, tơi xốp")
                                .description("Rau củ giàu vitamin A, trồng nhiều ở Đà Lạt.")
                                .build());

                cropRepository.save(CropDefinition.builder()
                                .name("Bắp cải")
                                .imageUrl("https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=400")
                                .category("VEGETABLE")
                                .idealTempRange("{\"min\": 15, \"max\": 22}")
                                .idealHumidityRange("{\"min\": 60, \"max\": 80}")
                                .growthDurationDays(75)
                                .seedsPerSqm(new BigDecimal("0.04"))
                                .seedCostPerKg(new BigDecimal("400000"))
                                .careCostPerSqm(new BigDecimal("3500"))
                                .expectedYieldPerSqm(new BigDecimal("4.0"))
                                .marketPricePerKg(new BigDecimal("8000"))
                                .minTemp(8).maxTemp(25)
                                .avoidWeather("[\"extreme heat\", \"drought\"]")
                                .idealSeasons("[\"fall\", \"winter\", \"spring\"]")
                                .commonPests("[{\"name\": \"Sâu tơ\", \"treatment\": \"Phun Bt\"}, {\"name\": \"Bệnh thối nhũn\", \"treatment\": \"Thoát nước tốt\"}]")
                                .waterNeeds("HIGH")
                                .soilTypePreferred("Đất thịt, giàu dinh dưỡng")
                                .description("Rau ôn đới, trồng nhiều ở Đà Lạt và vùng cao.")
                                .build());

                cropRepository.save(CropDefinition.builder()
                                .name("Rau muống")
                                .imageUrl("https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400")
                                .category("VEGETABLE")
                                .idealTempRange("{\"min\": 25, \"max\": 35}")
                                .idealHumidityRange("{\"min\": 70, \"max\": 90}")
                                .growthDurationDays(25)
                                .seedsPerSqm(new BigDecimal("0.2"))
                                .seedCostPerKg(new BigDecimal("50000"))
                                .careCostPerSqm(new BigDecimal("1500"))
                                .expectedYieldPerSqm(new BigDecimal("3.0"))
                                .marketPricePerKg(new BigDecimal("10000"))
                                .minTemp(20).maxTemp(40)
                                .avoidWeather("[\"frost\", \"drought\"]")
                                .idealSeasons("[\"spring\", \"summer\", \"fall\"]")
                                .commonPests("[{\"name\": \"Sâu khoang\", \"treatment\": \"Phun Regent\"}, {\"name\": \"Bọ nhảy\", \"treatment\": \"Phun Confidor\"}]")
                                .waterNeeds("HIGH")
                                .soilTypePreferred("Đất phù sa ngập nước")
                                .description("Rau phổ biến nhất Việt Nam, dễ trồng, năng suất cao.")
                                .build());

                cropRepository.save(CropDefinition.builder()
                                .name("Cải xanh")
                                .imageUrl("https://images.unsplash.com/photo-1612257416648-ee7a6c533544?w=400")
                                .category("VEGETABLE")
                                .idealTempRange("{\"min\": 15, \"max\": 25}")
                                .idealHumidityRange("{\"min\": 60, \"max\": 80}")
                                .growthDurationDays(35)
                                .seedsPerSqm(new BigDecimal("0.3"))
                                .seedCostPerKg(new BigDecimal("80000"))
                                .careCostPerSqm(new BigDecimal("2000"))
                                .expectedYieldPerSqm(new BigDecimal("2.5"))
                                .marketPricePerKg(new BigDecimal("12000"))
                                .minTemp(12).maxTemp(28)
                                .avoidWeather("[\"extreme heat\", \"drought\"]")
                                .idealSeasons("[\"fall\", \"winter\", \"spring\"]")
                                .commonPests("[{\"name\": \"Sâu xanh bướm trắng\", \"treatment\": \"Phun Bt\"}, {\"name\": \"Bọ nhảy\", \"treatment\": \"Phun Confidor\"}]")
                                .waterNeeds("HIGH")
                                .soilTypePreferred("Đất thịt, giàu mùn")
                                .description("Rau ăn lá phổ biến, thời gian thu hoạch ngắn.")
                                .build());

                // LEGUMES
                cropRepository.save(CropDefinition.builder()
                                .name("Đậu nành")
                                .imageUrl("https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400")
                                .category("LEGUME")
                                .idealTempRange("{\"min\": 20, \"max\": 30}")
                                .idealHumidityRange("{\"min\": 60, \"max\": 80}")
                                .growthDurationDays(100)
                                .seedsPerSqm(new BigDecimal("0.4"))
                                .seedCostPerKg(new BigDecimal("25000"))
                                .careCostPerSqm(new BigDecimal("2000"))
                                .expectedYieldPerSqm(new BigDecimal("0.25"))
                                .marketPricePerKg(new BigDecimal("18000"))
                                .minTemp(15).maxTemp(35)
                                .avoidWeather("[\"frost\", \"waterlogging\", \"drought during flowering\"]")
                                .idealSeasons("[\"spring\", \"summer\"]")
                                .commonPests("[{\"name\": \"Sâu đục quả\", \"treatment\": \"Phun Bt\"}, {\"name\": \"Bệnh gỉ sắt\", \"treatment\": \"Phun Score\"}]")
                                .waterNeeds("MEDIUM")
                                .soilTypePreferred("Đất thịt nhẹ")
                                .description("Nguồn protein thực vật quan trọng, dùng làm đậu phụ, sữa đậu.")
                                .build());

                cropRepository.save(CropDefinition.builder()
                                .name("Đậu xanh")
                                .imageUrl("https://images.unsplash.com/photo-1563288285-18787e0cc9f9?w=400")
                                .category("LEGUME")
                                .idealTempRange("{\"min\": 22, \"max\": 32}")
                                .idealHumidityRange("{\"min\": 50, \"max\": 70}")
                                .growthDurationDays(65)
                                .seedsPerSqm(new BigDecimal("0.25"))
                                .seedCostPerKg(new BigDecimal("40000"))
                                .careCostPerSqm(new BigDecimal("1800"))
                                .expectedYieldPerSqm(new BigDecimal("0.2"))
                                .marketPricePerKg(new BigDecimal("30000"))
                                .minTemp(18).maxTemp(38)
                                .avoidWeather("[\"frost\", \"waterlogging\"]")
                                .idealSeasons("[\"spring\", \"summer\", \"fall\"]")
                                .commonPests("[{\"name\": \"Sâu đục quả\", \"treatment\": \"Phun Prevathon\"}, {\"name\": \"Bệnh lở cổ rễ\", \"treatment\": \"Xử lý hạt giống\"}]")
                                .waterNeeds("LOW")
                                .soilTypePreferred("Đất cát pha")
                                .description("Đậu ngắn ngày, dùng nấu chè, làm giá đỗ.")
                                .build());

                cropRepository.save(CropDefinition.builder()
                                .name("Đậu phộng (Lạc)")
                                .imageUrl("https://images.unsplash.com/photo-1567892737950-30c4db37cd89?w=400")
                                .category("LEGUME")
                                .idealTempRange("{\"min\": 20, \"max\": 35}")
                                .idealHumidityRange("{\"min\": 50, \"max\": 70}")
                                .growthDurationDays(120)
                                .seedsPerSqm(new BigDecimal("0.2"))
                                .seedCostPerKg(new BigDecimal("35000"))
                                .careCostPerSqm(new BigDecimal("2500"))
                                .expectedYieldPerSqm(new BigDecimal("0.3"))
                                .marketPricePerKg(new BigDecimal("25000"))
                                .minTemp(15).maxTemp(38)
                                .avoidWeather("[\"frost\", \"waterlogging\", \"heavy rain at harvest\"]")
                                .idealSeasons("[\"spring\", \"summer\"]")
                                .commonPests("[{\"name\": \"Sâu khoang\", \"treatment\": \"Phun Regent\"}, {\"name\": \"Bệnh đốm lá\", \"treatment\": \"Phun Daconil\"}]")
                                .waterNeeds("LOW")
                                .soilTypePreferred("Đất cát pha")
                                .description("Cây công nghiệp ngắn ngày, nhiều dầu và protein.")
                                .build());

                // INDUSTRIAL CROPS
                cropRepository.save(CropDefinition.builder()
                                .name("Cà phê")
                                .imageUrl("https://images.unsplash.com/photo-1611564494260-6f21b80af7ea?w=400")
                                .category("INDUSTRIAL")
                                .idealTempRange("{\"min\": 18, \"max\": 28}")
                                .idealHumidityRange("{\"min\": 70, \"max\": 90}")
                                .growthDurationDays(1095)
                                .seedsPerSqm(new BigDecimal("0.01"))
                                .seedCostPerKg(new BigDecimal("400000"))
                                .careCostPerSqm(new BigDecimal("12000"))
                                .expectedYieldPerSqm(new BigDecimal("0.3"))
                                .marketPricePerKg(new BigDecimal("45000"))
                                .minTemp(15).maxTemp(32)
                                .avoidWeather("[\"frost\", \"drought\", \"extreme heat\"]")
                                .idealSeasons("[\"spring\"]")
                                .commonPests("[{\"name\": \"Mọt đục cành\", \"treatment\": \"Cắt bỏ cành bị hại\"}, {\"name\": \"Bệnh gỉ sắt lá\", \"treatment\": \"Phun thuốc gốc đồng\"}]")
                                .waterNeeds("MEDIUM")
                                .soilTypePreferred("Đất đỏ bazan")
                                .description("Cây công nghiệp chủ lực Tây Nguyên, xuất khẩu thế giới.")
                                .build());

                cropRepository.save(CropDefinition.builder()
                                .name("Hồ tiêu")
                                .imageUrl("https://images.unsplash.com/photo-1599999904407-bbea7c9d8c49?w=400")
                                .category("INDUSTRIAL")
                                .idealTempRange("{\"min\": 22, \"max\": 30}")
                                .idealHumidityRange("{\"min\": 70, \"max\": 90}")
                                .growthDurationDays(1095)
                                .seedsPerSqm(new BigDecimal("0.02"))
                                .seedCostPerKg(new BigDecimal("350000"))
                                .careCostPerSqm(new BigDecimal("10000"))
                                .expectedYieldPerSqm(new BigDecimal("0.25"))
                                .marketPricePerKg(new BigDecimal("80000"))
                                .minTemp(18).maxTemp(35)
                                .avoidWeather("[\"frost\", \"waterlogging\", \"drought\"]")
                                .idealSeasons("[\"spring\"]")
                                .commonPests("[{\"name\": \"Bệnh chết nhanh\", \"treatment\": \"Phun Aliette\"}, {\"name\": \"Rệp sáp\", \"treatment\": \"Phun Supracide\"}]")
                                .waterNeeds("MEDIUM")
                                .soilTypePreferred("Đất đỏ bazan")
                                .description("Gia vị xuất khẩu quan trọng của Việt Nam.")
                                .build());

                cropRepository.save(CropDefinition.builder()
                                .name("Mía")
                                .imageUrl("https://images.unsplash.com/photo-1592903297149-37fb25202dfa?w=400")
                                .category("INDUSTRIAL")
                                .idealTempRange("{\"min\": 20, \"max\": 35}")
                                .idealHumidityRange("{\"min\": 60, \"max\": 80}")
                                .growthDurationDays(365)
                                .seedsPerSqm(new BigDecimal("0.05"))
                                .seedCostPerKg(new BigDecimal("15000"))
                                .careCostPerSqm(new BigDecimal("5000"))
                                .expectedYieldPerSqm(new BigDecimal("6.0"))
                                .marketPricePerKg(new BigDecimal("1200"))
                                .minTemp(18).maxTemp(40)
                                .avoidWeather("[\"frost\", \"waterlogging\", \"drought\"]")
                                .idealSeasons("[\"spring\"]")
                                .commonPests("[{\"name\": \"Sâu đục thân\", \"treatment\": \"Thả ong ký sinh\"}, {\"name\": \"Rệp xơ trắng\", \"treatment\": \"Phun Confidor\"}]")
                                .waterNeeds("HIGH")
                                .soilTypePreferred("Đất phù sa")
                                .description("Nguyên liệu sản xuất đường, trồng nhiều ở miền Trung.")
                                .fertilizerIntervalDays(45)
                                .germinationDays(14)
                                .wateringIntervalDays(2)
                                .pesticideIntervalDays(21)
                                .build());

                // Test crop with 0-day growth - realistic values for profit
                cropRepository.save(CropDefinition.builder()
                                .name("Rau mầm (Test)")
                                .imageUrl("https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400")
                                .category("VEGETABLE")
                                .idealTempRange("{\"min\": 18, \"max\": 28}")
                                .idealHumidityRange("{\"min\": 70, \"max\": 85}")
                                .growthDurationDays(0)
                                .seedsPerSqm(new BigDecimal("0.5")) // Reduced from 50
                                .seedCostPerKg(new BigDecimal("30000")) // Reduced from 50000
                                .careCostPerSqm(new BigDecimal("500")) // Reduced from 2000
                                .expectedYieldPerSqm(new BigDecimal("2.0")) // Increased from 0.5
                                .marketPricePerKg(new BigDecimal("100000")) // Increased from 80000
                                .minTemp(18).maxTemp(30)
                                .avoidWeather("[\"extreme heat\"]")
                                .idealSeasons("[\"all year\"]")
                                .commonPests("[]")
                                .waterNeeds("MEDIUM")
                                .soilTypePreferred("Đất thịt nhẹ")
                                .description("Rau mầm dùng để test thu hoạch nhanh - 0 ngày. 即刻收割测试用.")
                                .fertilizerIntervalDays(0)
                                .germinationDays(0)
                                .wateringIntervalDays(0)
                                .pesticideIntervalDays(0)
                                .build());

                log.info("Created {} crop definitions", cropRepository.count());
        }

        // =============================================
        // FERTILIZERS - 5 types with detailed info
        // =============================================
        private void createFertilizersIfNotExists() {
                if (fertilizerRepository.count() > 0) {
                        log.info("Fertilizers already exist ({}), skipping seed...", fertilizerRepository.count());
                        return;
                }

                fertilizerRepository.save(FertilizerDefinition.builder()
                                .name("Phân NPK 16-16-8 (Việt-Nhật)")
                                .type("inorganic")
                                .suitableCrops("[\"Lúa nước\",\"Ngô\",\"Rau cải\",\"Cà chua\",\"Dưa hấu\"]")
                                .applicationRate(new BigDecimal("0.05"))
                                .costPerKg(new BigDecimal("12000"))
                                .description("Phân bón hỗn hợp cao cấp, tan nhanh, giúp cây trồng hấp thu dinh dưỡng tối đa.")
                                .ingredients("Đạm (N): 16%, Lân (P2O5): 16%, Kali (K2O): 8%, Lưu huỳnh (S): 13%")
                                .usageInstructions(
                                                "Bón thúc 1 và 2 cho lúa, ngô. Bón lót cho các loại rau màu. Giúp cây đẻ nhánh khỏe, ra lá mạnh.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/10003/10003757.png")
                                .build());

                fertilizerRepository.save(FertilizerDefinition.builder()
                                .name("Phân Urê (Đạm Phú Mỹ)")
                                .type("inorganic")
                                .suitableCrops("[\"Lúa nước\",\"Ngô\",\"Mía\",\"Rau muống\",\"Cải xanh\"]")
                                .applicationRate(new BigDecimal("0.03"))
                                .costPerKg(new BigDecimal("11000"))
                                .description("Phân đạm hạt đục, chậm tan, giảm thất thoát đạm, giúp cây xanh bền.")
                                .ingredients("Nitrogen (N): 46% min, Biuret: 1.2% max, Độ ẩm: 0.5% max")
                                .usageInstructions(
                                                "Bón thúc đẻ nhánh cho lúa, bón thúc vươn lóng cho ngô/mía. Giúp cây ra lá nhanh, tăng sinh khối.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/10432/10432857.png")
                                .build());

                fertilizerRepository.save(FertilizerDefinition.builder()
                                .name("Phân DAP 18-46-0 (Đình Vũ)")
                                .type("inorganic")
                                .suitableCrops("[\"Lúa nước\",\"Cà phê\",\"Hồ tiêu\",\"Điều\",\"Cây ăn trái\"]")
                                .applicationRate(new BigDecimal("0.04"))
                                .costPerKg(new BigDecimal("18000"))
                                .description("Phân phức hợp DAP cung cấp Lân và Đạm cao, kích thích bộ rễ phát triển mạnh.")
                                .ingredients("Đạm (N): 18%, Lân (P2O5): 46% min")
                                .usageInstructions(
                                                "Chuyên dùng bón lót hoặc bón thúc giai đoạn đầu để kích thích ra rễ, phân hóa mầm hoa.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/2674/2674486.png")
                                .build());

                fertilizerRepository.save(FertilizerDefinition.builder()
                                .name("Phân Hữu Cơ Vi Sinh (Sông Gianh)")
                                .type("organic")
                                .suitableCrops("[\"Lúa nước\",\"Ngô\",\"Cải xanh\",\"Cà chua\",\"Dưa hấu\",\"Khoai lang\"]")
                                .applicationRate(new BigDecimal("0.1"))
                                .costPerKg(new BigDecimal("8000"))
                                .description("Phân bón hữu cơ sinh học, cải tạo đất bạc màu, bổ sung vi sinh vật có lợi.")
                                .ingredients(
                                                "Chất hữu cơ: 15%, Humic: 2%, N-P-K: 1-1-1, Vi sinh vật cố định đạm và phân giải lân")
                                .usageInstructions(
                                                "Bón lót trước khi gieo trồng. Cải tạo đất, giúp đất tơi xốp, giữ ẩm tốt.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3596/3596160.png")
                                .build());

                fertilizerRepository.save(FertilizerDefinition.builder()
                                .name("Phân Kali Clorua (Kali Đỏ)")
                                .type("inorganic")
                                .suitableCrops("[\"Cà phê\",\"Hồ tiêu\",\"Điều\",\"Thanh long\",\"Xoài\",\"Bưởi\",\"Dưa hấu\"]")
                                .applicationRate(new BigDecimal("0.02"))
                                .costPerKg(new BigDecimal("15000"))
                                .description("Phân Kali hàm lượng cao, giúp cây cứng cáp, tăng độ ngọt và màu sắc nông sản.")
                                .ingredients("Kali (K2O): 61% min")
                                .usageInstructions(
                                                "Bón thúc nuôi trái/củ/hạt. Giúp chắc hạt, ngọt trái, đẹp màu, tăng năng suất.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/10609/10609653.png")
                                .build());

                log.info("Created {} fertilizer definitions", fertilizerRepository.count());
        }

        // =============================================
        // MACHINERY - 5 types
        // =============================================
        private void createMachineryIfNotExists() {
                if (machineryRepository.count() > 0) {
                        log.info("Machinery already exists, skipping...");
                        return;
                }

                machineryRepository.save(MachineryDefinition.builder()
                                .name("Máy gặt đập liên hợp Kubota")
                                .type("harvest")
                                .suitableCrops("[\"Lúa nước\"]")
                                .efficiencyRate(new BigDecimal("0.5"))
                                .rentalCostPerHour(new BigDecimal("800000"))
                                .description("Máy gặt đập liên hợp Nhật Bản, phổ biến ở ĐBSCL")
                                .build());

                machineryRepository.save(MachineryDefinition.builder()
                                .name("Máy thu hoạch ngô")
                                .type("harvest")
                                .suitableCrops("[\"Ngô\"]")
                                .efficiencyRate(new BigDecimal("0.3"))
                                .rentalCostPerHour(new BigDecimal("600000"))
                                .description("Máy thu hoạch ngô bắp tự động")
                                .build());

                machineryRepository.save(MachineryDefinition.builder()
                                .name("Máy chặt mía")
                                .type("harvest")
                                .suitableCrops("[\"Mía\"]")
                                .efficiencyRate(new BigDecimal("0.4"))
                                .rentalCostPerHour(new BigDecimal("1000000"))
                                .description("Máy thu hoạch mía công nghiệp")
                                .build());

                machineryRepository.save(MachineryDefinition.builder()
                                .name("Máy đào khoai")
                                .type("harvest")
                                .suitableCrops("[\"Khoai lang\",\"Sắn\"]")
                                .efficiencyRate(new BigDecimal("0.2"))
                                .rentalCostPerHour(new BigDecimal("400000"))
                                .description("Máy đào củ, giảm hao hụt")
                                .build());

                machineryRepository.save(MachineryDefinition.builder()
                                .name("Thu hoạch thủ công")
                                .type("harvest")
                                .suitableCrops(
                                                "[\"Rau cải\",\"Cà chua\",\"Dưa hấu\",\"Thanh long\",\"Xoài\",\"Bưởi\",\"Rau muống\",\"Hồ tiêu\",\"Điều\",\"Rau mầm (Test)\"]")
                                .efficiencyRate(new BigDecimal("0.05"))
                                .rentalCostPerHour(new BigDecimal("200000"))
                                .description("Nhân công thu hoạch bằng tay")
                                .build());

                log.info("Created {} machinery definitions", machineryRepository.count());
        }

        // =============================================
        // PESTS - 10 common Vietnamese pests
        // =============================================
        private void createPestsIfNotExists() {
                if (pestRepository.count() > 0) {
                        log.info("Pests already exist ({}), skipping seed to preserve data...", pestRepository.count());
                        return;
                }

                pestRepository.save(PestDefinition.builder()
                                .name("Rầy nâu")
                                .scientificName("Nilaparvata lugens")
                                .description(
                                                "Gây cháy lúa (hopperburn), lây lan virus. Là loài gây hại nghiêm trọng nhất cho lúa tại Việt Nam.")
                                .treatment("Phun Chess 50WG hoặc Applaud 10WP theo liều lượng khuyến cáo. Tập trung phun vào gốc cây.")
                                .prevention("Trồng giống kháng, không trồng quá dày, làm sạch cỏ dại quanh ruộng.")
                                .severity("HIGH")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069172.png")
                                .build());

                pestRepository.save(PestDefinition.builder()
                                .name("Sâu đục thân")
                                .scientificName("Scirpophaga incertulas")
                                .description(
                                                "Sâu đục vào thân lúa, gây chết cây và bạch bông. Gây thiệt hại nặng trong mùa mưa.")
                                .treatment("Phun Virtako 40WG hoặc Regent 800WG. Diệt ấu trùng ngay khi phát hiện.")
                                .prevention("Cày ải phơi đất sau thu hoạch, diệt gốc rạ lúa. Dùng bẫy đèn bắt bướm.")
                                .severity("HIGH")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .build());

                pestRepository.save(PestDefinition.builder()
                                .name("Bọ trĩ")
                                .scientificName("Thrips palmi")
                                .description("Gây cháy lá, biến dạng lá non, giảm năng suất cây rau màu và cây ớt.")
                                .treatment("Phun Confidor 100SL hoặc Actara 25WG. Phun vào buổi sáng sớm.")
                                .prevention("Tưới đủ nước, giữ ẩm. Trồng cây che phủ đất.")
                                .severity("LOW")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069191.png")
                                .build());

                pestRepository.save(PestDefinition.builder()
                                .name("Bệnh đạo ôn")
                                .scientificName("Pyricularia oryzae")
                                .description(
                                                "Nấm gây cháy lá và cổ bông lúa, thất thu năng suất nghiêm trọng. Bệnh nguy hiểm nhất của lúa.")
                                .treatment("Phun Beam 75WP hoặc Fuan 40EC ngay khi phát hiện triệu chứng ban đầu.")
                                .prevention("Sử dụng giống kháng bệnh, bón phân cân đối. Không bón quá nhiều đạm.")
                                .severity("CRITICAL")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069195.png")
                                .build());

                pestRepository.save(PestDefinition.builder()
                                .name("Nhện đỏ")
                                .scientificName("Tetranychus urticae")
                                .description(
                                                "Gây vàng lá, khô héo, giảm quang hợp. Phổ biến trên cây cam, bưởi và rau màu.")
                                .treatment("Phun Nissorun 5EC hoặc Comite 73EC. Phun ướt đều mặt dưới lá.")
                                .prevention("Tưới đủ nước, giữ ẩm, vệ sinh vườn. Không dùng thuốc diệt nhện thiên địch.")
                                .severity("MEDIUM")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069200.png")
                                .build());

                pestRepository.save(PestDefinition.builder()
                                .name("Sâu cuốn lá")
                                .scientificName("Cnaphalocrocis medinalis")
                                .description("Sâu cuốn lá lúa thành ống, ăn lá non. Gây giảm năng suất 10-30%.")
                                .treatment("Phun Prevathon 5SC hoặc Karate 2.5EC khi mật độ sâu cao.")
                                .prevention("Thắp đèn bẫy đêm, cắt tỉa lá bị hại. Giữ ruộng thông thoáng.")
                                .severity("MEDIUM")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069205.png")
                                .build());

                pestRepository.save(PestDefinition.builder()
                                .name("Rệp xanh")
                                .scientificName("Myzus persicae")
                                .description(
                                                "Rệp xanh hút nhựa cây, gây vàng lá và lây truyền virus. Phổ biến trên rau cải, ớt.")
                                .treatment("Phun Bassa 50EC hoặc Confidor 100SL. Phun kỹ mặt dưới lá.")
                                .prevention("Vệ sinh đồng ruộng thường xuyên, loại bỏ cỏ dại. Dùng thiên địch.")
                                .severity("MEDIUM")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069210.png")
                                .build());

                pestRepository.save(PestDefinition.builder()
                                .name("Bệnh khảm lá")
                                .scientificName("Rice tungro virus")
                                .description("Virus gây vàng lùn cây, lá biến màu xanh vàng. Lây qua rầy xanh.")
                                .treatment("Không có thuốc đặc trị, diệt rầy xanh truyền bệnh. Nhổ bỏ cây bệnh.")
                                .prevention("Sử dụng giống sạch bệnh, diệt rầy xanh. Trồng giống kháng.")
                                .severity("CRITICAL")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069215.png")
                                .build());

                pestRepository.save(PestDefinition.builder()
                                .name("Ốc bươu vàng")
                                .scientificName("Pomacea canaliculata")
                                .description(
                                                "Ăn mạ non lúa, phá hoại nghiêm trọng giai đoạn mạ. Sinh sản nhanh chóng.")
                                .treatment("Rải thuốc Deadline hoặc bắt thủ công. Thu gom trứng ốc đỏ.")
                                .prevention("Đặt lưới chắn, thả vịt vào ruộng. Giữ mực nước thấp giai đoạn mạ non.")
                                .severity("HIGH")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069220.png")
                                .build());

                pestRepository.save(PestDefinition.builder()
                                .name("Sâu khoang")
                                .scientificName("Spodoptera litura")
                                .description(
                                                "Ăn lá cây trốt, phá hoại rau màu và đậu. Hoạt động mạnh vào ban đêm.")
                                .treatment("Phun Plutella 5EC hoặc Takumi 20WG vào chiều tối.")
                                .prevention("Thắp đèn bẫy đêm, luân canh cây trồng. Dùng bẫy pheromone.")
                                .severity("MEDIUM")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069225.png")
                                .build());

                log.info("Created {} pest definitions", pestRepository.count());
        }

        private void patchMissingCropTimings() {
                log.info("Checking and patching missing crop timings...");
                List<CropDefinition> crops = cropRepository.findAll();
                boolean updated = false;

                for (CropDefinition crop : crops) {
                        // Only update if timing data is missing
                        if (crop.getFertilizerIntervalDays() == null) {
                                int fert = 30, germ = 7, water = 3, pest = 14; // Default fallback

                                String name = crop.getName().toLowerCase();

                                // Grains
                                if (name.contains("lúa")) {
                                        fert = 30;
                                        germ = 5;
                                        water = 1;
                                        pest = 14;
                                } else if (name.contains("ngô") || name.contains("bắp")) {
                                        fert = 25;
                                        germ = 7;
                                        water = 3;
                                        pest = 21;
                                }

                                // Fruits
                                else if (name.contains("thanh long")) {
                                        fert = 45;
                                        germ = 30;
                                        water = 7;
                                        pest = 30;
                                } else if (name.contains("xoài")) {
                                        fert = 60;
                                        germ = 0;
                                        water = 7;
                                        pest = 45;
                                } else if (name.contains("bưởi")) {
                                        fert = 60;
                                        germ = 0;
                                        water = 5;
                                        pest = 45;
                                } else if (name.contains("sầu riêng")) {
                                        fert = 60;
                                        germ = 0;
                                        water = 3;
                                        pest = 30;
                                } else if (name.contains("dưa hấu")) {
                                        fert = 21;
                                        germ = 4;
                                        water = 2;
                                        pest = 14;
                                }

                                // Vegetables
                                else if (name.contains("cà chua")) {
                                        fert = 14;
                                        germ = 5;
                                        water = 2;
                                        pest = 10;
                                } else if (name.contains("ớt")) {
                                        fert = 14;
                                        germ = 7;
                                        water = 2;
                                        pest = 14;
                                } else if (name.contains("cà rốt")) {
                                        fert = 21;
                                        germ = 14;
                                        water = 3;
                                        pest = 21;
                                } else if (name.contains("bắp cải")) {
                                        fert = 14;
                                        germ = 5;
                                        water = 2;
                                        pest = 14;
                                } else if (name.contains("rau muống")) {
                                        fert = 7;
                                        germ = 2;
                                        water = 1;
                                        pest = 7;
                                } else if (name.contains("cải xanh")) {
                                        fert = 7;
                                        germ = 3;
                                        water = 1;
                                        pest = 10;
                                } else if (name.contains("mía")) {
                                        fert = 45;
                                        germ = 14;
                                        water = 2;
                                        pest = 21;
                                }

                                // Industrial
                                else if (name.contains("hồ tiêu") || name.contains("điều") || name.contains("cà phê")
                                                || name.contains("cao su")) {
                                        fert = 60;
                                        germ = 0;
                                        water = 7;
                                        pest = 45;
                                }

                                // Legumes
                                else if (name.contains("đậu")) {
                                        fert = 21;
                                        germ = 5;
                                        water = 3;
                                        pest = 21;
                                }

                                // Tubers
                                else if (name.contains("khoai")) {
                                        fert = 30;
                                        germ = 0;
                                        water = 4;
                                        pest = 21;
                                } else if (name.contains("sắn")) {
                                        fert = 30;
                                        germ = 14;
                                        water = 5;
                                        pest = 21;
                                }

                                // Test Crop
                                else if (name.contains("test") || name.contains("rau mầm")) {
                                        fert = 0;
                                        germ = 0;
                                        water = 0;
                                        pest = 0;
                                }

                                crop.setFertilizerIntervalDays(fert);
                                crop.setGerminationDays(germ);
                                crop.setWateringIntervalDays(water);
                                crop.setPesticideIntervalDays(pest);
                                updated = true;
                                log.info("Patched timing for crop: {} (F: {}, G: {}, W: {}, P: {})", crop.getName(),
                                                fert, germ, water, pest);
                        }
                }

                if (updated) {
                        cropRepository.saveAll(crops);
                        log.info("Successfully patched timing data for existing crops");
                } else {
                        log.info("No crops needed timing patching");
                }
        }

        private void createTestCropIfNotExists() {
                String testCropName = "Rau mầm (Test)";
                if (cropRepository.findAll().stream().noneMatch(c -> c.getName().equals(testCropName))) {
                        log.info("Creating Test Crop '{}'...", testCropName);
                        cropRepository.save(CropDefinition.builder()
                                        .name(testCropName)
                                        .imageUrl("https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400")
                                        .category("VEGETABLE")
                                        .idealTempRange("{\"min\": 18, \"max\": 28}")
                                        .idealHumidityRange("{\"min\": 70, \"max\": 85}")
                                        .growthDurationDays(0)
                                        .seedsPerSqm(new BigDecimal("50"))
                                        .seedCostPerKg(new BigDecimal("50000"))
                                        .careCostPerSqm(new BigDecimal("2000"))
                                        .expectedYieldPerSqm(new BigDecimal("0.5"))
                                        .marketPricePerKg(new BigDecimal("80000"))
                                        .minTemp(18).maxTemp(30)
                                        .avoidWeather("[\"extreme heat\"]")
                                        .idealSeasons("[\"all year\"]")
                                        .commonPests("[]")
                                        .waterNeeds("MEDIUM")
                                        .soilTypePreferred("Đất thịt nhẹ")
                                        .description("Rau mầm dùng để test thu hoạch nhanh - 0 ngày. 即刻收割测试用.")
                                        .fertilizerIntervalDays(0)
                                        .germinationDays(0)
                                        .wateringIntervalDays(0)
                                        .pesticideIntervalDays(0)
                                        .build());
                        log.info("Test Crop created successfully.");
                } else {
                        log.info("Test Crop '{}' already exists.", testCropName);
                }
        }

        private void forceUpdateTestCrop() {
                List<CropDefinition> crops = cropRepository.findAll();
                boolean updated = false;
                for (CropDefinition c : crops) {
                        if (c.getName().contains("Test") || c.getName().contains("Rau mầm")) {
                                // Timing values
                                c.setFertilizerIntervalDays(0);
                                c.setGerminationDays(0);
                                c.setWateringIntervalDays(0);
                                c.setPesticideIntervalDays(0);
                                c.setGrowthDurationDays(0);
                                // Revenue values - realistic for profit
                                c.setSeedsPerSqm(new BigDecimal("0.5")); // Low seed usage
                                c.setSeedCostPerKg(new BigDecimal("30000")); // Cheap seeds
                                c.setCareCostPerSqm(new BigDecimal("500")); // Low care cost
                                c.setExpectedYieldPerSqm(new BigDecimal("2.0")); // High yield
                                c.setMarketPricePerKg(new BigDecimal("100000")); // High selling price
                                updated = true;
                        }
                }
                if (updated) {
                        cropRepository.saveAll(crops);
                        log.info("Forced update Test Crops to 0 days with realistic revenue values.");
                }
        }

        // =============================================
        // ANIMALS - 35+ Vietnamese livestock
        // =============================================
        private void createAnimalsIfNotExists() {
                if (animalRepository.count() > 0) {
                        log.info("Animals already exist ({}), skipping seed...", animalRepository.count());
                        return;
                }

                // ===== LAND ANIMALS (CAGED / FREE_RANGE) =====

                animalRepository.save(AnimalDefinition.builder()
                                .name("Trâu")
                                .iconName("agriculture")
                                .category("LAND")
                                .farmingTypes("[\"CAGED\", \"FREE_RANGE\"]")
                                .waterType(null)
                                .spacePerUnitSqm(new BigDecimal("20"))
                                .growthDurationDays(730)
                                .buyPricePerUnit(new BigDecimal("25000000"))
                                .sellPricePerUnit(new BigDecimal("40000000"))
                                .unit("con")
                                .description("Trâu Việt Nam, dùng để cày ruộng và lấy thịt.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"150-200kg\", \"buyPrice\": 15000000, \"sellPrice\": 25000000}, \"medium\": {\"weight\": \"200-350kg\", \"buyPrice\": 25000000, \"sellPrice\": 40000000}, \"large\": {\"weight\": \"350-500kg\", \"buyPrice\": 35000000, \"sellPrice\": 55000000}}")
                                .build());

                animalRepository.save(AnimalDefinition.builder()
                                .name("Bò thịt")
                                .iconName("agriculture")
                                .category("LAND")
                                .farmingTypes("[\"CAGED\", \"FREE_RANGE\"]")
                                .waterType(null)
                                .spacePerUnitSqm(new BigDecimal("15"))
                                .growthDurationDays(545)
                                .buyPricePerUnit(new BigDecimal("20000000"))
                                .sellPricePerUnit(new BigDecimal("35000000"))
                                .unit("con")
                                .description("Bò thịt nuôi lấy thịt, phổ biến ở miền Trung và Tây Nguyên.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"100-150kg\", \"buyPrice\": 12000000, \"sellPrice\": 20000000}, \"medium\": {\"weight\": \"150-250kg\", \"buyPrice\": 20000000, \"sellPrice\": 35000000}, \"large\": {\"weight\": \"250-400kg\", \"buyPrice\": 30000000, \"sellPrice\": 50000000}}")
                                .build());

                animalRepository.save(AnimalDefinition.builder()
                                .name("Bò sữa")
                                .iconName("agriculture")
                                .category("LAND")
                                .farmingTypes("[\"CAGED\"]")
                                .waterType(null)
                                .spacePerUnitSqm(new BigDecimal("20"))
                                .growthDurationDays(730)
                                .buyPricePerUnit(new BigDecimal("35000000"))
                                .sellPricePerUnit(new BigDecimal("45000000"))
                                .unit("con")
                                .description("Bò sữa Holstein, nuôi để vắt sữa.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"200-300kg\", \"buyPrice\": 25000000, \"sellPrice\": 30000000}, \"medium\": {\"weight\": \"300-450kg\", \"buyPrice\": 35000000, \"sellPrice\": 45000000}, \"large\": {\"weight\": \"450-600kg\", \"buyPrice\": 50000000, \"sellPrice\": 65000000}}")
                                .build());

                animalRepository.save(AnimalDefinition.builder()
                                .name("Lợn (Heo)")
                                .iconName("cruelty_free")
                                .category("LAND")
                                .farmingTypes("[\"CAGED\"]")
                                .waterType(null)
                                .spacePerUnitSqm(new BigDecimal("2"))
                                .growthDurationDays(180)
                                .buyPricePerUnit(new BigDecimal("1500000"))
                                .sellPricePerUnit(new BigDecimal("5000000"))
                                .unit("con")
                                .description("Lợn thịt, phổ biến nhất trong chăn nuôi Việt Nam.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"20-40kg\", \"buyPrice\": 800000, \"sellPrice\": 2000000}, \"medium\": {\"weight\": \"40-80kg\", \"buyPrice\": 1500000, \"sellPrice\": 5000000}, \"large\": {\"weight\": \"80-120kg\", \"buyPrice\": 3000000, \"sellPrice\": 8000000}}")
                                .build());

                animalRepository.save(AnimalDefinition.builder()
                                .name("Dê")
                                .iconName("pets")
                                .category("LAND")
                                .farmingTypes("[\"CAGED\", \"FREE_RANGE\"]")
                                .waterType(null)
                                .spacePerUnitSqm(new BigDecimal("3"))
                                .growthDurationDays(365)
                                .buyPricePerUnit(new BigDecimal("2000000"))
                                .sellPricePerUnit(new BigDecimal("4000000"))
                                .unit("con")
                                .description("Dê Bách Thảo, dê núi Ninh Thuận.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"10-20kg\", \"buyPrice\": 1000000, \"sellPrice\": 2000000}, \"medium\": {\"weight\": \"20-35kg\", \"buyPrice\": 2000000, \"sellPrice\": 4000000}, \"large\": {\"weight\": \"35-50kg\", \"buyPrice\": 3500000, \"sellPrice\": 6000000}}")
                                .build());

                animalRepository.save(AnimalDefinition.builder()
                                .name("Cừu")
                                .iconName("pets")
                                .category("LAND")
                                .farmingTypes("[\"CAGED\", \"FREE_RANGE\"]")
                                .waterType(null)
                                .spacePerUnitSqm(new BigDecimal("2.5"))
                                .growthDurationDays(365)
                                .buyPricePerUnit(new BigDecimal("2500000"))
                                .sellPricePerUnit(new BigDecimal("5000000"))
                                .unit("con")
                                .description("Cừu Phan Rang, nuôi lấy thịt và lông.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"15-25kg\", \"buyPrice\": 1500000, \"sellPrice\": 3000000}, \"medium\": {\"weight\": \"25-40kg\", \"buyPrice\": 2500000, \"sellPrice\": 5000000}, \"large\": {\"weight\": \"40-60kg\", \"buyPrice\": 4000000, \"sellPrice\": 7500000}}")
                                .build());

                animalRepository.save(AnimalDefinition.builder()
                                .name("Gà")
                                .iconName("egg_alt")
                                .category("LAND")
                                .farmingTypes("[\"CAGED\", \"FREE_RANGE\"]")
                                .waterType(null)
                                .spacePerUnitSqm(new BigDecimal("0.3"))
                                .growthDurationDays(120)
                                .buyPricePerUnit(new BigDecimal("30000"))
                                .sellPricePerUnit(new BigDecimal("120000"))
                                .unit("con")
                                .description("Gà ta, gà công nghiệp, gà tre.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"0.5-1kg\", \"buyPrice\": 15000, \"sellPrice\": 50000}, \"medium\": {\"weight\": \"1-2kg\", \"buyPrice\": 30000, \"sellPrice\": 120000}, \"large\": {\"weight\": \"2-3.5kg\", \"buyPrice\": 60000, \"sellPrice\": 200000}}")
                                .build());

                animalRepository.save(AnimalDefinition.builder()
                                .name("Chim cút")
                                .iconName("egg")
                                .category("LAND")
                                .farmingTypes("[\"CAGED\"]")
                                .waterType(null)
                                .spacePerUnitSqm(new BigDecimal("0.05"))
                                .growthDurationDays(45)
                                .buyPricePerUnit(new BigDecimal("8000"))
                                .sellPricePerUnit(new BigDecimal("25000"))
                                .unit("con")
                                .description("Chim cút lấy trứng và thịt.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"100-150g\", \"buyPrice\": 5000, \"sellPrice\": 15000}, \"medium\": {\"weight\": \"150-200g\", \"buyPrice\": 8000, \"sellPrice\": 25000}, \"large\": {\"weight\": \"200-300g\", \"buyPrice\": 12000, \"sellPrice\": 35000}}")
                                .build());

                // ===== FRESHWATER (POND - Nước ngọt) =====

                animalRepository.save(AnimalDefinition.builder()
                                .name("Cá rô phi")
                                .iconName("set_meal")
                                .category("FRESHWATER")
                                .farmingTypes("[\"POND\"]")
                                .waterType("FRESHWATER")
                                .spacePerUnitSqm(new BigDecimal("0.2"))
                                .growthDurationDays(180)
                                .buyPricePerUnit(new BigDecimal("5000"))
                                .sellPricePerUnit(new BigDecimal("35000"))
                                .unit("con")
                                .description("Cá rô phi dòng Gift, dễ nuôi, năng suất cao.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"200-400g\", \"buyPrice\": 3000, \"sellPrice\": 20000}, \"medium\": {\"weight\": \"400-700g\", \"buyPrice\": 5000, \"sellPrice\": 35000}, \"large\": {\"weight\": \"700g-1kg\", \"buyPrice\": 8000, \"sellPrice\": 50000}}")
                                .build());

                animalRepository.save(AnimalDefinition.builder()
                                .name("Cá trắm cỏ")
                                .iconName("set_meal")
                                .category("FRESHWATER")
                                .farmingTypes("[\"POND\"]")
                                .waterType("FRESHWATER")
                                .spacePerUnitSqm(new BigDecimal("0.5"))
                                .growthDurationDays(365)
                                .buyPricePerUnit(new BigDecimal("15000"))
                                .sellPricePerUnit(new BigDecimal("80000"))
                                .unit("con")
                                .description("Cá trắm cỏ, ăn cỏ, thịt ngon.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"0.5-1kg\", \"buyPrice\": 10000, \"sellPrice\": 45000}, \"medium\": {\"weight\": \"1-2kg\", \"buyPrice\": 15000, \"sellPrice\": 80000}, \"large\": {\"weight\": \"2-4kg\", \"buyPrice\": 25000, \"sellPrice\": 150000}}")
                                .build());

                animalRepository.save(AnimalDefinition.builder()
                                .name("Cá chép")
                                .iconName("set_meal")
                                .category("FRESHWATER")
                                .farmingTypes("[\"POND\"]")
                                .waterType("FRESHWATER")
                                .spacePerUnitSqm(new BigDecimal("0.3"))
                                .growthDurationDays(270)
                                .buyPricePerUnit(new BigDecimal("8000"))
                                .sellPricePerUnit(new BigDecimal("50000"))
                                .unit("con")
                                .description("Cá chép truyền thống Việt Nam.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"300-500g\", \"buyPrice\": 5000, \"sellPrice\": 30000}, \"medium\": {\"weight\": \"500-1kg\", \"buyPrice\": 8000, \"sellPrice\": 50000}, \"large\": {\"weight\": \"1-2kg\", \"buyPrice\": 15000, \"sellPrice\": 90000}}")
                                .build());

                animalRepository.save(AnimalDefinition.builder()
                                .name("Cá mè")
                                .iconName("set_meal")
                                .category("FRESHWATER")
                                .farmingTypes("[\"POND\"]")
                                .waterType("FRESHWATER")
                                .spacePerUnitSqm(new BigDecimal("0.4"))
                                .growthDurationDays(240)
                                .buyPricePerUnit(new BigDecimal("6000"))
                                .sellPricePerUnit(new BigDecimal("30000"))
                                .unit("con")
                                .description("Cá mè trắng, nuôi ghép với cá khác.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"200-500g\", \"buyPrice\": 4000, \"sellPrice\": 18000}, \"medium\": {\"weight\": \"500-1kg\", \"buyPrice\": 6000, \"sellPrice\": 30000}, \"large\": {\"weight\": \"1-2kg\", \"buyPrice\": 10000, \"sellPrice\": 55000}}")
                                .build());

                animalRepository.save(AnimalDefinition.builder()
                                .name("Cá trê")
                                .iconName("set_meal")
                                .category("FRESHWATER")
                                .farmingTypes("[\"POND\"]")
                                .waterType("FRESHWATER")
                                .spacePerUnitSqm(new BigDecimal("0.15"))
                                .growthDurationDays(150)
                                .buyPricePerUnit(new BigDecimal("3000"))
                                .sellPricePerUnit(new BigDecimal("45000"))
                                .unit("con")
                                .description("Cá trê vàng, cá trê phi.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"150-300g\", \"buyPrice\": 2000, \"sellPrice\": 25000}, \"medium\": {\"weight\": \"300-500g\", \"buyPrice\": 3000, \"sellPrice\": 45000}, \"large\": {\"weight\": \"500-800g\", \"buyPrice\": 5000, \"sellPrice\": 70000}}")
                                .build());

                animalRepository.save(AnimalDefinition.builder()
                                .name("Cá lóc")
                                .iconName("set_meal")
                                .category("FRESHWATER")
                                .farmingTypes("[\"POND\"]")
                                .waterType("FRESHWATER")
                                .spacePerUnitSqm(new BigDecimal("0.25"))
                                .growthDurationDays(180)
                                .buyPricePerUnit(new BigDecimal("5000"))
                                .sellPricePerUnit(new BigDecimal("70000"))
                                .unit("con")
                                .description("Cá lóc đồng, cá lóc bông.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"300-500g\", \"buyPrice\": 3000, \"sellPrice\": 40000}, \"medium\": {\"weight\": \"500-1kg\", \"buyPrice\": 5000, \"sellPrice\": 70000}, \"large\": {\"weight\": \"1-2kg\", \"buyPrice\": 10000, \"sellPrice\": 130000}}")
                                .build());

                animalRepository.save(AnimalDefinition.builder()
                                .name("Cá tra")
                                .iconName("set_meal")
                                .category("FRESHWATER")
                                .farmingTypes("[\"POND\"]")
                                .waterType("FRESHWATER")
                                .spacePerUnitSqm(new BigDecimal("0.3"))
                                .growthDurationDays(210)
                                .buyPricePerUnit(new BigDecimal("4000"))
                                .sellPricePerUnit(new BigDecimal("25000"))
                                .unit("con")
                                .description("Cá tra xuất khẩu, chủ lực ĐBSCL.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"500-800g\", \"buyPrice\": 2500, \"sellPrice\": 15000}, \"medium\": {\"weight\": \"800g-1.5kg\", \"buyPrice\": 4000, \"sellPrice\": 25000}, \"large\": {\"weight\": \"1.5-3kg\", \"buyPrice\": 7000, \"sellPrice\": 45000}}")
                                .build());

                animalRepository.save(AnimalDefinition.builder()
                                .name("Cá basa")
                                .iconName("set_meal")
                                .category("FRESHWATER")
                                .farmingTypes("[\"POND\"]")
                                .waterType("FRESHWATER")
                                .spacePerUnitSqm(new BigDecimal("0.35"))
                                .growthDurationDays(240)
                                .buyPricePerUnit(new BigDecimal("5000"))
                                .sellPricePerUnit(new BigDecimal("30000"))
                                .unit("con")
                                .description("Cá basa, họ cá tra.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"0.5-1kg\", \"buyPrice\": 3000, \"sellPrice\": 18000}, \"medium\": {\"weight\": \"1-2kg\", \"buyPrice\": 5000, \"sellPrice\": 30000}, \"large\": {\"weight\": \"2-4kg\", \"buyPrice\": 9000, \"sellPrice\": 55000}}")
                                .build());

                animalRepository.save(AnimalDefinition.builder()
                                .name("Lươn")
                                .iconName("set_meal")
                                .category("FRESHWATER")
                                .farmingTypes("[\"POND\"]")
                                .waterType("FRESHWATER")
                                .spacePerUnitSqm(new BigDecimal("0.1"))
                                .growthDurationDays(270)
                                .buyPricePerUnit(new BigDecimal("10000"))
                                .sellPricePerUnit(new BigDecimal("180000"))
                                .unit("con")
                                .description("Lươn đồng, giá trị kinh tế cao.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"50-100g\", \"buyPrice\": 5000, \"sellPrice\": 80000}, \"medium\": {\"weight\": \"100-200g\", \"buyPrice\": 10000, \"sellPrice\": 180000}, \"large\": {\"weight\": \"200-400g\", \"buyPrice\": 20000, \"sellPrice\": 350000}}")
                                .build());

                animalRepository.save(AnimalDefinition.builder()
                                .name("Ếch")
                                .iconName("pest_control")
                                .category("FRESHWATER")
                                .farmingTypes("[\"POND\"]")
                                .waterType("FRESHWATER")
                                .spacePerUnitSqm(new BigDecimal("0.08"))
                                .growthDurationDays(120)
                                .buyPricePerUnit(new BigDecimal("5000"))
                                .sellPricePerUnit(new BigDecimal("60000"))
                                .unit("con")
                                .description("Ếch Thái Lan, nuôi công nghiệp.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"50-100g\", \"buyPrice\": 3000, \"sellPrice\": 30000}, \"medium\": {\"weight\": \"100-200g\", \"buyPrice\": 5000, \"sellPrice\": 60000}, \"large\": {\"weight\": \"200-350g\", \"buyPrice\": 8000, \"sellPrice\": 100000}}")
                                .build());

                animalRepository.save(AnimalDefinition.builder()
                                .name("Ốc bươu đen")
                                .iconName("filter_tilt_shift")
                                .category("FRESHWATER")
                                .farmingTypes("[\"POND\"]")
                                .waterType("FRESHWATER")
                                .spacePerUnitSqm(new BigDecimal("0.02"))
                                .growthDurationDays(90)
                                .buyPricePerUnit(new BigDecimal("500"))
                                .sellPricePerUnit(new BigDecimal("3000"))
                                .unit("con")
                                .description("Ốc bươu đen, đặc sản miền Bắc.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"20-40g\", \"buyPrice\": 300, \"sellPrice\": 1500}, \"medium\": {\"weight\": \"40-70g\", \"buyPrice\": 500, \"sellPrice\": 3000}, \"large\": {\"weight\": \"70-120g\", \"buyPrice\": 800, \"sellPrice\": 5000}}")
                                .build());

                // ===== BRACKISH WATER (POND - Nước lợ) =====

                animalRepository.save(AnimalDefinition.builder()
                                .name("Tôm sú")
                                .iconName("set_meal")
                                .category("BRACKISH")
                                .farmingTypes("[\"POND\"]")
                                .waterType("BRACKISH")
                                .spacePerUnitSqm(new BigDecimal("0.02"))
                                .growthDurationDays(120)
                                .buyPricePerUnit(new BigDecimal("1500"))
                                .sellPricePerUnit(new BigDecimal("15000"))
                                .unit("con")
                                .description("Tôm sú, xuất khẩu chủ lực.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"15-25g\", \"buyPrice\": 800, \"sellPrice\": 8000}, \"medium\": {\"weight\": \"25-40g\", \"buyPrice\": 1500, \"sellPrice\": 15000}, \"large\": {\"weight\": \"40-60g\", \"buyPrice\": 2500, \"sellPrice\": 25000}}")
                                .build());

                animalRepository.save(AnimalDefinition.builder()
                                .name("Tôm thẻ chân trắng")
                                .iconName("set_meal")
                                .category("BRACKISH")
                                .farmingTypes("[\"POND\"]")
                                .waterType("BRACKISH")
                                .spacePerUnitSqm(new BigDecimal("0.015"))
                                .growthDurationDays(90)
                                .buyPricePerUnit(new BigDecimal("1000"))
                                .sellPricePerUnit(new BigDecimal("12000"))
                                .unit("con")
                                .description("Tôm thẻ chân trắng, nuôi công nghiệp.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"10-20g\", \"buyPrice\": 600, \"sellPrice\": 7000}, \"medium\": {\"weight\": \"20-35g\", \"buyPrice\": 1000, \"sellPrice\": 12000}, \"large\": {\"weight\": \"35-50g\", \"buyPrice\": 1800, \"sellPrice\": 20000}}")
                                .build());

                animalRepository.save(AnimalDefinition.builder()
                                .name("Cua biển")
                                .iconName("set_meal")
                                .category("BRACKISH")
                                .farmingTypes("[\"POND\"]")
                                .waterType("BRACKISH")
                                .spacePerUnitSqm(new BigDecimal("0.5"))
                                .growthDurationDays(180)
                                .buyPricePerUnit(new BigDecimal("50000"))
                                .sellPricePerUnit(new BigDecimal("350000"))
                                .unit("con")
                                .description("Cua biển, cua gạch.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"200-300g\", \"buyPrice\": 30000, \"sellPrice\": 200000}, \"medium\": {\"weight\": \"300-500g\", \"buyPrice\": 50000, \"sellPrice\": 350000}, \"large\": {\"weight\": \"500-800g\", \"buyPrice\": 80000, \"sellPrice\": 550000}}")
                                .build());

                animalRepository.save(AnimalDefinition.builder()
                                .name("Cá kèo")
                                .iconName("set_meal")
                                .category("BRACKISH")
                                .farmingTypes("[\"POND\"]")
                                .waterType("BRACKISH")
                                .spacePerUnitSqm(new BigDecimal("0.1"))
                                .growthDurationDays(150)
                                .buyPricePerUnit(new BigDecimal("3000"))
                                .sellPricePerUnit(new BigDecimal("80000"))
                                .unit("con")
                                .description("Cá kèo, đặc sản miền Tây.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"20-40g\", \"buyPrice\": 2000, \"sellPrice\": 45000}, \"medium\": {\"weight\": \"40-70g\", \"buyPrice\": 3000, \"sellPrice\": 80000}, \"large\": {\"weight\": \"70-100g\", \"buyPrice\": 5000, \"sellPrice\": 120000}}")
                                .build());

                animalRepository.save(AnimalDefinition.builder()
                                .name("Cá đối")
                                .iconName("set_meal")
                                .category("BRACKISH")
                                .farmingTypes("[\"POND\"]")
                                .waterType("BRACKISH")
                                .spacePerUnitSqm(new BigDecimal("0.2"))
                                .growthDurationDays(180)
                                .buyPricePerUnit(new BigDecimal("5000"))
                                .sellPricePerUnit(new BigDecimal("60000"))
                                .unit("con")
                                .description("Cá đối mục, cá đối đất.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"150-300g\", \"buyPrice\": 3000, \"sellPrice\": 35000}, \"medium\": {\"weight\": \"300-500g\", \"buyPrice\": 5000, \"sellPrice\": 60000}, \"large\": {\"weight\": \"500-800g\", \"buyPrice\": 8000, \"sellPrice\": 100000}}")
                                .build());

                // ===== SALTWATER (POND - Nước mặn) =====

                animalRepository.save(AnimalDefinition.builder()
                                .name("Cá mú")
                                .iconName("set_meal")
                                .category("SALTWATER")
                                .farmingTypes("[\"POND\"]")
                                .waterType("SALTWATER")
                                .spacePerUnitSqm(new BigDecimal("1"))
                                .growthDurationDays(365)
                                .buyPricePerUnit(new BigDecimal("100000"))
                                .sellPricePerUnit(new BigDecimal("450000"))
                                .unit("con")
                                .description("Cá mú, cá song, giá trị cao.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"0.5-1kg\", \"buyPrice\": 60000, \"sellPrice\": 250000}, \"medium\": {\"weight\": \"1-2kg\", \"buyPrice\": 100000, \"sellPrice\": 450000}, \"large\": {\"weight\": \"2-4kg\", \"buyPrice\": 180000, \"sellPrice\": 800000}}")
                                .build());

                animalRepository.save(AnimalDefinition.builder()
                                .name("Cá chim biển")
                                .iconName("set_meal")
                                .category("SALTWATER")
                                .farmingTypes("[\"POND\"]")
                                .waterType("SALTWATER")
                                .spacePerUnitSqm(new BigDecimal("0.8"))
                                .growthDurationDays(300)
                                .buyPricePerUnit(new BigDecimal("50000"))
                                .sellPricePerUnit(new BigDecimal("200000"))
                                .unit("con")
                                .description("Cá chim vây vàng.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"300-500g\", \"buyPrice\": 30000, \"sellPrice\": 120000}, \"medium\": {\"weight\": \"500-800g\", \"buyPrice\": 50000, \"sellPrice\": 200000}, \"large\": {\"weight\": \"800g-1.5kg\", \"buyPrice\": 80000, \"sellPrice\": 350000}}")
                                .build());

                animalRepository.save(AnimalDefinition.builder()
                                .name("Cá hồng")
                                .iconName("set_meal")
                                .category("SALTWATER")
                                .farmingTypes("[\"POND\"]")
                                .waterType("SALTWATER")
                                .spacePerUnitSqm(new BigDecimal("0.6"))
                                .growthDurationDays(270)
                                .buyPricePerUnit(new BigDecimal("40000"))
                                .sellPricePerUnit(new BigDecimal("180000"))
                                .unit("con")
                                .description("Cá hồng Mỹ, nuôi lồng bè.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"300-500g\", \"buyPrice\": 25000, \"sellPrice\": 100000}, \"medium\": {\"weight\": \"500-1kg\", \"buyPrice\": 40000, \"sellPrice\": 180000}, \"large\": {\"weight\": \"1-2kg\", \"buyPrice\": 70000, \"sellPrice\": 320000}}")
                                .build());

                animalRepository.save(AnimalDefinition.builder()
                                .name("Tôm hùm")
                                .iconName("set_meal")
                                .category("SALTWATER")
                                .farmingTypes("[\"POND\"]")
                                .waterType("SALTWATER")
                                .spacePerUnitSqm(new BigDecimal("2"))
                                .growthDurationDays(730)
                                .buyPricePerUnit(new BigDecimal("500000"))
                                .sellPricePerUnit(new BigDecimal("1800000"))
                                .unit("con")
                                .description("Tôm hùm xanh, tôm hùm bông.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"200-400g\", \"buyPrice\": 300000, \"sellPrice\": 1000000}, \"medium\": {\"weight\": \"400-700g\", \"buyPrice\": 500000, \"sellPrice\": 1800000}, \"large\": {\"weight\": \"700g-1.2kg\", \"buyPrice\": 800000, \"sellPrice\": 3000000}}")
                                .build());

                animalRepository.save(AnimalDefinition.builder()
                                .name("Hàu")
                                .iconName("filter_tilt_shift")
                                .category("SALTWATER")
                                .farmingTypes("[\"POND\"]")
                                .waterType("SALTWATER")
                                .spacePerUnitSqm(new BigDecimal("0.01"))
                                .growthDurationDays(180)
                                .buyPricePerUnit(new BigDecimal("1000"))
                                .sellPricePerUnit(new BigDecimal("8000"))
                                .unit("con")
                                .description("Hàu sữa, hàu Thái Bình Dương.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"30-50g\", \"buyPrice\": 600, \"sellPrice\": 4000}, \"medium\": {\"weight\": \"50-80g\", \"buyPrice\": 1000, \"sellPrice\": 8000}, \"large\": {\"weight\": \"80-120g\", \"buyPrice\": 1500, \"sellPrice\": 12000}}")
                                .build());

                animalRepository.save(AnimalDefinition.builder()
                                .name("Nghêu")
                                .iconName("filter_tilt_shift")
                                .category("SALTWATER")
                                .farmingTypes("[\"POND\"]")
                                .waterType("SALTWATER")
                                .spacePerUnitSqm(new BigDecimal("0.01"))
                                .growthDurationDays(150)
                                .buyPricePerUnit(new BigDecimal("300"))
                                .sellPricePerUnit(new BigDecimal("2500"))
                                .unit("con")
                                .description("Nghêu Bến Tre, ngao.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"10-20g\", \"buyPrice\": 200, \"sellPrice\": 1500}, \"medium\": {\"weight\": \"20-35g\", \"buyPrice\": 300, \"sellPrice\": 2500}, \"large\": {\"weight\": \"35-50g\", \"buyPrice\": 500, \"sellPrice\": 4000}}")
                                .build());

                animalRepository.save(AnimalDefinition.builder()
                                .name("Sò")
                                .iconName("filter_tilt_shift")
                                .category("SALTWATER")
                                .farmingTypes("[\"POND\"]")
                                .waterType("SALTWATER")
                                .spacePerUnitSqm(new BigDecimal("0.01"))
                                .growthDurationDays(120)
                                .buyPricePerUnit(new BigDecimal("400"))
                                .sellPricePerUnit(new BigDecimal("3000"))
                                .unit("con")
                                .description("Sò huyết, sò điệp.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"15-25g\", \"buyPrice\": 250, \"sellPrice\": 1800}, \"medium\": {\"weight\": \"25-40g\", \"buyPrice\": 400, \"sellPrice\": 3000}, \"large\": {\"weight\": \"40-60g\", \"buyPrice\": 600, \"sellPrice\": 5000}}")
                                .build());

                // ===== SPECIAL ENVIRONMENT =====

                animalRepository.save(AnimalDefinition.builder()
                                .name("Vịt")
                                .iconName("egg_alt")
                                .category("SPECIAL")
                                .farmingTypes("[\"FREE_RANGE\", \"SPECIAL\"]")
                                .waterType(null)
                                .spacePerUnitSqm(new BigDecimal("0.5"))
                                .growthDurationDays(90)
                                .buyPricePerUnit(new BigDecimal("25000"))
                                .sellPricePerUnit(new BigDecimal("100000"))
                                .unit("con")
                                .description("Vịt thịt, vịt đẻ trứng.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"1-1.5kg\", \"buyPrice\": 15000, \"sellPrice\": 55000}, \"medium\": {\"weight\": \"1.5-2.5kg\", \"buyPrice\": 25000, \"sellPrice\": 100000}, \"large\": {\"weight\": \"2.5-3.5kg\", \"buyPrice\": 40000, \"sellPrice\": 150000}}")
                                .build());

                animalRepository.save(AnimalDefinition.builder()
                                .name("Ngan")
                                .iconName("egg_alt")
                                .category("SPECIAL")
                                .farmingTypes("[\"FREE_RANGE\", \"SPECIAL\"]")
                                .waterType(null)
                                .spacePerUnitSqm(new BigDecimal("0.6"))
                                .growthDurationDays(120)
                                .buyPricePerUnit(new BigDecimal("50000"))
                                .sellPricePerUnit(new BigDecimal("180000"))
                                .unit("con")
                                .description("Ngan (vịt xiêm), thịt ngon.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"1.5-2kg\", \"buyPrice\": 30000, \"sellPrice\": 100000}, \"medium\": {\"weight\": \"2-3kg\", \"buyPrice\": 50000, \"sellPrice\": 180000}, \"large\": {\"weight\": \"3-4.5kg\", \"buyPrice\": 80000, \"sellPrice\": 280000}}")
                                .build());

                animalRepository.save(AnimalDefinition.builder()
                                .name("Ngỗng")
                                .iconName("egg_alt")
                                .category("SPECIAL")
                                .farmingTypes("[\"FREE_RANGE\", \"SPECIAL\"]")
                                .waterType(null)
                                .spacePerUnitSqm(new BigDecimal("0.8"))
                                .growthDurationDays(150)
                                .buyPricePerUnit(new BigDecimal("80000"))
                                .sellPricePerUnit(new BigDecimal("300000"))
                                .unit("con")
                                .description("Ngỗng, nuôi lấy thịt và lông.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"2-3kg\", \"buyPrice\": 50000, \"sellPrice\": 180000}, \"medium\": {\"weight\": \"3-5kg\", \"buyPrice\": 80000, \"sellPrice\": 300000}, \"large\": {\"weight\": \"5-8kg\", \"buyPrice\": 130000, \"sellPrice\": 480000}}")
                                .build());

                animalRepository.save(AnimalDefinition.builder()
                                .name("Ong")
                                .iconName("hive")
                                .category("SPECIAL")
                                .farmingTypes("[\"SPECIAL\"]")
                                .waterType(null)
                                .spacePerUnitSqm(new BigDecimal("0.5"))
                                .growthDurationDays(365)
                                .buyPricePerUnit(new BigDecimal("500000"))
                                .sellPricePerUnit(new BigDecimal("1500000"))
                                .unit("tổ")
                                .description("Ong mật, nuôi lấy mật ong.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"1-2kg mật/năm\", \"buyPrice\": 300000, \"sellPrice\": 800000}, \"medium\": {\"weight\": \"2-4kg mật/năm\", \"buyPrice\": 500000, \"sellPrice\": 1500000}, \"large\": {\"weight\": \"4-7kg mật/năm\", \"buyPrice\": 800000, \"sellPrice\": 2500000}}")
                                .build());

                animalRepository.save(AnimalDefinition.builder()
                                .name("Tằm")
                                .iconName("bug_report")
                                .category("SPECIAL")
                                .farmingTypes("[\"SPECIAL\"]")
                                .waterType(null)
                                .spacePerUnitSqm(new BigDecimal("0.01"))
                                .growthDurationDays(45)
                                .buyPricePerUnit(new BigDecimal("100"))
                                .sellPricePerUnit(new BigDecimal("1000"))
                                .unit("con")
                                .description("Tằm dâu, nuôi lấy kén tơ lụa.")
                                .imageUrl("https://cdn-icons-png.flaticon.com/512/3069/3069186.png")
                                .sizes("{\"small\": {\"weight\": \"1-2g\", \"buyPrice\": 50, \"sellPrice\": 500}, \"medium\": {\"weight\": \"2-4g\", \"buyPrice\": 100, \"sellPrice\": 1000}, \"large\": {\"weight\": \"4-6g\", \"buyPrice\": 150, \"sellPrice\": 1500}}")
                                .build());

                log.info("Created {} animal definitions", animalRepository.count());
        }
}
