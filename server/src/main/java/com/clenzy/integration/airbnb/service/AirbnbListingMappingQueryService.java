package com.clenzy.integration.airbnb.service;

import com.clenzy.integration.airbnb.repository.AirbnbListingMappingRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lectures des mappings listing Airbnb pour la couche presentation
 * — refactor T-ARCH-01 : plus aucun repository dans les controllers.
 */
@Service
public class AirbnbListingMappingQueryService {

    private final AirbnbListingMappingRepository listingMappingRepository;

    public AirbnbListingMappingQueryService(AirbnbListingMappingRepository listingMappingRepository) {
        this.listingMappingRepository = listingMappingRepository;
    }

    /** Nombre de listings lies (sync active) pour l'ecran de statut de connexion. */
    @Transactional(readOnly = true)
    public int countSyncEnabledMappings() {
        return listingMappingRepository.findBySyncEnabled(true).size();
    }
}
