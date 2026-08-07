package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.dto.ChannexContentPushResult;
import com.clenzy.integration.channex.dto.ChannexPhotoDto;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyPhoto;
import com.clenzy.repository.PropertyPhotoRepository;
import com.clenzy.repository.PropertyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Phase B4 — push du contenu Clenzy → Channex. Jusqu'ici le contenu etait en
 * LECTURE SEULE (import OTA→Clenzy via resync-content) ; le sens PMS→Channex
 * n'existait pas.
 *
 * <p>Perimetre pousse :</p>
 * <ul>
 *   <li><b>description marketing</b> ({@code PUT /properties/:id} —
 *       content.description seul, jamais content.photos : une liste non vide
 *       REMPLACERAIT tout le set cote Channex) ;</li>
 *   <li><b>photos</b> ({@code POST /photos}) — Channex re-telecharge les photos
 *       pour les OTAs et exige des URLs https perennes. Resolution d'URL par
 *       photo : {@code external_url} (photos deja hebergees ailleurs, migration
 *       0126) sinon l'endpoint public STABLE du PMS
 *       ({@code {public-media-base-url}/api/public/property-photos/{propertyId}/{photoId}}
 *       — les octets restent en stockage interne BYTEA/S3, seule l'URL d'acces
 *       est publique ; la garde marketing est dans PublicPropertyPhotoService).
 *       Push ADDITIF et idempotent (diff par URL contre l'existant Channex —
 *       on ne supprime jamais les photos deja presentes/importees).</li>
 * </ul>
 *
 * <p><b>NON pousses</b>, pour deux raisons distinctes — signalees dans les notes
 * du resultat plutot que compensees par des valeurs inventees :</p>
 * <ul>
 *   <li><b>Hotel policies</b> : {@code POST /hotel_policies} exige
 *       {@code internet_access_type}, {@code parking_type},
 *       {@code parking_reservation}, {@code parking_is_private},
 *       {@code pets_policy}, {@code pets_non_refundable_fee},
 *       {@code pets_refundable_deposit} et {@code smoking_policy}. Baitly ne
 *       porte que {@code defaultCheckInTime} / {@code defaultCheckOutTime} et
 *       la capacite : creer la policy demanderait de fabriquer le reste.
 *       ({@code cancellationPolicy} ne va PAS la : Channex la porte sur le
 *       rate plan et les booking settings, pas sur la hotel policy.)</li>
 *   <li><b>Taxes / tax_sets</b> : le modele Baitly existe pourtant
 *       ({@code TouristTaxConfig}) et la correspondance est proche —
 *       {@code calculationMode} → {@code logic}
 *       ({@code per_person_per_night} / {@code percent}), {@code ratePerPerson}
 *       ou {@code percentageRate} → {@code rate}, {@code maxNights} →
 *       {@code max_nights}, surcharges departementale et regionale → taxes
 *       additionnelles du meme tax set, et Channex accepte litteralement
 *       {@code type: "city tax"}. Ce qui bloque est ailleurs :
 *       {@code capPerPersonNight}, {@code exemptMinors} et
 *       {@code childrenExemptUnder} n'ont AUCUN equivalent — Channex ignore
 *       l'exoneration par age. Une taxe poussee serait donc surestimee des
 *       qu'un sejour comporte des enfants, et pousser un montant faux vers un
 *       OTA est pire que ne rien pousser.</li>
 * </ul>
 *
 * <p>Piste si le sujet est repris : ne pousser que les configurations
 * exactement representables (ni plafond, ni exoneration) et signaler les
 * autres. Prealable a verifier aupres du support Channex : que les taxes
 * atteignent effectivement Airbnb et Booking.com — ni la doc Taxes ni la doc
 * Channel API ne l'affirment.</p>
 *
 * <p>Appels HTTP hors transaction (regle audit n°2) : ce service est
 * volontairement non transactionnel — lectures via repositories, puis appels
 * Channex best-effort comptabilises.</p>
 */
@Service
public class ChannexContentPushService {

    private static final Logger log = LoggerFactory.getLogger(ChannexContentPushService.class);

    private final ChannexClient channexClient;
    private final ChannexPropertyMappingRepository mappingRepository;
    private final PropertyRepository propertyRepository;
    private final PropertyPhotoRepository photoRepository;
    private final com.clenzy.integration.channex.config.ChannexProperties channexProperties;

    public ChannexContentPushService(ChannexClient channexClient,
                                     ChannexPropertyMappingRepository mappingRepository,
                                     PropertyRepository propertyRepository,
                                     PropertyPhotoRepository photoRepository,
                                     com.clenzy.integration.channex.config.ChannexProperties channexProperties) {
        this.channexClient = channexClient;
        this.mappingRepository = mappingRepository;
        this.propertyRepository = propertyRepository;
        this.photoRepository = photoRepository;
        this.channexProperties = channexProperties;
    }

