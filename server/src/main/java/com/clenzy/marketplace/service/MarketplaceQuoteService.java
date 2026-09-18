package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.MarketplaceProvider;
import com.clenzy.marketplace.model.MarketplaceQuoteRequest;
import com.clenzy.marketplace.model.QuoteRequestStatus;
import com.clenzy.marketplace.repository.MarketplaceProviderRepository;
import com.clenzy.marketplace.repository.MarketplaceQuoteRequestRepository;
import com.clenzy.repository.PropertyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

/**
 * Demandes de devis : le seul pont entre une organisation et un prestataire.
 *
 * <h2>Le controle d'acces est explicite, des deux cotes</h2>
 * <p>La table est PLATEFORME — elle relie deux organisations, aucun filtre
 * tenant ne peut la borner. Chaque methode verifie donc elle-meme de quel cote
 * se trouve l'appelant : {@code assertCanDecide} pour les décisions du demandeur,
 * {@code requireProvider} pour le prestataire. Omettre ce controle rendrait
 * chaque demande lisible par n'importe quelle organisation, a partir d'un simple
 * identifiant (regle n°3 de l'audit).</p>
 *
 * <h2>Les transitions sont conditionnelles</h2>
 * <p>Chiffrer, accepter, refuser passent par un UPDATE borne par le statut
 * attendu, jamais par un verifier-puis-agir. Un double clic sur « Accepter »
 * creerait sinon deux interventions, et deux envois concurrents de devis
 * ecraseraient le premier.</p>
 */
@Service
public class MarketplaceQuoteService {

    private static final Logger log = LoggerFactory.getLogger(MarketplaceQuoteService.class);

    /** Au-dela, une page non bornee laisserait un appel sortir tout l'historique. */
    private static final int MAX_PAGE_SIZE = 100;

    private final MarketplaceQuoteRequestRepository quoteRepository;
    private final MarketplaceProviderRepository providerRepository;
    private final MarketplaceExposureService exposureService;
    private final PropertyRepository propertyRepository;
    private final Clock clock;
    private final MarketplaceGeographicEligibility geography;
    private final com.clenzy.repository.TeamRepository teams;
    private final com.clenzy.service.ServiceQuoteService commercialQuotes;
    private final MarketplaceQuoteMissionFactory missions;

    public MarketplaceQuoteService(MarketplaceQuoteRequestRepository quoteRepository,
                                   MarketplaceProviderRepository providerRepository,
                                   MarketplaceExposureService exposureService,
                                   PropertyRepository propertyRepository,
                                   Clock clock, com.clenzy.repository.TeamRepository teams,
                                   com.clenzy.service.ServiceQuoteService commercialQuotes,
                                   MarketplaceQuoteMissionFactory missions, MarketplaceGeographicEligibility geography) {
        this.geography = geography;
        this.missions = missions;
        this.commercialQuotes = commercialQuotes;
        this.teams = teams;
        this.quoteRepository = quoteRepository;
        this.providerRepository = providerRepository;
        this.exposureService = exposureService;
        this.propertyRepository = propertyRepository;
        this.clock = clock;
    }

    /** Levee lorsqu'une transition arrive trop tard : l'appelant la traduit en 409. */
    public static class QuoteAlreadySettledException extends RuntimeException {
        public QuoteAlreadySettledException() {
            super("Cette demande a déjà été traitée entre-temps. Rechargez la page.");
        }
    }

    // ─── Cote demandeur ──────────────────────────────────────────────────────

    /**
     * Une organisation sollicite un prestataire.
     *
     * <p>La visibilite est re-verifiee ici, et pas seulement a l'affichage :
     * l'identifiant d'une fiche masquee, devine ou garde d'une page ouverte
     * avant qu'une regle ne la ferme, ne doit pas suffire a la joindre.</p>
     */
    @Transactional
    public MarketplaceQuoteRequest request(Long providerId, Long organizationId, Long userId,
                                           String title, String message, Long propertyId,
                                           String categoryCode, String serviceItemCode,
                                           LocalDate desiredDate) {
        return requestForNeed(providerId,organizationId,userId,title,message,propertyId,categoryCode,serviceItemCode,desiredDate,null);
    }

