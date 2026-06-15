package com.clenzy.service;

import com.clenzy.integration.brevo.BrevoApiClient;
import com.clenzy.model.MarketingIntegration;
import com.clenzy.repository.MarketingIntegrationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * Gestion de la configuration d'integration marketing (Brevo) au niveau plateforme.
 *
 * <h2>Source de verite : la BDD, avec fallback env (transition)</h2>
 * Les valeurs sont lues depuis {@code marketing_integration}. Tant que la BDD
 * n'est pas renseignee, on retombe sur les variables d'env BREVO_API_KEY /
 * BREVO_WAITLIST_LIST_ID — ce qui assure une migration sans coupure depuis
 * l'ancienne config .env. Une fois la cle saisie via la tab Settings, on peut
 * retirer les vars d'env.
 *
 * <h2>Securite</h2>
 * La cle API est chiffree au repos (entity {@link MarketingIntegration}). Ce
 * service ne renvoie jamais la cle en clair vers la couche presentation — le
 * controller expose une version masquee + un booleen {@code configured}.
 */
@Service
public class MarketingIntegrationService {

    private static final Logger log = LoggerFactory.getLogger(MarketingIntegrationService.class);

    private final MarketingIntegrationRepository repository;
    private final BrevoApiClient brevoApiClient;

    // Fallback env (le temps de la transition depuis .env / secret).
    @Value("${brevo.api-key:}")
    private String envApiKey;

    @Value("${brevo.base-url:https://api.brevo.com/v3}")
    private String envBaseUrl;

    @Value("${brevo.waitlist-list-id:0}")
    private long envWaitlistListId;

    public MarketingIntegrationService(MarketingIntegrationRepository repository, BrevoApiClient brevoApiClient) {
        this.repository = repository;
        this.brevoApiClient = brevoApiClient;
    }

    /** Resultat d'un test de connexion (expose tel quel par le controller). */
    public record TestResult(boolean success, String message, int listCount) {}

    /** Recupere la ligne Brevo (la cree si absente — idempotent avec le seed 0169). */
    @Transactional
    public MarketingIntegration getOrCreate() {
        return repository.findByProvider(MarketingIntegration.Provider.BREVO)
                .orElseGet(() -> {
                    MarketingIntegration m = new MarketingIntegration();
                    m.setProvider(MarketingIntegration.Provider.BREVO);
                    return repository.save(m);
                });
    }

    // ─────────────────────────── Resolution (BDD → env) ───────────────────────────

    /** Cle API effective : BDD si renseignee, sinon env, sinon null. */
    public String resolveApiKey() {
        String dbKey = getOrCreate().getApiKey();
        if (dbKey != null && !dbKey.isBlank()) return dbKey;
        return (envApiKey != null && !envApiKey.isBlank()) ? envApiKey : null;
    }

    public String resolveBaseUrl() {
        return (envBaseUrl != null && !envBaseUrl.isBlank()) ? envBaseUrl : BrevoApiClient.DEFAULT_BASE_URL;
    }

    /** Id de liste waitlist effectif : BDD si > 0, sinon env, sinon null. */
    public Long resolveWaitlistListId() {
        Long dbId = getOrCreate().getWaitlistListId();
        if (dbId != null && dbId > 0) return dbId;
        return envWaitlistListId > 0 ? envWaitlistListId : null;
    }

    public Long resolveNewsletterListId() {
        Long id = getOrCreate().getNewsletterListId();
        return (id != null && id > 0) ? id : null;
    }

    public Long resolveProspectsListId() {
        Long id = getOrCreate().getProspectsListId();
        return (id != null && id > 0) ? id : null;
    }

    public Long resolveLeadsListId() {
        Long id = getOrCreate().getLeadsListId();
        return (id != null && id > 0) ? id : null;
    }

    public boolean isWaitlistSyncEnabled() {
        return getOrCreate().isSyncWaitlistEnabled() && resolveApiKey() != null && resolveWaitlistListId() != null;
    }

    public boolean isNewsletterSyncEnabled() {
        return getOrCreate().isSyncNewsletterEnabled() && resolveApiKey() != null && resolveNewsletterListId() != null;
    }

