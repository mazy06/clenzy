package com.clenzy.service;

import com.clenzy.integration.brevo.BrevoApiClient;
import com.clenzy.model.WaitlistSignup;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Synchronisation des contacts vers Brevo (API v3).
 *
 * La configuration (cle API, ids de listes, toggles) est resolue par
 * {@link MarketingIntegrationService} — BDD chiffree, avec fallback env le temps
 * de la transition. Best-effort : si Brevo n'est pas configure ou que la sync
 * concernee est desactivee, l'operation est simplement ignoree ; la donnee
 * metier (inscription waitlist, opt-in newsletter) reste enregistree cote Clenzy.
 */
@Service
public class BrevoContactService {

    private static final Logger log = LoggerFactory.getLogger(BrevoContactService.class);

    private final MarketingIntegrationService marketing;
    private final BrevoApiClient brevo;

    public BrevoContactService(MarketingIntegrationService marketing, BrevoApiClient brevo) {
        this.marketing = marketing;
        this.brevo = brevo;
    }

    /** Config minimale presente (cle API + liste waitlist resolues). */
    public boolean isConfigured() {
        return marketing.resolveApiKey() != null && marketing.resolveWaitlistListId() != null;
    }

    /** Ajoute (ou met a jour) un inscrit waitlist dans la liste Brevo dediee. */
    public boolean addToWaitlist(WaitlistSignup s) {
        if (!marketing.isWaitlistSyncEnabled()) {
            log.info("Sync waitlist Brevo desactivee/non configuree — ignoree pour {}", s.getEmail());
            return false;
        }
        Map<String, Object> attrs = new HashMap<>();
        if (marketing.isAttributesSyncEnabled()) {
            putIfPresent(attrs, "FULLNAME", s.getFullName());
            putIfPresent(attrs, "VILLE", s.getCity());
            putIfPresent(attrs, "SOURCE", s.getSource());
        }
        return upsert(s.getEmail(), attrs, marketing.resolveWaitlistListId(), "waitlist");
    }

    /** Ajoute (ou met a jour) un opt-in newsletter dans la liste Brevo dediee. */
    public boolean addToNewsletter(String email, String fullName, String city) {
        if (!marketing.isNewsletterSyncEnabled()) {
            log.debug("Sync newsletter Brevo desactivee/non configuree — ignoree pour {}", email);
            return false;
        }
        Map<String, Object> attrs = new HashMap<>();
        if (marketing.isAttributesSyncEnabled()) {
            putIfPresent(attrs, "FULLNAME", fullName);
            putIfPresent(attrs, "VILLE", city);
        }
        return upsert(email, attrs, marketing.resolveNewsletterListId(), "newsletter");
    }

    /**
     * Ajoute (ou met a jour) un lead capte (exit-intent / panier abandonne) dans la liste Brevo
     * dediee (2.12). L'attribut SOURCE permet de construire des segments Brevo par origine.
     */
    public boolean addLead(String email, String fullName, String source, String locale) {
        if (!marketing.isLeadsSyncEnabled()) {
            log.debug("Sync leads Brevo desactivee/non configuree — ignoree pour {}", email);
            return false;
        }
        Map<String, Object> attrs = new HashMap<>();
        if (marketing.isAttributesSyncEnabled()) {
            putIfPresent(attrs, "FULLNAME", fullName);
            putIfPresent(attrs, "SOURCE", source);
            putIfPresent(attrs, "LANGUE", locale);
        }
        return upsert(email, attrs, marketing.resolveLeadsListId(), "lead");
    }

    /** Retire un contact d'une liste (desinscription via webhook Brevo). */
    public boolean removeFromList(long listId, String email) {
        String key = marketing.resolveApiKey();
        if (key == null || email == null || email.isBlank()) return false;
        try {
            brevo.removeContactFromList(key, marketing.resolveBaseUrl(), listId, email);
            return true;
        } catch (Exception e) {
            log.warn("Retrait Brevo liste {} KO pour {} : {}", listId, email, e.getMessage());
            return false;
        }
    }

    private boolean upsert(String email, Map<String, Object> attrs, Long listId, String label) {
        if (email == null || email.isBlank() || listId == null) return false;
        try {
            brevo.upsertContact(marketing.resolveApiKey(), marketing.resolveBaseUrl(),
                    email, attrs, List.of(listId), true);
            log.info("Contact {} synchronise Brevo (liste {}) : {}", label, listId, email);
            return true;
        } catch (Exception e) {
            log.warn("Sync Brevo {} KO pour {} : {}", label, email, e.getMessage());
            return false;
        }
    }

    private static void putIfPresent(Map<String, Object> map, String key, String value) {
        if (value != null && !value.isBlank()) map.put(key, value);
    }
}