    @Transactional
    public MarketplaceQuoteRequest requestForNeed(Long providerId, Long organizationId, Long userId,
                                           String title, String message, Long propertyId,
                                           String categoryCode, String serviceItemCode,
                                           LocalDate desiredDate, Long serviceRequestId) {
        if (organizationId == null) {
            throw new AccessDeniedException("Organisation non résolue");
        }
        String cleanedTitle = MarketplaceQuoteText.optional(title, 150, "Titre");
        if (cleanedTitle == null) {
            throw new IllegalArgumentException("Indiquez ce que vous demandez.");
        }
        String cleanedMessage = MarketplaceQuoteText.optional(message, 4000, "Message");
        String cleanedCategory = MarketplaceQuoteText.optional(categoryCode, 40, "Métier");
        String cleanedItem = MarketplaceQuoteText.optional(serviceItemCode, 60, "Prestation");

        MarketplaceProvider provider = providerRepository.findById(providerId)
            .orElseThrow(() -> new IllegalArgumentException("Prestataire introuvable"));
        if (!exposureService.isVisibleTo(provider, organizationId)) {
            // Message identique a « introuvable » : distinguer les deux dirait
            // qu'une fiche existe mais est fermee, et permettrait de cartographier
            // le catalogue cache.
            throw new IllegalArgumentException("Prestataire introuvable");
        }
        if (organizationId.equals(provider.getHomeOrganizationId())) {
            throw new IllegalArgumentException(
                "Ce prestataire est le vôtre : proposez-lui une demande de service.");
        }

        // Le logement doit appartenir a l'organisation qui demande. Sans ce
        // controle, un identifiant devine rattacherait la demande — et plus tard
        // l'intervention — au logement d'une autre organisation. C'est la regle
        // n°3 de l'audit : tout chargement par identifiant valide l'org.
        if (propertyId != null
            && propertyRepository.findByIdWithOwner(propertyId, organizationId).isEmpty()) {
            throw new IllegalArgumentException("Logement introuvable");
        }
        geography.requireServiceCoverage(providerId, propertyId, organizationId, cleanedItem);
        String requestedCategory = MarketplaceOfferEligibility.requireOfferedService(provider, cleanedCategory, cleanedItem);

        var request = new MarketplaceQuoteRequest();
        request.setServiceRequestId(serviceRequestId);
        request.setProviderId(providerId);
        if (provider.getUserId() != null) {
            var memberships = teams.findRealTeamsForMember(provider.getUserId());
            if (memberships.size() == 1) request.setProviderTeamId(memberships.getFirst().getId());
        }
        request.setRequesterOrganizationId(organizationId);
        request.setRequestedByUserId(userId);
        request.setPropertyId(propertyId);
        request.setCategoryCode(requestedCategory);
        request.setServiceItemCode(cleanedItem);
        request.setTitle(cleanedTitle);
        request.setMessage(cleanedMessage);
        request.setDesiredDate(desiredDate);
        request.setStatus(QuoteRequestStatus.SENT);
        LocalDateTime now = LocalDateTime.now(clock);
        request.setCreatedAt(now);
        request.setUpdatedAt(now);

        var saved = quoteRepository.save(request);
        missions.prepareNeed(saved);
        log.info("Demande de devis {} : organisation {} vers fiche {}",
            saved.getId(), organizationId, providerId);
        return saved;
    }

    @Transactional(readOnly = true)
    public Page<MarketplaceQuoteRequest> listForRequester(Long organizationId,
                                                          List<QuoteRequestStatus> statuses,
                                                          int page, int size) {
        var pageable = PageRequest.of(Math.max(0, page), clampSize(size));
        return statuses == null || statuses.isEmpty()
            ? quoteRepository.findByRequesterOrganizationIdOrderByCreatedAtDesc(organizationId, pageable)
            : quoteRepository.findByRequesterOrganizationIdAndStatusInOrderByCreatedAtDesc(
                organizationId, statuses, pageable);
    }

