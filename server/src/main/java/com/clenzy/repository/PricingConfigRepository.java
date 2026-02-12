package com.clenzy.repository;

import com.clenzy.model.PricingConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PricingConfigRepository extends JpaRepository<PricingConfig, Long> {
    Optional<PricingConfig> findTopByOrderByIdDesc();
}
