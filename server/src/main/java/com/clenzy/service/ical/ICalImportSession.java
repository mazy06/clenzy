package com.clenzy.service.ical;

import com.clenzy.dto.ICalImportDto.ImportRequest;
import com.clenzy.model.ICalFeed;
import com.clenzy.model.Property;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Etat mutable d'une passe d'import iCal : compteurs, erreurs et travaux differes
 * apres commit. Les SR sont auto-assignees en afterCommit car les services
 * {@code @Transactional} appeles (findAvailableTeamForProperty, notifications...)
 * peuvent marquer la transaction d'import rollback-only meme si l'exception est
 * avalee localement (UnexpectedRollbackException au commit sinon).
 *
 * <p>Partage entre l'orchestrateur ({@code ICalImportService}) et ses collaborateurs
 * ({@link ICalReservationImporter}, {@link ICalOrphanDetector},
 * {@link ICalCleaningScheduler}) — d'ou les champs publics : c'est un porteur d'etat
 * local a une passe d'import, jamais expose hors du package fonctionnel iCal.</p>
 */
public final class ICalImportSession {

    public final ImportRequest request;
    public final Property property;
    public final ICalFeed feed;
    public final Long orgId;
    public final String sourceKey;
    /**
     * Source OTA "deja payee" (regle alignee sur PanelFinancial / PaymentController) :
     * ces reservations sont reglees sur le canal externe -> auto-facturees a l'import
     * (pas via Stripe).
     */
    public final boolean otaPaidSource;
    public int imported;
    public int skipped;
    public int cancelled;
    /** Jours nouvellement bloques en calendrier depuis les blocages OTA du feed. */
    public int blocksApplied;
    /** Jours liberes : blocages de CE feed disparus du flux iCal. */
    public int blocksReleased;
    public final List<String> errors = new ArrayList<>();
    /** SR dont l'auto-assignation est differee jusqu'apres le commit. */
    public final List<Long> srsToAutoAssign = new ArrayList<>();
    /** Reservations OTA nouvellement creees, facturees apres le commit. */
    public final List<Long> reservationsToInvoice = new ArrayList<>();
    /**
     * UID presents dans le feed mais non parsables : proteges de la detection
     * d'orphelins (une date malformee ne doit pas annuler la reservation en base).
     */
    public final Set<String> unparsableUids = new HashSet<>();
    /**
     * Dedoublonnage par UID scope au feed (Z6-SECBUGS-06) : UID -> reservationId
     * pour les reservations de CE feed (ou sans feed : feed supprime puis recree,
     * FK ON DELETE SET NULL). Un meme UID porte par un AUTRE feed de la propriete
     * n'est pas un doublon — c'est une vraie reservation d'un autre canal.
     */
    public final Map<String, Long> knownUidToReservationId = new HashMap<>();
    /**
     * Dedoublonnage de REPLI pour les evenements iCal SANS UID (certains flux n'en
     * fournissent pas) : sans cle stable, chaque re-import dupliquerait la
     * reservation et son menage, orphelinant le lien intervention<->reservation.
     * Cle = checkIn + "_" + checkOut (scope au feed, comme la map UID).
     */
    public final Map<String, Long> knownDateKeyToReservationId = new HashMap<>();
    /**
     * Compteur local pour les noms generiques (ex: "Reserved" -> #1, #2, #3...).
     * Cle = propertyId + "_" + nomGenerique (lowercase).
     */
    public final Map<String, Long> guestNameCounters = new HashMap<>();

    public ICalImportSession(ImportRequest request, Property property, ICalFeed feed, Long orgId, String sourceKey) {
        this.request = request;
        this.property = property;
        this.feed = feed;
        this.orgId = orgId;
        this.sourceKey = sourceKey;
        this.otaPaidSource = "airbnb".equals(sourceKey)
                || "booking".equals(sourceKey) || "other".equals(sourceKey);
    }
}