    @Transactional(readOnly = true)
    public Page<MarketplaceQuoteRequest> listForRequester(Long organizationId, List<QuoteRequestStatus> statuses,
            int page, int size, org.springframework.security.oauth2.jwt.Jwt jwt, Long userId) {
        if (jwt == null || userId == null) throw new AccessDeniedException("Compte non résolu");
        var role = com.clenzy.util.JwtRoleExtractor.extractUserRole(jwt);
        return quoteRepository.findAccessibleForRequester(organizationId, userId, jwt.getSubject(),
            role != null && role.isPlatformStaff(),
            (statuses == null || statuses.isEmpty() ? List.of(QuoteRequestStatus.values()) : statuses).stream().map(Enum::name).toList(),
            PageRequest.of(Math.max(0, page), clampSize(size)));
    }

    @Transactional(readOnly = true)
    public MarketplaceQuoteRequest getFor(Long quoteId, Long organizationId, Long providerId, Long viewerUserId,
            org.springframework.security.oauth2.jwt.Jwt jwt) {
        var quote = getFor(quoteId, organizationId, providerId, viewerUserId);
        // Le chemin prestataire est déjà borné par sa fiche et son équipe.
        boolean providerSide = providerId != null && providerId.equals(quote.getProviderId())
            && (quote.getProviderTeamId() == null || providerTeamIds(providerId).contains(quote.getProviderTeamId()));
        boolean teamSide = viewerUserId != null && quote.getProviderTeamId() != null
            && teams.findRealTeamsForMember(viewerUserId).stream().anyMatch(t -> quote.getProviderTeamId().equals(t.getId()));
        if (!providerSide && !teamSide) missions.assertCanDecide(quote, organizationId, jwt);
        return quote;
    }

    /** Le demandeur retire sa demande, tant que rien n'a ete chiffre. */
    @Transactional
    public MarketplaceQuoteRequest withdraw(Long quoteId, Long organizationId, String reason,
            org.springframework.security.oauth2.jwt.Jwt jwt) {
        var request = missions.lock(quoteId, organizationId);
        missions.assertCanDecide(request, organizationId, jwt);
        String cleanedReason = MarketplaceQuoteText.optional(reason, 500, "Motif");

        int updated = quoteRepository.closeIfStillSent(quoteId,
            QuoteRequestStatus.WITHDRAWN, cleanedReason, LocalDateTime.now(clock));
        if (updated == 0) {
            throw new QuoteAlreadySettledException();
        }
        missions.closePreparedNeed(quoteId);
        return quoteRepository.findById(quoteId).orElseThrow();
    }

