package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.MarketplaceProvider;
import com.clenzy.marketplace.model.MarketplaceProviderZone;
import com.clenzy.marketplace.repository.MarketplaceProviderZoneRepository;
import jakarta.validation.constraints.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Locale;

/** Modifie la déclaration canonique, y compris depuis la fiche administrative Baitly. */
@Service
public class BaitlyProviderCoverageEditing {
    private final MarketplaceProviderZoneRepository zones;

    public BaitlyProviderCoverageEditing(MarketplaceProviderZoneRepository zones) { this.zones = zones; }

    public record Zone(@NotBlank @Pattern(regexp="[a-zA-Z]{2}") String countryCode,
            @Size(max=3) String department, @Size(max=5) String arrondissement,
            @Size(max=100) String city, @Size(max=10) String postalCode,
            @Min(0) @Max(1000) Integer radiusKm, boolean primary) {}

    @Transactional(propagation = Propagation.MANDATORY)
    public void replace(MarketplaceProvider provider, List<Zone> inputs) {
        if (inputs == null) return; // Les anciens clients ne modifient pas les secteurs.
        if (inputs.size() > 100) throw new IllegalArgumentException("Trop de secteurs d'intervention");
        for (var input : inputs) validate(input);
        if (provider.getUserId() != null) {
            zones.lockIndividual(provider.getUserId());
            zones.initializeIndividual(provider.getUserId());
            zones.deleteIndividualZones(provider.getUserId());
        } else {
            zones.deleteCandidateZones(provider.getId());
        }
        zones.flush();
        for (var input : inputs.stream().distinct().toList()) {
            var zone = new MarketplaceProviderZone();
            if (provider.getUserId() != null) zone.setUserId(provider.getUserId());
            else zone.setProvider(provider);
            zone.setCountryCode(input.countryCode().toUpperCase(Locale.ROOT));
            zone.setDepartment(clean(input.department()));
            zone.setArrondissement(com.clenzy.util.BaitlyArrondissement.requireValid(input.countryCode(),input.department(),input.arrondissement()));
            zone.setCity(com.clenzy.util.BaitlyFrenchCities.requireValid(input.countryCode(),input.department(),input.arrondissement(),input.city())); zone.setPostalCode(clean(input.postalCode()));
            zone.setRadiusKm(input.radiusKm()); zone.setPrimary(input.primary());
            zones.save(zone);
        }
        zones.flush();
    }

    private static void validate(Zone zone) {
        if (zone == null || zone.countryCode() == null || !zone.countryCode().matches("[a-zA-Z]{2}"))
            throw new IllegalArgumentException("Pays du secteur invalide");
        if ("FR".equalsIgnoreCase(zone.countryCode())) {
            if (clean(zone.department()) == null || !zone.department().trim().matches("(?:0[1-9]|[1-8][0-9]|9[0-5]|2[AaBb]|97[1-46])"))
                throw new IllegalArgumentException("Département invalide");
            com.clenzy.util.BaitlyArrondissement.requireValid(zone.countryCode(),zone.department(),zone.arrondissement());
            com.clenzy.util.BaitlyFrenchCities.requireValid(zone.countryCode(),zone.department(),zone.arrondissement(),zone.city());
        } else if (clean(zone.city()) == null) {
            throw new IllegalArgumentException("Indiquez la ville du secteur");
        }
    }

    private static String clean(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
