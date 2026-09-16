package com.clenzy.marketplace.service;

import com.clenzy.marketplace.dto.ProviderStatusUpdateRequest;
import com.clenzy.marketplace.model.EngagementMode;
import com.clenzy.marketplace.model.MarketplaceProvider;
import com.clenzy.marketplace.model.ProviderStatus;
import com.clenzy.marketplace.repository.MarketplaceProviderRepository;
import com.clenzy.repository.OrganizationRepository;
import jakarta.persistence.EntityNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Clock;
import java.time.LocalDateTime;

/**
 * Moderation des fiches par l'equipe plateforme.
 *
 * <p>Les transitions sont datees et signees : qui a valide, quand, et pourquoi
 * en cas de refus. Sans cette trace, une candidature rejetee six mois plus tot
 * est impossible a reprendre.</p>
 */
@Service
public class MarketplaceModerationService {

    private static final Logger log = LoggerFactory.getLogger(MarketplaceModerationService.class);

    private final MarketplaceProviderRepository providerRepository;
    private final OrganizationRepository organizationRepository;
    private final MarketplaceNotificationOutbox notifications;
    private final MarketplaceOnboardingService onboardingService;
    private final ProviderDocumentaryService documentary;
    private final Clock clock;
    private final MarketplaceDecisionJournal journal;

    public MarketplaceModerationService(MarketplaceProviderRepository providerRepository,
                                        OrganizationRepository organizationRepository,
                                        MarketplaceNotificationOutbox notifications,
                                        MarketplaceOnboardingService onboardingService,
                                        PlatformTransactionManager transactionManager,
                                        Clock clock, MarketplaceDecisionJournal journal, ProviderDocumentaryService documentary) {
        this.documentary=documentary;
        this.journal=journal;
        this.providerRepository = providerRepository;
        this.organizationRepository = organizationRepository;
        this.notifications = notifications;
        this.onboardingService = onboardingService;
        this.clock = clock;
    }

    /**
     * Change l'etat d'une fiche.
     *
     * @param actorKeycloakId identite du moderateur, tracee sur la fiche
     */
    @Transactional
    public void updateStatus(Long providerId, ProviderStatusUpdateRequest request, String actorKeycloakId) {
        MarketplaceProvider provider = providerRepository.findForErasure(providerId)
            .orElseThrow(() -> new EntityNotFoundException("Fiche introuvable : " + providerId));

        ProviderStatus target = request.status();
        if (target == ProviderStatus.ACTIVE) documentary.requirePublication(providerId);
        String previousStatus = provider.getStatus().name();

        // Un refus sans motif ne se reprend pas : on l'interdit plutot que de
        // laisser une fiche rejetee sans explication dans le catalogue.
        if (target == ProviderStatus.REJECTED
            && (request.reviewNote() == null || request.reviewNote().isBlank())) {
            throw new IllegalArgumentException("Un refus doit porter un motif.");
        }

        // Un refus annonce sans un mot condamne le candidat a redeposer le meme
        // dossier. La note interne ne suffit pas : elle n'est pas ecrite pour lui.
        // Accepter, c'est creer un compte Keycloak sur cette adresse et lui
        // envoyer une invitation a definir un mot de passe. Le faire sans preuve
        // que le candidat la controle rendrait l'usurpation triviale : un
        // formulaire anonyme suffirait.
        if (target == ProviderStatus.ACTIVE || target == ProviderStatus.REJECTED) {
            MarketplaceReviewPolicy.requireConfirmedEmail(provider);
        }

        String decisionMessage = trimToNull(request.decisionMessage());
        if (target == ProviderStatus.REJECTED && decisionMessage == null) {
            throw new IllegalArgumentException(
                "Un refus doit porter un message pour le candidat.");
        }

        boolean changed = provider.getStatus() != target || (decisionMessage != null && !java.util.Objects.equals(provider.getDecisionMessage(), decisionMessage));
        LocalDateTime now = LocalDateTime.now(clock);
        provider.setStatus(target);
        if (request.reviewNote() != null) {
            provider.setReviewNote(request.reviewNote().trim());
        }
        if (decisionMessage != null) {
            provider.setDecisionMessage(decisionMessage);
        }

        switch (target) {
            case ACTIVE -> {
                // Premiere activation seulement : reactiver apres suspension ne
                // doit pas reecrire la date de mise en ligne d'origine.
                if (provider.getActivatedAt() == null) {
                    provider.setActivatedAt(now);
                }
                provider.setVerifiedAt(now);
                provider.setVerifiedByKeycloakId(actorKeycloakId);
                provider.setSuspendedAt(null);
            }
            case SUSPENDED -> provider.setSuspendedAt(now);
            case REJECTED, ARCHIVED -> {
                provider.setVerifiedAt(null);
                provider.setVerifiedByKeycloakId(null);
            }
            case PENDING_REVIEW -> {
                provider.setVerifiedAt(null);
                provider.setVerifiedByKeycloakId(null);
                provider.setSuspendedAt(null);
            }
        }

        providerRepository.save(provider);
        journal.record(providerId,"STATUS",previousStatus,target.name(),actorKeycloakId);
        log.info("Fiche place de marche {} passee en {} par {}", providerId, target, actorKeycloakId);

        // Une decision ne s'annonce qu'UNE FOIS, et seulement pour les deux
        // etats qui en sont une. Une suspension ou un archivage sont des actes
        // internes : le candidat n'a pas a recevoir un courriel pour cela.
        boolean announceable = target == ProviderStatus.ACTIVE || target == ProviderStatus.REJECTED;
        if (announceable && changed) {
            provider.setDecisionSentAt(null);
            notifications.enqueue(providerId, "DECISION", provider.getDecisionMessage(), target.name(), actorKeycloakId);
        }

        // Un prestataire accepte cesse d'etre un dossier : il lui faut un compte.
        // Apres le commit, parce que creer un compte Keycloak est un appel
        // reseau — et seulement s'il n'en a pas deja un.
        if (target == ProviderStatus.ACTIVE && provider.getUserId() == null) {
            onboardingService.enqueue(providerId);
            onboardAfterCommit(providerId);
        }
    }

