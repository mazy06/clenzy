package com.clenzy.repository;

import com.clenzy.model.PropertyPricingConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PropertyPricingConfigRepository extends JpaRepository<PropertyPricingConfig, Long> {

    /**
     * Resolution de l'override pricing pour une propriete. Utilise par
     * SimulationService AVANT de tomber sur l'estimation empirique ou le default.
     */
    Optional<PropertyPricingConfig> findByPropertyId(Long propertyId);
}
