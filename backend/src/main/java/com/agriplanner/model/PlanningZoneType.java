package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Entity representing planning zone types (danh mục loại đất quy hoạch)
 */
@Entity
@Table(name = "planning_zone_types")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PlanningZoneType {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(unique = true, nullable = false, length = 20)
    private String code;
    
    @Column(nullable = false, length = 100)
    private String name;
    
    @Column(nullable = false, length = 50)
    private String category;
    
    @Column(columnDefinition = "TEXT")
    private String description;
    
    @Column(name = "default_color", nullable = false, length = 7)
    private String defaultColor;
    
    @Column(length = 50)
    private String icon;
}
