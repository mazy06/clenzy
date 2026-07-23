package com.clenzy.integration.compliance.submission;

import com.clenzy.integration.compliance.model.ComplianceConnection;
import com.clenzy.integration.compliance.model.ComplianceProviderType;
import com.clenzy.integration.compliance.service.ComplianceConnectionService;
import com.clenzy.model.DeclarationStatus;
import com.clenzy.model.GuestDeclaration;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.GuestDeclarationRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Orchestrateur de soumission des fiches de police au provider de conformité applicable.
 *
 * <h2>Flux (conforme aux règles audit)</h2>
 * <ol>
 *   <li><b>Transaction courte (read)</b> : charger la déclaration, résoudre le provider
 *       applicable (pays de la propriété) + la connexion ACTIVE de l'org, déchiffrer la clé.</li>
 *   <li><b>Hors transaction DB</b> : appeler la stratégie (appel HTTP externe).</li>
 *   <li><b>Nouvelle transaction</b> : matérialiser le résultat — succès → SUBMITTED + traçabilité ;
 *       échec → statut inchangé + trace explicite (jamais avalé).</li>
 * </ol>
 *
 * <p><b>Idempotent</b> : une déclaration déjà {@code SUBMITTED} est ignorée (no-op). Sans
 * connexion ACTIVE → skip explicite (raison loggée), pas une erreur.</p>
 *
 * <p><b>Auto-invocation @Transactional</b> : l'écriture post-appel passe par {@code self}
 * ({@link ObjectProvider}) pour traverser le proxy Spring (audit règle #6).</p>
 */
@Service
public class ComplianceSubmissionService {

    private static final Logger log = LoggerFactory.getLogger(ComplianceSubmissionService.class);

    private final GuestDeclarationRepository declarationRepository;
    private final ComplianceConnectionService connectionService;
    private final ComplianceSubmissionStrategyRegistry strategyRegistry;
    private final OrganizationAccessGuard accessGuard;
    private final ObjectProvider<ComplianceSubmissionService> self;

    public ComplianceSubmissionService(GuestDeclarationRepository declarationRepository,
                                       ComplianceConnectionService connectionService,
                                       ComplianceSubmissionStrategyRegistry strategyRegistry,
                                       OrganizationAccessGuard accessGuard,
                                       ObjectProvider<ComplianceSubmissionService> self) {
        this.declarationRepository = declarationRepository;
        this.connectionService = connectionService;
        this.strategyRegistry = strategyRegistry;
        this.accessGuard = accessGuard;
        this.self = self;
    }

    /**
     * Soumet toutes les déclarations COMPLETED (et pas encore SUBMITTED) d'une réservation.
     * Utilisé par le déclenchement automatique (post-commit du {@code submitDeclaration}).
     *
     * @param reservationId réservation cible
     * @param orgId         organisation de référence (résolue serveur depuis la réservation)
     */
    public void submitForReservation(Long reservationId, Long orgId) {
        List<GuestDeclaration> declarations = declarationRepository.findByReservationIdOrderByIdAsc(reservationId);
        for (GuestDeclaration declaration : declarations) {
            if (declaration.getStatus() == DeclarationStatus.COMPLETED) {
                try {
                    submitOne(declaration, orgId);
                } catch (ComplianceProviderPendingException e) {
                    // Provider gouvernemental non intégrable : tracé, on passe aux autres déclarations.
                    log.warn("Soumission compliance en attente (déclaration {} provider {}): {}",
                            declaration.getId(), e.getProvider(), e.getMessage());
                }
            }
        }
    }

    /**
     * Liste (sans PII) les fiches de police d'une réservation, pour l'affichage du
     * statut de soumission côté host. <b>Valide l'ownership org</b> de chaque déclaration
     * ({@code findByReservationId...} ne traverse pas le filtre Hibernate via le retour
     * lazy {@code reservation}, donc on garde la garde explicite par déclaration).
     *
     * <p>Aucun champ d'identité n'est exposé : seul un {@link DeclarationSummaryDto} générique.</p>
     *
     * @param reservationId réservation cible
     * @return déclarations (principal d'abord) mappées sans PII ; liste vide si aucune
     */
    @Transactional(readOnly = true)
    public List<DeclarationSummaryDto> listForReservation(Long reservationId) {
        List<GuestDeclaration> declarations = declarationRepository.findByReservationIdOrderByIdAsc(reservationId);
        return declarations.stream()
                .peek(d -> accessGuard.requireSameOrganization(
                        d.getOrganizationId(), "Déclaration hors de votre organisation"))
                .map(this::toSummary)
                .toList();
    }

    private DeclarationSummaryDto toSummary(GuestDeclaration d) {
        return new DeclarationSummaryDto(
                d.getId(),
                d.isPrimary(),
                d.getStatus() == null ? null : d.getStatus().name(),
                d.getProviderType(),
                d.getSubmittedAt() == null ? null : d.getSubmittedAt().toString(),
                d.isSubmittedToProvider());
    }

    /**
     * Retry manuel d'une déclaration unique (endpoint admin). Valide l'ownership org puis soumet.
     *
     * @param declarationId déclaration à (re)soumettre
     * @return résultat ; {@link Optional#empty()} si déclaration introuvable, déjà SUBMITTED,
     *         non COMPLETED, ou aucune connexion ACTIVE (no-op explicite)
     * @throws ComplianceProviderPendingException si le provider applicable n'est pas intégrable
     */
    public Optional<SubmissionResult> retrySubmission(Long declarationId) {
        GuestDeclaration declaration = declarationRepository.findById(declarationId).orElse(null);
        if (declaration == null) {
            log.warn("Retry soumission: déclaration {} introuvable", declarationId);
            return Optional.empty();
        }
        // findById ne traverse pas le filtre Hibernate → ownership org vérifié explicitement.
        accessGuard.requireSameOrganization(
                declaration.getOrganizationId(), "Déclaration hors de votre organisation");
        return submitOne(declaration, declaration.getOrganizationId());
    }

    // ─── Coeur : résolution + appel externe hors tx + persistance en nouvelle tx ───

    private Optional<SubmissionResult> submitOne(GuestDeclaration declaration, Long orgId) {
        if (declaration.getStatus() == DeclarationStatus.SUBMITTED) {
            log.debug("Déclaration {} déjà SUBMITTED — soumission ignorée (idempotent)", declaration.getId());
            return Optional.empty();
        }
        if (declaration.getStatus() != DeclarationStatus.COMPLETED) {
            log.debug("Déclaration {} non COMPLETED ({}) — soumission ignorée",
                    declaration.getId(), declaration.getStatus());
            return Optional.empty();
        }

        ComplianceProviderType provider = resolveProvider(declaration);
        if (provider == null) {
            log.info("Déclaration {} : aucun provider de conformité applicable (pays {}) — skip",
                    declaration.getId(), countryOf(declaration));
            return Optional.empty();
        }

        Optional<ComplianceConnection> activeConn = connectionService.getConnection(orgId, provider)
                .filter(c -> c.getStatus() == ComplianceConnection.Status.ACTIVE);
        if (activeConn.isEmpty()) {
            log.info("Déclaration {} : pas de connexion {} ACTIVE pour org {} — skip",
                    declaration.getId(), provider, orgId);
            return Optional.empty();
        }
        ComplianceConnection connection = activeConn.get();

        ComplianceSubmissionStrategy strategy = strategyRegistry.findFor(provider)
                .orElseThrow(() -> new IllegalStateException(
                        "Aucune ComplianceSubmissionStrategy enregistrée pour " + provider));

        // ── Appel externe HORS transaction DB ──
        String apiKey = connectionService.decryptApiKey(connection);
        SubmissionResult result = strategy.submit(declaration, connection, apiKey);

        // ── Persistance du résultat dans une NOUVELLE transaction (via proxy) ──
        self.getObject().applySubmissionResult(declaration.getId(), provider, result);
        return Optional.of(result);
    }

    /**
     * Matérialise le résultat de soumission. Succès → SUBMITTED + traçabilité ; échec → statut
     * inchangé. Transaction dédiée (REQUIRES_NEW) : l'écriture du résultat ne dépend pas de la
     * transaction métier d'origine (qui est déjà committée pour le flux post-commit).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void applySubmissionResult(Long declarationId, ComplianceProviderType provider, SubmissionResult result) {
        GuestDeclaration declaration = declarationRepository.findById(declarationId).orElse(null);
        if (declaration == null) {
            log.warn("applySubmissionResult: déclaration {} disparue avant persistance du résultat", declarationId);
            return;
        }
        if (result.accepted()) {
            declaration.setStatus(DeclarationStatus.SUBMITTED);
            declaration.setSubmittedToProvider(true);
            declaration.setProviderType(provider.name());
            declaration.setSubmittedAt(LocalDateTime.now());
            declarationRepository.save(declaration);
            log.info("Déclaration {} transmise à {} (ref={})",
                    declarationId, provider, result.externalReference());
        } else {
            // Échec explicite : statut inchangé, trace conservée. Jamais avalé silencieusement.
            log.warn("Déclaration {} NON transmise à {} : {}", declarationId, provider, result.message());
        }
    }

    // ─── Résolution du provider par pays ───

    /**
     * Provider applicable selon le pays de la propriété (repli sur le pays de la déclaration).
     * FR/ES/IT/PT → Chekin ; MA → DGSN ; SA → Shomoos ; sinon {@code null} (aucun provider).
     *
     * <p>SA mappe <b>Shomoos</b> (plateforme nationale d'enregistrement des voyageurs du
     * secteur hébergement) et non Absher (services citoyens) : Absher reste en catalogue
     * standby mais n'est pas le canal de déclaration des établissements.</p>
     */
    ComplianceProviderType resolveProvider(GuestDeclaration declaration) {
        String country = countryOf(declaration);
        if (country == null) {
            return null;
        }
        return switch (country.toUpperCase(Locale.ROOT)) {
            case "FR", "ES", "IT", "PT" -> ComplianceProviderType.CHEKIN;
            case "MA" -> ComplianceProviderType.POLICE_MA;
            case "SA" -> ComplianceProviderType.SHOMOOS;
            default -> null;
        };
    }

    private static String countryOf(GuestDeclaration declaration) {
        Reservation reservation = declaration.getReservation();
        if (reservation != null) {
            Property property = reservation.getProperty();
            if (property != null && property.getCountryCode() != null && !property.getCountryCode().isBlank()) {
                return property.getCountryCode();
            }
        }
        return declaration.getCountryCode();
    }
}