    public boolean isProspectsSyncEnabled() {
        return getOrCreate().isSyncProspectsEnabled() && resolveApiKey() != null && resolveProspectsListId() != null;
    }

    public boolean isLeadsSyncEnabled() {
        return getOrCreate().isSyncLeadsEnabled() && resolveApiKey() != null && resolveLeadsListId() != null;
    }

    public boolean isAttributesSyncEnabled() {
        return getOrCreate().isSyncAttributesEnabled();
    }

    // ─────────────────────────── Updates (admin) ───────────────────────────

    @Transactional
    public MarketingIntegration updateApiKey(String apiKey, String by) {
        MarketingIntegration m = getOrCreate();
        m.setApiKey(apiKey == null || apiKey.isBlank() ? null : apiKey.trim());
        // Saisir/retirer une cle remet le statut a "a tester".
        m.setStatus(m.hasApiKey() ? MarketingIntegration.Status.UNCONFIGURED : MarketingIntegration.Status.UNCONFIGURED);
        m.setErrorMessage(null);
        m.setUpdatedBy(by);
        return repository.save(m);
    }

    @Transactional
    public MarketingIntegration updateLists(Long waitlistListId, Long newsletterListId, Long prospectsListId,
                                            Long leadsListId, String by) {
        MarketingIntegration m = getOrCreate();
        m.setWaitlistListId(normalize(waitlistListId));
        m.setNewsletterListId(normalize(newsletterListId));
        m.setProspectsListId(normalize(prospectsListId));
        m.setLeadsListId(normalize(leadsListId));
        m.setUpdatedBy(by);
        return repository.save(m);
    }

    @Transactional
    public MarketingIntegration updateToggles(Boolean syncWaitlist, Boolean syncNewsletter,
                                              Boolean syncProspects, Boolean syncLeads, Boolean syncAttributes, String by) {
        MarketingIntegration m = getOrCreate();
        if (syncWaitlist != null) m.setSyncWaitlistEnabled(syncWaitlist);
        if (syncNewsletter != null) m.setSyncNewsletterEnabled(syncNewsletter);
        if (syncProspects != null) m.setSyncProspectsEnabled(syncProspects);
        if (syncLeads != null) m.setSyncLeadsEnabled(syncLeads);
        if (syncAttributes != null) m.setSyncAttributesEnabled(syncAttributes);
        m.setUpdatedBy(by);
        return repository.save(m);
    }

    // ─────────────────────────── Test connexion / listes ───────────────────────────

    /** Teste la cle effective contre l'API Brevo et persiste le statut. */
    @Transactional
    public TestResult testConnection() {
        String key = resolveApiKey();
        MarketingIntegration m = getOrCreate();
        if (key == null) {
            m.setStatus(MarketingIntegration.Status.UNCONFIGURED);
            m.setErrorMessage("Aucune cle API configuree.");
            m.setLastTestedAt(Instant.now());
            repository.save(m);
            return new TestResult(false, "Aucune cle API configuree.", 0);
        }
        try {
            List<BrevoApiClient.BrevoList> lists = brevoApiClient.fetchLists(key, resolveBaseUrl());
            m.setStatus(MarketingIntegration.Status.ACTIVE);
            m.setErrorMessage(null);
            m.setLastTestedAt(Instant.now());
            repository.save(m);
            return new TestResult(true, "Connexion Brevo reussie.", lists.size());
        } catch (Exception e) {
            log.warn("Test connexion Brevo KO : {}", e.getMessage());
            m.setStatus(MarketingIntegration.Status.ERROR);
            m.setErrorMessage(e.getMessage());
            m.setLastTestedAt(Instant.now());
            repository.save(m);
            return new TestResult(false, "Echec : " + e.getMessage(), 0);
        }
    }

    /** Liste les listes Brevo (pour peupler les menus de mapping cote UI). */
    public List<BrevoApiClient.BrevoList> listBrevoLists() {
        String key = resolveApiKey();
        if (key == null) return List.of();
        return brevoApiClient.fetchLists(key, resolveBaseUrl());
    }

    private static Long normalize(Long id) {
        return (id != null && id > 0) ? id : null;
    }
}
