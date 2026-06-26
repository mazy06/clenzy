package com.clenzy.service;

import com.clenzy.dto.GuestDeclarationRequest;
import com.clenzy.dto.WelcomeGuidePublicDto.DataCollectionInfo;
import com.clenzy.model.DeclarationStatus;
import com.clenzy.model.Guest;
import com.clenzy.model.GuestDeclaration;
import com.clenzy.model.Property;
import com.clenzy.model.RegulatoryConfig.RegulatoryType;
import com.clenzy.model.Reservation;
import com.clenzy.repository.GuestDeclarationRepository;
import com.clenzy.repository.RegulatoryConfigRepository;
import com.clenzy.repository.ReservationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * Fiche de police / declaration voyageur : calcul de complétude + soumission.
 *
 * <p>Entite DEDIEE {@link GuestDeclaration} (≠ {@code OnlineCheckIn}). Le « gating » du livret se
 * fait uniquement si le service est <b>activé</b> ({@code RegulatoryConfig} POLICE_FORM
 * {@code isEnabled} pour la propriété de la réservation) <b>ET</b> que des données manquent. Si tout
 * est déjà connu (réservation / guest / check-in en ligne), rien n'est demandé.</p>
 *
 * <p><b>Org et réservation résolus SERVEUR</b> (jamais depuis le client) : l'unique entrée publique
 * part du token du livret ({@code WelcomeGuideToken}) qui borne la réservation — le token EST la clé
 * d'autorisation (endpoints {@code /api/public/**}, hors {@code TenantFilter}). Aucun id de
 * réservation ni d'organisation n'est accepté du client : ils sont dérivés de la réservation
 * résolue. L'{@code organizationId} de la déclaration est imposé depuis la réservation.</p>
 */
@Service
@Transactional(readOnly = true)
public class GuestDeclarationService {

    private static final Logger log = LoggerFactory.getLogger(GuestDeclarationService.class);

    /** Champs requis pour une fiche de police (en plus de l'identité prénom/nom). */
    static final String F_FIRST_NAME = "firstName";
    static final String F_LAST_NAME = "lastName";
    static final String F_BIRTH_DATE = "birthDate";
    static final String F_BIRTH_PLACE = "birthPlace";
    static final String F_NATIONALITY = "nationality";
    static final String F_RESIDENCE_ADDRESS = "residenceAddress";
    static final String F_ID_DOCUMENT_TYPE = "idDocumentType";
    static final String F_ID_DOCUMENT_NUMBER = "idDocumentNumber";

    private final GuestDeclarationRepository declarationRepository;
    private final ReservationRepository reservationRepository;
    private final RegulatoryConfigRepository regulatoryConfigRepository;
    private final OnlineCheckInService onlineCheckInService;

    public GuestDeclarationService(GuestDeclarationRepository declarationRepository,
                                   ReservationRepository reservationRepository,
                                   RegulatoryConfigRepository regulatoryConfigRepository,
                                   OnlineCheckInService onlineCheckInService) {
        this.declarationRepository = declarationRepository;
        this.reservationRepository = reservationRepository;
        this.regulatoryConfigRepository = regulatoryConfigRepository;
        this.onlineCheckInService = onlineCheckInService;
    }