    public ChannexContentPushResult pushContent(Long clenzyPropertyId, Long orgId) {
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

        List<String> notes = new ArrayList<>();

        // 1. Description marketing
        boolean descriptionPushed = pushDescription(mapping, property, notes);

        // 2. Photos (additif, idempotent par URL)
        int[] photoCounts = pushPhotos(mapping, notes); // [created, already, skipped, errors]

        notes.add("Conditions d'accueil et taxes de sejour non transmises : Baitly ne couvre pas "
            + "tous les champs exiges (stationnement, internet, animaux, tabac), et les regles "
            + "d'exoneration des enfants n'ont pas d'equivalent chez notre hub — une taxe "
            + "transmise serait surestimee. A renseigner depuis le hub si une plateforme l'exige.");

        ChannexContentPushResult result = new ChannexContentPushResult(
            descriptionPushed, photoCounts[0], photoCounts[1], photoCounts[2], photoCounts[3], notes);
        log.info("ChannexContentPush: property={} description={} photos(created={}, present={}, "
                + "skipped={}, errors={})", clenzyPropertyId, descriptionPushed,
            photoCounts[0], photoCounts[1], photoCounts[2], photoCounts[3]);
        return result;
    }

    private boolean pushDescription(ChannexPropertyMapping mapping, Property property,
                                    List<String> notes) {
        String description = property.getDescription();
        if (description == null || description.isBlank()) {
            notes.add("Description Clenzy vide : non poussee.");
            return false;
        }
        try {
            channexClient.updatePropertyDescription(mapping.getChannexPropertyId(), description.trim());
            return true;
        } catch (Exception e) {
            log.warn("ChannexContentPush: description KO property={}: {}",
                mapping.getClenzyPropertyId(), e.getMessage());
            notes.add("Echec du push de la description : " + e.getMessage());
            return false;
        }
    }

    private int[] pushPhotos(ChannexPropertyMapping mapping, List<String> notes) {
        List<PropertyPhoto> clenzyPhotos =
            photoRepository.findByPropertyIdOrderBySortOrderAsc(mapping.getClenzyPropertyId());
        if (clenzyPhotos.isEmpty()) {
            notes.add("Aucune photo Clenzy : rien a pousser.");
            return new int[]{0, 0, 0, 0};
        }

        // URLs deja presentes cote Channex (dont photos importees des OTAs) —
        // le push est additif : on ne supprime jamais l'existant.
        Set<String> existingUrls = new HashSet<>();
        for (ChannexPhotoDto photo : channexClient.fetchPhotosForProperty(mapping.getChannexPropertyId())) {
            if (photo.url() != null) existingUrls.add(photo.url());
        }

        int created = 0;
        int already = 0;
        int skipped = 0;
        int errors = 0;
        int position = 1;
        for (PropertyPhoto photo : clenzyPhotos) {
            String url = resolvePublicUrl(photo, mapping.getClenzyPropertyId());
            if (url == null) {
                // Pas d'external_url ET pas de public-media-base-url configuree :
                // aucune URL https perenne disponible pour cette photo.
                skipped++;
                position++;
                continue;
            }
            if (existingUrls.contains(url)) {
                already++;
                position++;
                continue;
            }
            try {
                channexClient.createPhoto(mapping.getChannexPropertyId(), url, position,
                    photo.getCaption());
                created++;
            } catch (Exception e) {
                log.warn("ChannexContentPush: photo KO url={} property={}: {}",
                    url, mapping.getClenzyPropertyId(), e.getMessage());
                errors++;
            }
            position++;
        }
        if (skipped > 0) {
            notes.add(skipped + " photo(s) sans URL https perenne : configurer "
                + "clenzy.channex.public-media-base-url (ex. https://app.clenzy.fr) "
                + "pour servir les photos internes via /api/public/property-photos.");
        }
        return new int[]{created, already, skipped, errors};
    }

    /**
     * URL https perenne d'une photo, par ordre de preference :
     * <ol>
     *   <li>{@code external_url} (photo deja hebergee publiquement — ex.
     *       importee d'un OTA, migration 0126) ;</li>
     *   <li>l'endpoint public STABLE du PMS (ids, pas de token expirable) —
     *       les octets restent dans le stockage interne, Channex ne fait que
     *       les re-telecharger via cette URL.</li>
     * </ol>
     * {@code null} si aucune des deux n'est disponible (base URL non configuree).
     */
    private String resolvePublicUrl(PropertyPhoto photo, Long clenzyPropertyId) {
        String external = photo.getExternalUrl();
        if (external != null && !external.isBlank() && external.startsWith("https://")) {
            return external;
        }
        String base = channexProperties.getPublicMediaBaseUrl();
        if (base == null || base.isBlank() || !base.startsWith("https://") || photo.getId() == null) {
            return null;
        }
        return base.replaceAll("/+$", "")
            + "/api/public/property-photos/" + clenzyPropertyId + "/" + photo.getId();
    }
}
