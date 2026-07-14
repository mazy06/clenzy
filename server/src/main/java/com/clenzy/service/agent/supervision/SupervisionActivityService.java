package com.clenzy.service.agent.supervision;

import com.clenzy.dto.SupervisionActivitySnapshotDto;
import com.clenzy.dto.SupervisionFeedEntryDto;
import com.clenzy.model.Property;
import com.clenzy.model.SupervisionActivity;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.SupervisionActivityRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.service.agent.ToolRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Journal d'activité réel de la constellation (feed + métriques).
 *
 * <p>Écriture best-effort (jamais sur le chemin critique d'un run) ; lecture
 * ownership-checked (la propriété doit appartenir à l'org du requester, sauf
 * platform staff).</p>
 */
@Service
public class SupervisionActivityService {

    private static final Logger log = LoggerFactory.getLogger(SupervisionActivityService.class);
    private static final int FEED_LIMIT = 20;
    private static final Duration AUTO_ACTIONS_WINDOW = Duration.ofHours(24);

    private final SupervisionActivityRepository activityRepository;
    private final SupervisionModuleRegistry registry;
    private final ToolRegistry toolRegistry;
    private final PropertyRepository propertyRepository;
    private final OrganizationAccessGuard organizationAccessGuard;
    private final SupervisionRealtimePublisher realtimePublisher;

    // @Lazy : ToolRegistry dépend (transitivement) de ce service → sans lazy, cycle
    // de beans au démarrage. Le proxy est résolu au 1er appel (registre alors prêt).
    public SupervisionActivityService(SupervisionActivityRepository activityRepository,
                                      SupervisionModuleRegistry registry,
                                      @Lazy ToolRegistry toolRegistry,
                                      PropertyRepository propertyRepository,
                                      OrganizationAccessGuard organizationAccessGuard,
                                      SupervisionRealtimePublisher realtimePublisher) {
        this.activityRepository = activityRepository;
        this.registry = registry;
        this.toolRegistry = toolRegistry;
        this.propertyRepository = propertyRepository;
        this.organizationAccessGuard = organizationAccessGuard;
        this.realtimePublisher = realtimePublisher;
    }

    /**
     * Enregistre une action observée d'un specialist (best-effort). Le specialist
     * est mappé vers un module ; un specialist technique masqué (→ null) n'est pas
     * journalisé. Un échec ne casse JAMAIS le run en cours (avalé + logué debug).
     */
    @Transactional
    public void recordAct(Long organizationId, Long propertyId, String specialist,
                          String toolName, String summary) {
        // Ne journaliser que les VRAIES ACTIONS : les outils d'écriture
        // (ToolDescriptor.write → requiresConfirmation). Les outils de LECTURE
        // exécutés par un scan (analyses, prévisions…) ne sont PAS des actions
        // et pollueraient le feed « En direct » — on les ignore ici.
        if (!isWriteTool(toolName)) {
            return;
        }
        // Un specialist technique masqué (→ module null) n'est pas journalisé.
        recordModuleAct(organizationId, propertyId,
                registry.moduleForSpecialist(specialist), toolName, summary);
    }

    /** Un outil est une « action » s'il est déclaré en écriture (confirmation requise). */
    private boolean isWriteTool(String toolName) {
        if (toolName == null || toolName.isBlank()) {
            return false;
        }
        return toolRegistry.find(toolName)
                .map(h -> h.descriptor().requiresConfirmation())
                .orElse(false);
    }

    /**
     * Vrai UNIQUEMENT si {@code toolName} correspond à un outil connu de LECTURE.
     * Un nom inconnu (ex. action d'automatisation déterministe) renvoie false →
     * l'entrée est conservée au rendu. Sert à masquer le bruit read-only hérité.
     */
    /**
     * Feed org-wide (vue portefeuille) : dernières activités de TOUTE l'organisation,
     * hors outils read-only (héritage). Retourne les entités (le portefeuille y ajoute
     * le nom du logement). Pas de vérif d'ownership par logement ici : l'org est celle
     * du requester (résolue par l'appelant via {@code tenantContext}).
     */
    @Transactional(readOnly = true)
    public List<SupervisionActivity> recentOrgFeed(Long organizationId, int fetchLimit, int keepLimit) {
        if (organizationId == null) {
            return List.of();
        }
        return activityRepository
                .findByOrganizationIdOrderByCreatedAtDesc(organizationId, PageRequest.of(0, fetchLimit))
                .stream()
                .filter(a -> !isReadOnlyTool(a.getToolName()))
                .limit(keepLimit)
                .toList();
    }

    /** Nb d'actions auto de l'org sur la fenêtre récente (métrique portefeuille). */
    @Transactional(readOnly = true)
    public long orgAutoActions(Long organizationId) {
        if (organizationId == null) {
            return 0L;
        }
        return activityRepository.countByOrganizationIdAndKindAndCreatedAtAfter(
                organizationId, SupervisionActivity.KIND_ACT, Instant.now().minus(AUTO_ACTIONS_WINDOW));
    }

    private boolean isReadOnlyTool(String toolName) {
        if (toolName == null || toolName.isBlank()) {
            return false;
        }
        return toolRegistry.find(toolName)
                .map(h -> !h.descriptor().requiresConfirmation())
                .orElse(false);
    }

    /**
     * Journalise une action déjà rattachée à un module de la constellation
     * (com/rev/ops/fin/rep) — utilisé par le moteur d'automatisation déterministe
     * pour que la constellation reflète aussi les flux SANS IA. Best-effort :
     * un échec ne casse jamais l'exécution en cours.
     */
    @Transactional
    public void recordModuleAct(Long organizationId, Long propertyId, String moduleKey,
                                String toolName, String summary) {
        recordModuleAct(organizationId, propertyId, moduleKey, toolName, summary, null, null);
    }

    /**
     * Variante qui rattache une référence de message envoyé ({@code messageLogId}) à
     * l'activité : le feed peut alors prévisualiser à la demande le contenu du message
     * (endpoint {@code /guest-messaging/preview/{logId}}). {@code messageLogId} null =
     * comportement identique à la variante courte.
     */
    @Transactional
    public void recordModuleAct(Long organizationId, Long propertyId, String moduleKey,
                                String toolName, String summary, Long messageLogId) {
        recordModuleAct(organizationId, propertyId, moduleKey, toolName, summary, messageLogId, null);
    }

    /**
     * Variante complète : rattache en plus une référence de facture ({@code invoiceId},
     * relances de paiement) — le feed ouvre alors la modale de détail facture
     * (payer / envoyer un lien de paiement). Références null = variante courte.
     */
    @Transactional
    public void recordModuleAct(Long organizationId, Long propertyId, String moduleKey,
                                String toolName, String summary, Long messageLogId, Long invoiceId) {
        if (organizationId == null || propertyId == null || moduleKey == null) {
            return;
        }
        try {
            SupervisionActivity activity = new SupervisionActivity(
                    organizationId, propertyId, moduleKey,
                    SupervisionActivity.KIND_ACT, toolName, summary);
            activity.setMessageLogId(messageLogId);
            activity.setInvoiceId(invoiceId);
            SupervisionActivity saved = activityRepository.save(activity);
            // Temps réel (T6) : pousse l'entrée aux opérateurs connectés (best-effort).
            realtimePublisher.publishFeedAdded(propertyId, saved.getId(), moduleKey, toolName,
                    summary, saved.getCreatedAt(), messageLogId, invoiceId);
        } catch (Exception e) {
            log.debug("supervision activity record failed (module={} prop={}): {}",
                    moduleKey, propertyId, e.getMessage());
        }
    }

    /**
     * Variante en transaction indépendante ({@code REQUIRES_NEW}) : à utiliser quand l'appelant
     * s'apprête à lever une exception qui rollback sa propre transaction (ex. double-booking refusé
     * dans {@link com.clenzy.service.CalendarEngine}). Sans ça, l'insert rejoindrait la transaction
     * appelante et serait annulé par le rollback → l'événement de feed n'apparaîtrait jamais.
     * Reste best-effort : un échec du journal ne remonte jamais à l'appelant.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordModuleActNewTx(Long organizationId, Long propertyId, String moduleKey,
                                     String toolName, String summary) {
        recordModuleAct(organizationId, propertyId, moduleKey, toolName, summary);
    }

    /**
     * Contrôle d'accès LÉGER pour le flux SSE : ownership org sans recalculer le
     * feed (l'ancien appel à {@link #getSnapshot} recomptait 200 lignes + un count
     * uniquement pour valider l'accès — audit perf accordéon). Même tolérance que
     * getSnapshot : propriété inconnue → no-op (le flux ne diffusera rien).
     */
    @Transactional(readOnly = true)
    public void requirePropertyAccess(Long propertyId) {
        propertyRepository.findById(propertyId).ifPresent(property ->
                organizationAccessGuard.requireSameOrganization(
                        property.getOrganizationId(), "Propriété hors de votre organisation"));
    }

    /** Feed + compteur d'actions d'une propriété (ownership-checked). */
    @Transactional(readOnly = true)
    public SupervisionActivitySnapshotDto getSnapshot(Long propertyId) {
        Property property = propertyRepository.findById(propertyId).orElse(null);
        if (property == null) {
            return new SupervisionActivitySnapshotDto(List.of(), 0);
        }
        // findById contourne le filtre org → valider l'ownership explicitement.
        organizationAccessGuard.requireSameOrganization(
                property.getOrganizationId(), "Propriété hors de votre organisation");

        Long orgId = property.getOrganizationId();
        // Les entrées d'outils read-only (héritage d'avant le filtre d'écriture)
        // sont MASQUÉES en SQL (le feed « En direct » ne montre que de vraies
        // actions) ; les entrées d'automatisation (tool_name absent/inconnu) sont
        // conservées. Avant : fetch de 200 lignes filtré en mémoire (audit perf).
        List<String> readOnlyTools = readOnlyToolNames();
        List<SupervisionActivity> rows = readOnlyTools.isEmpty()
                ? activityRepository.findByOrganizationIdAndPropertyIdOrderByCreatedAtDesc(
                        orgId, propertyId, PageRequest.of(0, FEED_LIMIT))
                : activityRepository.findFeedExcludingTools(
                        orgId, propertyId, readOnlyTools, PageRequest.of(0, FEED_LIMIT));
        List<SupervisionFeedEntryDto> feed = rows.stream()
                .map(this::toFeedEntry)
                .toList();

        long autoActions = activityRepository.countByOrganizationIdAndPropertyIdAndKindAndCreatedAtAfter(
                orgId, propertyId, SupervisionActivity.KIND_ACT,
                Instant.now().minus(AUTO_ACTIONS_WINDOW));

        return new SupervisionActivitySnapshotDto(feed, (int) autoActions);
    }

    /** Noms des outils de LECTURE du registre (exclus du feed en SQL). */
    private List<String> readOnlyToolNames() {
        return toolRegistry.listDescriptors().stream()
                .filter(d -> !d.requiresConfirmation())
                .map(com.clenzy.config.ai.ToolDescriptor::name)
                .toList();
    }

    private SupervisionFeedEntryDto toFeedEntry(SupervisionActivity a) {
        String text = a.getSummary() != null && !a.getSummary().isBlank()
                ? a.getSummary()
                : humanizeTool(a.getToolName(), a.getModuleKey());
        return new SupervisionFeedEntryDto(
                String.valueOf(a.getId()),
                a.getModuleKey(),
                a.getCreatedAt() != null ? a.getCreatedAt().toString() : Instant.now().toString(),
                text,
                a.getToolName(),
                a.getMessageLogId(),
                a.getInvoiceId());
    }

    /** snake_case → libellé court lisible ; repli sur le module si vide. */
    private static String humanizeTool(String toolName, String fallback) {
        if (toolName == null || toolName.isBlank()) {
            return fallback;
        }
        String spaced = toolName.replace('_', ' ').trim();
        return spaced.isEmpty()
                ? fallback
                : Character.toUpperCase(spaced.charAt(0)) + spaced.substring(1);
    }
}
