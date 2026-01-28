package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "cooperative_inventory")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CooperativeInventory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cooperative_id", nullable = false)
    private Cooperative cooperative;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shop_item_id")
    private ShopItem shopItem; // For purchased items

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "crop_definition_id")
    private CropDefinition cropDefinition; // For crops to sell

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "animal_definition_id")
    private AnimalDefinition animalDefinition; // For animals to sell

    @Column(name = "product_name", nullable = false)
    private String productName;

    @Enumerated(EnumType.STRING)
    @Column(name = "product_type", nullable = false, length = 20)
    private ProductType productType;

    @Column(precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal quantity = BigDecimal.ZERO;

    @Column(length = 30)
    private String unit;

    @Column(name = "total_value", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal totalValue = BigDecimal.ZERO; // Total money value

    @Column(name = "created_at")
    @Builder.Default
    private ZonedDateTime createdAt = ZonedDateTime.now();

    @Column(name = "updated_at")
    @Builder.Default
    private ZonedDateTime updatedAt = ZonedDateTime.now();

    @OneToMany(mappedBy = "inventory", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<CooperativeInventoryContribution> contributions = new ArrayList<>();

    public enum ProductType {
        SHOP_ITEM, // From shop (bought)
        CROP, // From farming (to sell)
        ANIMAL // From livestock (to sell)
    }

    public void addQuantity(BigDecimal qty) {
        this.quantity = this.quantity.add(qty);
        this.updatedAt = ZonedDateTime.now();
    }

    public void subtractQuantity(BigDecimal qty) {
        this.quantity = this.quantity.subtract(qty);
        this.updatedAt = ZonedDateTime.now();
    }
}