    // ─── Cote prestataire ────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<MarketplaceQuoteRequest> listForProvider(Long providerId,
                                                          List<QuoteRequestStatus> statuses,
                                                          int page, int size) {
        var pageable = PageRequest.of(Math.max(0, page), clampSize(size));
        return quoteRepository.findAccessibleForProvider(providerId, providerTeamIds(providerId),
            statuses == null || statuses.isEmpty() ? List.of(QuoteRequestStatus.values()) : statuses, pageable);
    }

    @Transactional(readOnly = true)
    public long countPendingForProvider(Long providerId) {
        return quoteRepository.countAccessibleForProvider(providerId, providerTeamIds(providerId), QuoteRequestStatus.SENT);
    }

    /**
     * Le prestataire chiffre.
     *
     * <p>Le montant vient d'ICI et de nulle part ailleurs : aucune valeur
     * envoyee par le demandeur ne l'alimente.</p>
     */
    @Transactional
    public MarketplaceQuoteRequest quote(Long quoteId, Long providerId, BigDecimal amount,
                                         String currency, String message, LocalDate validUntil) {
        return quote(quoteId, providerId, amount, currency, message, validUntil, null);
    }

    @Transactional
    public MarketplaceQuoteRequest quote(Long quoteId, Long providerId, BigDecimal amount,
                                         String currency, String message, LocalDate validUntil, Long teamId) {
        var request = requireProvider(quoteId, providerId);
        BigDecimal normalizedAmount = normalizeAmount(amount);
        String normalizedCurrency = normalizeCurrency(currency);
        String cleanedMessage = MarketplaceQuoteText.optional(message, 4000, "Message");
        LocalDate today = LocalDate.now(clock);
        if (validUntil != null && validUntil.isBefore(today)) {
            throw new IllegalArgumentException(
                "La date de validité est déjà passée : le devis serait périmé à l'envoi.");
        }
        if (request.getCategoryCode() != null || request.getServiceItemCode() != null) {
            var provider = providerRepository.findById(providerId)
                .orElseThrow(() -> new IllegalArgumentException("Prestataire introuvable"));
            MarketplaceOfferEligibility.requireOfferedService(provider, request.getCategoryCode(), request.getServiceItemCode());
        }
        geography.requireService(request.getProviderId(), request.getPropertyId(), request.getRequesterOrganizationId(), request.getCategoryCode(), request.getServiceItemCode(), request.getDesiredDate());
        Long effectiveTeamId = teamId != null ? teamId : request.getProviderTeamId();
        if (effectiveTeamId != null && teamOptions(quoteId, providerId).stream()
                .noneMatch(team -> effectiveTeamId.equals(team.getId())))
            throw new AccessDeniedException("Vous ne représentez plus cette équipe");
        if (teamId != null && !teamId.equals(request.getProviderTeamId())) {
            if (request.getProviderTeamId() != null) throw new IllegalStateException("Cette négociation appartient déjà à une équipe");
            if (quoteRepository.selectTeam(quoteId, providerId, teamId) != 1) throw new QuoteAlreadySettledException();
        }

        int updated = quoteRepository.quoteIfStillOpen(quoteId, providerId, normalizedAmount,
            normalizedCurrency, cleanedMessage, validUntil, LocalDateTime.now(clock));
        if (updated == 0) {
            throw new QuoteAlreadySettledException();
        }
        log.info("Devis {} chiffre par la fiche {}", quoteId, providerId);
        var quoted = quoteRepository.findById(quoteId).orElseThrow();
        commercialQuotes.ensureMarketplaceQuote(quoted);
        return quoted;
    }

    @Transactional(readOnly = true)
    public List<com.clenzy.model.Team> teamOptions(Long quoteId, Long providerId) {
        requireProvider(quoteId, providerId);
        var provider = providerRepository.findById(providerId).orElseThrow();
        return provider.getUserId() == null ? List.of() : teams.findRealTeamsForMember(provider.getUserId());
    }

    /** Le prestataire ne donne pas suite. */
    @Transactional
    public MarketplaceQuoteRequest turnDown(Long quoteId, Long providerId, String reason) {
        requireProvider(quoteId, providerId);
        String cleanedReason = MarketplaceQuoteText.optional(reason, 500, "Motif");

        int updated = quoteRepository.closeIfStillSent(quoteId,
            QuoteRequestStatus.TURNED_DOWN, cleanedReason, LocalDateTime.now(clock));
        if (updated == 0) {
            throw new QuoteAlreadySettledException();
        }
        missions.closePreparedNeed(quoteId);
        return quoteRepository.findById(quoteId).orElseThrow();
    }

    // ─── Lecture d'une demande, par l'un ou l'autre ──────────────────────────

    /**
     * Une demande, vue par un cote ou par l'autre.
     *
     * <p>{@code findById} ne passe par aucun filtre : sans ce controle, un
     * identifiant devine donnerait la demande d'une organisation tierce.</p>
     */
    @Transactional(readOnly = true)
    public MarketplaceQuoteRequest getFor(Long quoteId, Long organizationId, Long providerId) {
        return getFor(quoteId, organizationId, providerId, null);
    }

    @Transactional(readOnly = true)
    public MarketplaceQuoteRequest getFor(Long quoteId, Long organizationId, Long providerId, Long viewerUserId) {
        MarketplaceQuoteRequest quote = quoteRepository.findById(quoteId)
            .orElseThrow(() -> new IllegalArgumentException("Demande introuvable"));
        boolean isRequester = organizationId != null
            && organizationId.equals(quote.getRequesterOrganizationId());
        boolean isProvider = providerId != null && providerId.equals(quote.getProviderId());
        boolean isTeamMember = false;
        if (quote.getProviderTeamId() != null && !isRequester) {
            var teamIds = viewerUserId != null
                ? teams.findRealTeamsForMember(viewerUserId).stream().map(com.clenzy.model.Team::getId).toList()
                : isProvider ? providerTeamIds(providerId) : List.<Long>of();
            isTeamMember = teamIds.contains(quote.getProviderTeamId());
            isProvider = false; // La fiche individuelle ne contourne jamais le périmètre de l'équipe.
        }
        if (!isRequester && !isProvider && !isTeamMember) {
            throw new AccessDeniedException("Cette demande ne vous concerne pas");
        }
        return quote;
    }

    // ─── Rouages ─────────────────────────────────────────────────────────────

    private MarketplaceQuoteRequest requireProvider(Long quoteId, Long providerId) {
        MarketplaceQuoteRequest quote = quoteRepository.findById(quoteId)
            .orElseThrow(() -> new IllegalArgumentException("Demande introuvable"));
        if (providerId == null || !providerId.equals(quote.getProviderId())) {
            throw new AccessDeniedException("Cette demande ne vous concerne pas");
        }
        if (quote.getProviderTeamId() != null && !providerTeamIds(providerId).contains(quote.getProviderTeamId())) {
            throw new AccessDeniedException("Vous ne représentez plus cette équipe");
        }
        return quote;
    }

    private List<Long> providerTeamIds(Long providerId) {
        var provider = providerRepository.findById(providerId)
            .orElseThrow(() -> new AccessDeniedException("Prestataire introuvable"));
        return provider.getUserId() == null ? List.of()
            : teams.findRealTeamsForMember(provider.getUserId()).stream().map(com.clenzy.model.Team::getId).toList();
    }

    private static int clampSize(int size) {
        return Math.min(Math.max(1, size), MAX_PAGE_SIZE);
    }

    private static String normalizeCurrency(String currency) {
        String cleaned = trimToNull(currency);
        if (cleaned == null) return "EUR";
        String code = cleaned.toUpperCase(Locale.ROOT);
        try {
            if (!code.matches("[A-Z]{3}") || java.util.Currency.getInstance(code).getDefaultFractionDigits() < 0) {
                throw new IllegalArgumentException("Code monétaire non utilisable");
            }
        } catch (IllegalArgumentException error) {
            throw new IllegalArgumentException("Indiquez une devise monétaire valide à trois lettres.", error);
        }
        return code;
    }

    /** Respecte le montant proposé et la colonne NUMERIC(12,2), sans arrondi implicite. */
    private static BigDecimal normalizeAmount(BigDecimal amount) {
        if (amount == null || amount.signum() <= 0) {
            throw new IllegalArgumentException("Indiquez un montant supérieur à zéro.");
        }
        // Tester la borne avant setScale évite également une expansion démesurée d'un exposant.
        if (amount.compareTo(new BigDecimal("9999999999.99")) > 0) {
            throw new IllegalArgumentException("Le montant dépasse la limite autorisée pour un devis.");
        }
        BigDecimal exact = amount.stripTrailingZeros();
        if (exact.scale() > 2) {
            throw new IllegalArgumentException("Le montant doit avoir au plus deux décimales, sans arrondi.");
        }
        try {
            return exact.setScale(2, java.math.RoundingMode.UNNECESSARY);
        } catch (ArithmeticException error) {
            throw new IllegalArgumentException("Le montant doit avoir au plus deux décimales, sans arrondi.", error);
        }
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
