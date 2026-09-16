package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.ExposureEffect;
import com.clenzy.marketplace.model.MarketplaceExposureRule;
import com.clenzy.marketplace.model.MarketplaceProvider;
import com.clenzy.marketplace.repository.MarketplaceExposureRuleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Qui voit quelle fiche.
 *
 * <h2>Le defaut est ouvert</h2>
 * <p>Une fiche ACTIVE dont le mode d'engagement autorise l'exposition est
 * visible de TOUTES les organisations. C'est le comportement attendu d'une place
 * de marche : un catalogue ferme par defaut n'a aucun interet, et le cas du
 * prestataire reserve a une organisation est deja porte par
 * {@code EngagementMode.EXCLUSIVE}.</p>
 *
 * <h2>Trois exceptions, resolues du plus precis au plus general</h2>
 * <ol>
 *   <li>{@code ALLOW} nominatif — visible, meme si une fermeture globale existe.</li>
 *   <li>{@code DENY} nominatif — invisible pour cette organisation.</li>
 *   <li>{@code DENY} global — invisible partout, sauf ALLOW nominatif.</li>
 * </ol>
 *
 * <p>Cet ordre n'est pas negociable : l'inverser rendrait un {@code DENY} global
 * impossible a assouplir, et la seule facon d'ouvrir une fiche a un partenaire
 * serait de la rouvrir a tout le monde.</p>
 */
@Service
public class MarketplaceExposureService {

    private static final Logger log = LoggerFactory.getLogger(MarketplaceExposureService.class);

    private final MarketplaceExposureRuleRepository ruleRepository;
    private final ProviderDocumentaryService documentary;
    private final Clock clock;
    private final MarketplaceDecisionJournal journal;

    public MarketplaceExposureService(MarketplaceExposureRuleRepository ruleRepository, Clock clock, MarketplaceDecisionJournal journal, ProviderDocumentaryService documentary) {
        this.documentary=documentary;
        this.journal=journal;
        this.ruleRepository = ruleRepository;
        this.clock = clock;
    }

    /**
     * Cette organisation peut-elle voir cette fiche ?
     *
     * <p>Utilisee pour le controle d'acces a UNE fiche. Pour une liste, passer
     * par {@link #hiddenProviderIdsFor} : resoudre fiche par fiche ferait une
     * requete par ligne de resultat.</p>
     *
     * <p>L'organisation PORTEUSE est testee en premier, et c'est ce qui compte :
     * une fiche exclusive n'est pas « exposable », mais elle reste la sienne.
     * Tester l'exposabilite d'abord rendait ce rattrapage inatteignable — une
     * conciergerie ne voyait plus son propre prestataire exclusif.</p>
     */
    @Transactional(readOnly = true)
    public boolean isVisibleTo(MarketplaceProvider provider, Long organizationId) {
        if (provider == null || organizationId == null) {
            return false;
        }
        if (organizationId.equals(provider.getHomeOrganizationId())) {
            return true;
        }
        if (!provider.isExposable() || !documentary.eligible(provider.getId(),provider.getBaseCountryCode(),"*",java.time.LocalDate.now(clock))) {
            return false;
        }
        return !isHidden(provider.getId(), organizationId);
    }

    /** Fiches a exclure d'une recherche pour cette organisation. */
    @Transactional(readOnly = true)
    public List<Long> hiddenProviderIdsFor(Long organizationId) {
        if (organizationId == null) {
            return List.of();
        }
        var hidden = new java.util.HashSet<>(ruleRepository.findHiddenProviderIdsFor(organizationId));
        hidden.addAll(documentary.unpublishableIds());
        return List.copyOf(hidden);
    }

    /** Regles posees sur une fiche, pour l'ecran de moderation. */
    @Transactional(readOnly = true)
    public List<MarketplaceExposureRule> rulesFor(Long providerId) {
        return ruleRepository.findByProviderIdOrderByOrganizationIdAscIdAsc(providerId);
    }

    /**
     * Pose ou remplace une regle.
     *
     * <p>Remplace plutot qu'ajoute : deux regles contradictoires sur le meme
     * couple seraient un piege, et la base l'interdit deja par un index unique.
     * Mieux vaut ecraser explicitement que faire echouer l'ecran sur une
     * violation de contrainte.</p>
     *
     * @param organizationId organisation visee, ou {@code null} pour toutes
     * @param reason         obligatoire : une regle sans motif est impossible a reprendre
     */
    @Transactional
    public MarketplaceExposureRule setRule(Long providerId, Long organizationId,
                                           ExposureEffect effect, String reason,
                                           String actorKeycloakId) {
        if (effect == null) {
            throw new IllegalArgumentException("Sens de la règle manquant.");
        }
        String cleanedReason = reason == null ? null : reason.trim();
        if (cleanedReason == null || cleanedReason.isEmpty()) {
            throw new IllegalArgumentException(
                "Indiquez pourquoi cette règle existe : sans motif, personne n'osera la retirer.");
        }

        MarketplaceExposureRule rule = find(providerId, organizationId)
            .orElseGet(MarketplaceExposureRule::new);
        String previous = rule.getEffect()==null ? null : rule.getEffect().name()+":"+rule.getOrganizationId();
        rule.setProviderId(providerId);
        rule.setOrganizationId(organizationId);
        rule.setEffect(effect);
        rule.setReason(cleanedReason);
        rule.setCreatedByKeycloakId(actorKeycloakId);
        rule.setCreatedAt(LocalDateTime.now(clock));

        MarketplaceExposureRule saved = ruleRepository.save(rule);
        journal.record(providerId,"EXPOSURE",previous,effect.name()+":"+organizationId,actorKeycloakId);
        log.info("Exposition : fiche {} {} pour {}", providerId, effect,
            organizationId != null ? "org " + organizationId : "toutes les organisations");
        return saved;
    }

    /** Retire une regle : la fiche retombe sur le defaut. */
    @Transactional
    public void removeRule(Long providerId, Long ruleId) {
        MarketplaceExposureRule rule = ruleRepository.findById(ruleId)
            .orElseThrow(() -> new IllegalArgumentException("Règle introuvable"));
        // `findById` ne passe par aucun filtre : sans ce controle, l'identifiant
        // d'une regle posee sur une AUTRE fiche suffirait a la retirer.
        if (!rule.getProviderId().equals(providerId)) {
            throw new IllegalArgumentException("Règle introuvable");
        }
        journal.record(providerId,"EXPOSURE",rule.getEffect().name()+":"+rule.getOrganizationId(),null,null);
        ruleRepository.delete(rule);
        log.info("Exposition : regle {} retiree de la fiche {}", ruleId, providerId);
    }

    // ─── Rouages ─────────────────────────────────────────────────────────────

    private boolean isHidden(Long providerId, Long organizationId) {
        // ALLOW nominatif : l'exception a l'exception. Teste en premier, sinon
        // un DENY global serait impossible a assouplir.
        Optional<MarketplaceExposureRule> named = ruleRepository
            .findByProviderIdAndOrganizationId(providerId, organizationId);
        if (named.isPresent()) {
            return named.get().getEffect() == ExposureEffect.DENY;
        }
        return ruleRepository.findByProviderIdAndOrganizationIdIsNull(providerId)
            .map(rule -> rule.getEffect() == ExposureEffect.DENY)
            .orElse(false);
    }

    private Optional<MarketplaceExposureRule> find(Long providerId, Long organizationId) {
        return organizationId == null
            ? ruleRepository.findByProviderIdAndOrganizationIdIsNull(providerId)
            : ruleRepository.findByProviderIdAndOrganizationId(providerId, organizationId);
    }
}