    /**
     * Calcule l'état de la collecte de données réglementaire pour une réservation.
     *
     * <p>{@code required = policeFormRequired && !complete}. La déclaration est {@code complete} si
     * elle n'est pas requise OU si aucun champ ne manque ET qu'une déclaration principale
     * {@code COMPLETED} existe. Sans service activé → {@code required=false, complete=true} : on ne
     * demande rien.</p>
     *
     * @param reservationId réservation cible (résolue serveur depuis le token du livret)
     * @return état pour le payload livret ; {@code complete} si la réservation est introuvable
     */
    public DataCollectionInfo computeRequirements(Long reservationId) {
        Reservation reservation = reservationRepository.findById(reservationId).orElse(null);
        if (reservation == null) {
            return new DataCollectionInfo(false, true, List.of());
        }

        boolean policeFormRequired = isPoliceFormEnabled(reservation);
        if (!policeFormRequired) {
            return new DataCollectionInfo(false, true, List.of());
        }

        List<String> missing = computeMissingFields(reservation);
        boolean hasCompletedPrimary = declarationRepository
            .findByReservationIdOrderByIdAsc(reservationId).stream()
            .anyMatch(d -> d.isPrimary() && d.getStatus() == DeclarationStatus.COMPLETED);

        boolean complete = missing.isEmpty() && hasCompletedPrimary;
        // Requis seulement si le service est activé ET la collecte n'est pas encore complète.
        return new DataCollectionInfo(!complete, complete, missing);
    }

    /**
     * Crée / met à jour les déclarations d'une réservation (principal + accompagnants) à partir du
     * payload public, recalcule le statut, et renvoie l'état recalculé.
     *
     * <p>Org et réservation résolus serveur depuis {@code reservationId} (issu du token). Le premier
     * déclarant est le voyageur principal. <b>Aucun appel externe</b> (la soumission au provider
     * n'est pas implémentée). Stratégie de mise à jour idempotente : on remplace les déclarations
     * existantes de la réservation par celles du payload (une déclaration par voyageur).</p>
     */
    @Transactional
    public DataCollectionInfo submitDeclaration(Long reservationId, GuestDeclarationRequest request) {
        Reservation reservation = reservationRepository.findById(reservationId)
            .orElseThrow(() -> new IllegalArgumentException("Réservation introuvable: " + reservationId));

        if (request == null || request.declarants() == null || request.declarants().isEmpty()) {
            throw new IllegalArgumentException("Au moins un voyageur doit être déclaré");
        }

        Long orgId = reservation.getOrganizationId();
        String countryCode = reservation.getProperty() != null
            ? reservation.getProperty().getCountryCode() : null;

        // Remplace l'ensemble des déclarations de la réservation (idempotent : re-soumission = nouvel état).
        List<GuestDeclaration> existing = declarationRepository.findByReservationIdOrderByIdAsc(reservationId);
        if (!existing.isEmpty()) {
            declarationRepository.deleteAllInBatch(existing);
        }

        Guest primaryGuest = reservation.getGuest();
        List<GuestDeclaration> toSave = new ArrayList<>();
        List<GuestDeclarationRequest.Declarant> declarants = request.declarants();
        for (int i = 0; i < declarants.size(); i++) {
            boolean isPrimary = (i == 0);
            GuestDeclaration declaration = toEntity(
                declarants.get(i), reservation, orgId, countryCode, isPrimary,
                isPrimary ? primaryGuest : null);
            toSave.add(declaration);
        }
        declarationRepository.saveAll(toSave);

        log.info("Déclaration voyageur soumise pour réservation {} ({} déclarant(s)).",
            reservationId, toSave.size());

        return computeRequirements(reservationId);
    }

    // --- Helpers privés ---

    private boolean isPoliceFormEnabled(Reservation reservation) {
        Property property = reservation.getProperty();
        if (property == null || property.getId() == null) {
            return false;
        }
        return regulatoryConfigRepository
            .findByPropertyAndType(property.getId(), RegulatoryType.POLICE_FORM, reservation.getOrganizationId())
            .map(c -> Boolean.TRUE.equals(c.getIsEnabled()))
            .orElse(false);
    }