    /**
     * Ouvre le compte du prestataire APRES le commit.
     *
     * <p>Ne peut pas faire echouer la moderation : la fiche est acceptee, et une
     * ouverture de compte ratee se rejoue — annuler l'acceptation reviendrait a
     * dedire une decision deja annoncee au candidat.</p>
     */
    private void onboardAfterCommit(Long providerId) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            onboardingService.onboard(providerId);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                onboardingService.onboard(providerId);
            }
        });
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    /**
     * Rattache la fiche a une organisation porteuse, ou l'en detache.
     *
     * <p>Le professionnel est toujours porte par une organisation : la sienne
     * s'il est independant, celle qui l'emploie s'il est rattache. Le mode
     * d'engagement dit ce que la place de marche a le droit d'en faire — un
     * rattachement {@link EngagementMode#EXCLUSIVE} le retire du catalogue.</p>
     *
     * @param organizationId organisation porteuse, ou {@code null} pour detacher
     */
    @Transactional
    public void updateEngagement(Long providerId, EngagementMode mode, Long organizationId) {
        MarketplaceProvider provider = providerRepository.findForErasure(providerId)
            .orElseThrow(() -> new EntityNotFoundException("Fiche introuvable : " + providerId));

        if (organizationId != null && !organizationRepository.existsById(organizationId)) {
            throw new IllegalArgumentException("Organisation introuvable : " + organizationId);
        }

        // Un rattachement sans organisation n'a pas de sens : il laisserait une
        // fiche qui se dit employee sans dire par qui.
        if (mode != EngagementMode.INDEPENDENT && organizationId == null) {
            throw new IllegalArgumentException(
                "Un professionnel rattache doit designer son organisation porteuse.");
        }

        String previousEngagement = provider.getEngagementMode().name()+":"+provider.getHomeOrganizationId();
        provider.setEngagementMode(mode);
        provider.setHomeOrganizationId(organizationId);
        providerRepository.save(provider);

        journal.record(providerId,"ENGAGEMENT",previousEngagement,mode.name()+":"+organizationId,null);
        log.info("Fiche place de marche {} : engagement={} organisation={}",
            providerId, mode, organizationId);
    }
}
