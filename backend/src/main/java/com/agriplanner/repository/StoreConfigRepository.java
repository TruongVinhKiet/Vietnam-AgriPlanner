package com.agriplanner.repository;

import com.agriplanner.model.StoreConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Repository;

@Repository
public interface StoreConfigRepository extends JpaRepository<StoreConfig, Long> {

    @NonNull
    @SuppressWarnings("null")
    default StoreConfig getConfig() {
        return findById(1L).orElseGet(() -> {
            StoreConfig config = StoreConfig.builder().build();
            config.setId(1L);
            return java.util.Objects.requireNonNull(save(config));
        });
    }
}