    /**
     * Champs requis non encore connus. Sources de données connues : la déclaration principale
     * existante (si déjà saisie), puis repli sur le {@link Guest} de la réservation (prénom/nom) et
     * sur le check-in en ligne (type + numéro de document d'identité).
     */
    private List<String> computeMissingFields(Reservation reservation) {
        GuestDeclaration primary = declarationRepository
            .findByReservationIdOrderByIdAsc(reservation.getId()).stream()
            .filter(GuestDeclaration::isPrimary)
            .findFirst()
            .orElse(null);

        Guest guest = reservation.getGuest();
        var checkIn = onlineCheckInService.getByReservation(reservation.getId(), reservation.getOrganizationId());

        List<String> missing = new ArrayList<>();
        addIfMissing(missing, F_FIRST_NAME, firstNonBlank(
            primary != null ? primary.getFirstName() : null,
            guest != null ? guest.getFirstName() : null,
            checkIn.map(c -> c.getFirstName()).orElse(null)));
        addIfMissing(missing, F_LAST_NAME, firstNonBlank(
            primary != null ? primary.getLastName() : null,
            guest != null ? guest.getLastName() : null,
            checkIn.map(c -> c.getLastName()).orElse(null)));
        addIfMissing(missing, F_BIRTH_DATE, primary != null ? primary.getBirthDate() : null);
        addIfMissing(missing, F_BIRTH_PLACE, primary != null ? primary.getBirthPlace() : null);
        addIfMissing(missing, F_NATIONALITY, primary != null ? primary.getNationality() : null);
        addIfMissing(missing, F_RESIDENCE_ADDRESS, primary != null ? primary.getResidenceAddress() : null);
        addIfMissing(missing, F_ID_DOCUMENT_TYPE, firstNonBlank(
            primary != null ? primary.getIdDocumentType() : null,
            checkIn.map(c -> c.getIdDocumentType()).orElse(null)));
        addIfMissing(missing, F_ID_DOCUMENT_NUMBER, firstNonBlank(
            primary != null ? primary.getIdDocumentNumber() : null,
            checkIn.map(c -> c.getIdDocumentNumber()).orElse(null)));
        return missing;
    }

    private GuestDeclaration toEntity(GuestDeclarationRequest.Declarant src, Reservation reservation,
                                      Long orgId, String countryCode, boolean isPrimary, Guest guest) {
        GuestDeclaration d = new GuestDeclaration();
        d.setOrganizationId(orgId);
        d.setReservation(reservation);
        d.setGuest(guest);
        d.setPrimary(isPrimary);
        d.setCountryCode(countryCode);
        d.setFirstName(src.firstName());
        d.setLastName(src.lastName());
        d.setMaidenName(src.maidenName());
        d.setBirthDate(src.birthDate());
        d.setBirthPlace(src.birthPlace());
        d.setNationality(src.nationality());
        d.setResidenceAddress(src.residenceAddress());
        d.setResidenceCountry(src.residenceCountry());
        d.setIdDocumentType(src.idDocumentType());
        d.setIdDocumentNumber(src.idDocumentNumber());
        d.setStatus(isComplete(src, isPrimary) ? DeclarationStatus.COMPLETED : DeclarationStatus.PENDING);
        return d;
    }

    /**
     * Une déclaration est complète quand tous les champs requis sont renseignés. Pour un accompagnant,
     * l'adresse de résidence n'est pas exigée (rattachée au foyer du voyageur principal).
     */
    private boolean isComplete(GuestDeclarationRequest.Declarant src, boolean isPrimary) {
        boolean core = isNotBlank(src.firstName()) && isNotBlank(src.lastName())
            && isNotBlank(src.birthDate()) && isNotBlank(src.birthPlace())
            && isNotBlank(src.nationality())
            && isNotBlank(src.idDocumentType()) && isNotBlank(src.idDocumentNumber());
        return core && (!isPrimary || isNotBlank(src.residenceAddress()));
    }

    private static void addIfMissing(List<String> missing, String field, String value) {
        if (!isNotBlank(value)) {
            missing.add(field);
        }
    }

    private static boolean isNotBlank(String s) {
        return s != null && !s.isBlank();
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (isNotBlank(v)) {
                return v;
            }
        }
        return null;
    }
}
