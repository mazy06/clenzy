package com.clenzy.marketplace.service;

import com.clenzy.marketplace.repository.MarketplaceProviderZoneRepository;
import com.clenzy.repository.PropertyRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Valide les zones canoniques au moment où les parties engagent une prestation. */
@Service
public class MarketplaceGeographicEligibility {
    private final ProviderDocumentaryService documentary;
    private final PropertyRepository properties;
    private final MarketplaceProviderZoneRepository zones;

    public MarketplaceGeographicEligibility(PropertyRepository properties, MarketplaceProviderZoneRepository zones, ProviderDocumentaryService documentary) {
        this.documentary=documentary;
        this.properties = properties;
        this.zones = zones;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void requireService(Long providerId, Long propertyId, Long organizationId, String category, String item, java.time.LocalDate date) {
        requireCoverage(providerId,propertyId,organizationId);
        if(propertyId==null) { documentary.requirePublication(providerId); return; }
        var location=properties.lockMarketplaceLocation(propertyId,organizationId).orElseThrow();
        String scope=item!=null ? "ITEM:"+item : category!=null ? "CATEGORY:"+category : "TYPE:OTHER";
        documentary.require(providerId,location.getCountryCode(),scope,date==null ? java.time.LocalDate.now() : date);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void requireCoverage(Long providerId, Long propertyId, Long organizationId) {
        if (propertyId == null) return; // Une demande générale ne promet aucun lieu d'intervention.
        if (organizationId == null) throw new AccessDeniedException("Organisation non résolue");
        var location = properties.lockMarketplaceLocation(propertyId, organizationId)
            .orElseThrow(() -> new AccessDeniedException("Logement introuvable"));
        // Même ordre que l'activation des zones : fiche, puis personne.
        var owner = zones.lockCoverageOwner(providerId)
            .orElseThrow(() -> new IllegalArgumentException("Prestataire introuvable"));
        if (owner.getUserId() != null) zones.lockIndividual(owner.getUserId());
        if (!zones.acceptsProperty(providerId, location.getType()))
            throw new IllegalStateException("Le prestataire n'accepte pas ce type de logement.");
        String country = location.getCountryCode();
        if (country == null || country.isBlank()) country = "FR";
        // Lecture séparée après le verrou : voit les modifications de zones qui viennent de terminer.
        if (!zones.covers(providerId, country, location.getDepartment(), location.getArrondissement(), location.getCity()))
            throw new IllegalStateException("Le logement n'est pas couvert par les zones actuelles du prestataire. Vérifiez les zones et l'adresse du logement.");
    }
}
