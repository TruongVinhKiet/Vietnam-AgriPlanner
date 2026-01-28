package com.agriplanner.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "guide_categories")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GuideCategory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(unique = true, nullable = false, length = 100)
    private String slug;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 50)
    private String icon; // Material icon name

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler", "children", "parent" })
    private GuideCategory parent;

    @OneToMany(mappedBy = "parent")
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler", "children", "parent" })
    @Builder.Default
    private List<GuideCategory> children = new ArrayList<>();

    @Column(name = "sort_order")
    @Builder.Default
    private Integer sortOrder = 0;
}
