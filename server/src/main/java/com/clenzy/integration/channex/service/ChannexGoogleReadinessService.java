package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.Property;
import com.clenzy.repository.PropertyPhotoRepository;
import com.clenzy.repository.PropertyRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Phase C4 — checker de readiness Google Vacation Rentals (canal GHA, gratuit
 * via free booking links). Google verifie les prerequis de contenu AVANT
 * d'activer le canal : ce diagnostic evite de decouvrir les manques apres 1 a
 * 4 semaines de delai de matching Google.
 *
 * <p>Deux familles de checks :</p>
 * <ul>
 *   <li><b>auto</b> — verifiables depuis les donnees Clenzy/Channex (adresse,
 *       geo, phone, timezone, description, ≥8 photos VR...) ;</li>
 *   <li><b>manual</b> — a configurer cote Channex (settings du CHANNEL Google :
 *       bedrooms/bathrooms/beds counts, billing type "Vacation Rental",
 *       website https, cancellation policy) — pas de modele Clenzy equivalent,
 *       on les liste plutot que de les inventer.</li>
 * </ul>
 */
@Service
public class ChannexGoogleReadinessService {

    /** Minimum de photos exige par Google pour un Vacation Rental. */
    private static final int GOOGLE_VR_MIN_PHOTOS = 8;

    private final ChannexPropertyMappingRepository mappingRepository;
    private final PropertyRepository propertyRepository;
    private final PropertyPhotoRepository photoRepository;
    private final ChannexClient channexClient;

    public ChannexGoogleReadinessService(ChannexPropertyMappingRepository mappingRepository,
                                         PropertyRepository propertyRepository,
                                         PropertyPhotoRepository photoRepository,
                                         ChannexClient channexClient) {
        this.mappingRepository = mappingRepository;
        this.propertyRepository = propertyRepository;
        this.photoRepository = photoRepository;
        this.channexClient = channexClient;
    }

    /**
     * @param code   identifiant stable du prerequis
     * @param ok     true si le prerequis auto est satisfait (toujours false pour manual)
     * @param manual true = a configurer cote Channex (non verifiable depuis Clenzy)
     * @param detail explication / action corrective
     */
    public record Check(String code, boolean ok, boolean manual, String detail) {}

    public record GoogleReadinessReport(boolean readyAutoChecks, List<Check> checks) {}

    public GoogleReadinessReport check(Long clenzyPropertyId, Long orgId) {
        ChannexPropertyMapping mapping = mappingRepository
            .findByClenzyPropertyId(clenzyPropertyId, orgId)
            .orElseThrow(() -> new IllegalStateException(
                "Aucun mapping Channex pour la propriete " + clenzyPropertyId));
        Property property = propertyRepository.findById(clenzyPropertyId)
            .orElseThrow(() -> new IllegalStateException(
                "Propriete introuvable : " + clenzyPropertyId));
        // findById contourne le filtre Hibernate : validation d'org explicite (audit n°3)
        if (!orgId.equals(property.getOrganizationId())) {
            throw new org.springframework.security.access.AccessDeniedException(
                "Propriete " + clenzyPropertyId + " hors de l'organisation " + orgId);
        }

        List<Check> checks = new ArrayList<>();

        // ── Auto : donnees Clenzy ──
        checks.add(present("country", property.getCountryCode() != null
            ? property.getCountryCode() : property.getCountry(), "Pays (code ISO)"));
        checks.add(present("address", property.getAddress(), "Adresse postale"));
        checks.add(present("city", property.getCity(), "Ville"));
        checks.add(present("zip_code", property.getPostalCode(), "Code postal"));
        checks.add(present("timezone", property.getTimezone(), "Timezone IANA"));
        checks.add(new Check("geo", property.getLatitude() != null && property.getLongitude() != null,
            false, property.getLatitude() != null && property.getLongitude() != null
                ? "Latitude/longitude renseignees"
                : "Latitude/longitude manquantes — requises pour le matching Google"));
        String ownerPhone = property.getOwner() != null ? property.getOwner().getPhoneNumber() : null;
        checks.add(present("phone", ownerPhone, "Telephone de contact (owner)"));
        checks.add(new Check("description",
            property.getDescription() != null && !property.getDescription().isBlank(),
            false, property.getDescription() != null && !property.getDescription().isBlank()
                ? "Description presente"
                : "Description marketing manquante"));

        // Photos : max(local, Channex) — les photos peuvent avoir ete poussees
        // (B4) ou chargees directement cote Channex.
        int localPhotos = photoRepository.findByPropertyIdOrderBySortOrderAsc(clenzyPropertyId).size();
        int channexPhotos = channexClient.fetchPhotosForProperty(mapping.getChannexPropertyId()).size();
        int photos = Math.max(localPhotos, channexPhotos);
        checks.add(new Check("photos_min_8", photos >= GOOGLE_VR_MIN_PHOTOS, false,
            photos + " photo(s) (local=" + localPhotos + ", Channex=" + channexPhotos + ") — "
                + "Google VR exige >= " + GOOGLE_VR_MIN_PHOTOS));

        // 1 room type par channel Google VR : structure Baitly = 1 appartement
        // = 1 property Channex a 1 room type → toujours satisfait.
        checks.add(new Check("single_room_type", true, false,
            "1 room type par channel Google VR (modele Baitly : 1 logement = 1 property)"));

        // ── Manual : settings du CHANNEL Google cote Channex ──
        checks.add(manual("channel_counts",
            "Renseigner bedrooms_count / bathrooms_count / beds_count dans les settings du channel Google (Channex)"));
        checks.add(manual("billing_type_vr",
            "Choisir le billing type \"Vacation Rental\" a la creation du channel Google (Channex)"));
        checks.add(manual("website_https",
            "Renseigner un site web https du logement/marque (requis Google VR)"));
        checks.add(manual("cancellation_policy",
            "Definir au moins une cancellation policy sur la property Channex"));
        checks.add(manual("facility",
            "Verifier qu'au moins une facility est associee a la property Channex (mapping amenities)"));

        boolean readyAuto = checks.stream().filter(c -> !c.manual()).allMatch(Check::ok);
        return new GoogleReadinessReport(readyAuto, checks);
    }

    private static Check present(String code, String value, String label) {
        boolean ok = value != null && !value.isBlank();
        return new Check(code, ok, false, ok ? label + " : OK" : label + " manquant(e)");
    }

    private static Check manual(String code, String detail) {
        return new Check(code, false, true, detail);
    }
}
