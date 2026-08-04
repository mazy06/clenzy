package com.clenzy.service.agent.briefing;

import com.clenzy.model.AssistantBriefingPref;
import com.clenzy.model.UserPreferences;
import com.clenzy.repository.AssistantBriefingPrefRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.UserPreferencesRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Service de gestion des preferences de briefing proactif par utilisateur.
 *
 * <p>Trois operations exposees :
 * <ul>
 *   <li>{@link #get} : lit les prefs persistees, retourne {@link Optional#empty} si pas de pref custom</li>
 *   <li>{@link #upsert} : insert ou update — typiquement appele depuis l'endpoint settings</li>
 *   <li>{@link #getDefaultPrefs} : valeurs par defaut (daily_morning / in_app / 08:00 Europe/Paris)</li>
 * </ul>
 */
@Service
@Transactional
public class AssistantBriefingPrefService {

    private static final Logger log = LoggerFactory.getLogger(AssistantBriefingPrefService.class);
    private static final Set<String> ALLOWED_CHANNELS = Set.of("in_app", "email", "whatsapp");

    private final AssistantBriefingPrefRepository repository;
    private final ObjectMapper objectMapper;
    /**
     * Politique appliquee aux utilisateurs sans preference enregistree. Nullable :
     * le constructeur historique (tests du CRUD de prefs) ne la fournit pas, et
     * {@link #listEffectivePrefs()} se replie alors sur les seules prefs stockees.
     */
    private final BriefingDefaultPolicy defaultPolicy;
    private final PropertyRepository propertyRepository;
    private final UserPreferencesRepository userPreferencesRepository;

    @Autowired
    public AssistantBriefingPrefService(AssistantBriefingPrefRepository repository,
                                          ObjectMapper objectMapper,
                                          BriefingDefaultPolicy defaultPolicy,
                                          PropertyRepository propertyRepository,
                                          UserPreferencesRepository userPreferencesRepository) {
        this.repository = repository;
        this.objectMapper = objectMapper;
        this.defaultPolicy = defaultPolicy;
        this.propertyRepository = propertyRepository;
        this.userPreferencesRepository = userPreferencesRepository;
    }

    /** Constructeur historique — CRUD des preferences seul, sans politique par defaut. */
    public AssistantBriefingPrefService(AssistantBriefingPrefRepository repository,
                                          ObjectMapper objectMapper) {
        this(repository, objectMapper, null, null, null);
    }

    @Transactional(readOnly = true)
    public Optional<AssistantBriefingPref> get(String keycloakId) {
        if (keycloakId == null || keycloakId.isBlank()) return Optional.empty();
        return repository.findByKeycloakId(keycloakId);
    }

    /**
     * Preferences EFFECTIVES du tick de scheduler : les preferences enregistrees
     * et activees, plus — si la politique par defaut est active — une preference
     * synthetique pour chaque destinataire eligible qui n'en a aucune.
     *
     * <p>Les reglages IA n'etant pas exposes aux utilisateurs de l'organisation,
     * la table reste vide en pratique : sans cette synthese, le scheduler ne
     * trouverait jamais personne et la synthese hebdomadaire ne partirait jamais.
     * Cf. {@link BriefingDefaultPolicy}.</p>
     *
     * <p><b>Une preference enregistree l'emporte TOUJOURS</b>, y compris
     * desactivee : on exclut de la synthese tout utilisateur ayant une ligne, pas
     * seulement ceux qui l'ont activee. Sans cette nuance, un utilisateur qui a
     * explicitement coupe ses briefings serait re-abonne au deploiement suivant.</p>
     *
     * <p>La logique de matching fuseau/heure reste au scheduler.</p>
     */
    @Transactional(readOnly = true)
    public List<AssistantBriefingPref> listEffectivePrefs() {
        List<AssistantBriefingPref> stored = repository.findAll();
        List<AssistantBriefingPref> effective = new ArrayList<>(
                stored.stream().filter(AssistantBriefingPref::isEnabled).toList());

        if (defaultPolicy == null || !defaultPolicy.isEnabled()) {
            return effective;
        }

        // Tout utilisateur DEJA porteur d'une ligne est hors politique par defaut,
        // qu'il l'ait activee ou non.
        Set<String> configured = stored.stream()
                .map(AssistantBriefingPref::getKeycloakId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        for (Object[] row : propertyRepository.findBriefingRecipients()) {
            String keycloakId = (String) row[0];
            Long organizationId = (Long) row[1];
            if (keycloakId == null || organizationId == null) continue;
            if (!configured.add(keycloakId)) continue;  // deja vu (ligne existante ou doublon multi-org)
            effective.add(defaultPolicy.buildFor(keycloakId, organizationId, resolveTimezone(keycloakId)));
        }
        return effective;
    }

    /**
     * Fuseau de l'utilisateur, lu dans ses preferences d'interface. C'est lui qui
     * decide de l'heure d'envoi : un proprietaire a Marrakech ne doit pas recevoir
     * sa synthese a 6 h du matin parce que le defaut serveur est parisien.
     * Retourne null si inconnu — {@link BriefingDefaultPolicy} appliquera son repli.
     */
    private String resolveTimezone(String keycloakId) {
        if (userPreferencesRepository == null) return null;
        try {
            return userPreferencesRepository.findByKeycloakId(keycloakId)
                    .map(UserPreferences::getTimezone)
                    .orElse(null);
        } catch (Exception e) {
            log.debug("Fuseau introuvable pour {} : {}", keycloakId, e.getMessage());
            return null;
        }
    }

    /**
     * Cree ou met a jour les prefs d'un user. Valide les canaux (whitelist
     * stricte) et le format de la timezone (java {@link java.time.ZoneId}).
     */
    public AssistantBriefingPref upsert(Long organizationId, String keycloakId,
                                          boolean enabled,
                                          AssistantBriefingPref.Frequency frequency,
                                          List<String> channels,
                                          LocalTime timeLocal,
                                          String timezone) {
        if (organizationId == null) {
            throw new IllegalArgumentException("organizationId est requis");
        }
        if (keycloakId == null || keycloakId.isBlank()) {
            throw new IllegalArgumentException("keycloakId est requis");
        }
        if (frequency == null) frequency = AssistantBriefingPref.Frequency.DAILY_MORNING;
        if (timeLocal == null) timeLocal = LocalTime.of(8, 0);
        if (timezone == null || timezone.isBlank()) timezone = "Europe/Paris";
        validateTimezone(timezone);

        AssistantBriefingPref pref = repository.findByKeycloakId(keycloakId)
                .orElseGet(() -> new AssistantBriefingPref(organizationId, keycloakId));

        // Defense en profondeur : ne pas laisser un user changer l'org de sa pref
        if (pref.getId() != null && !pref.getOrganizationId().equals(organizationId)) {
            log.warn("Briefing pref {} belongs to org {} but caller is {}",
                    pref.getId(), pref.getOrganizationId(), organizationId);
            throw new IllegalStateException("Cross-org pref mismatch");
        }

        pref.setEnabled(enabled);
        pref.setFrequencyEnum(frequency);
        pref.setChannels(serializeChannels(channels));
        pref.setTimeLocal(timeLocal);
        pref.setTimezone(timezone);
        return repository.save(pref);
    }

    /**
     * Construit les prefs par defaut (objet non persiste). Le service les retourne
     * quand un user n'a jamais configure ses prefs, pour que le frontend ait des
     * valeurs initiales saines.
     */
    public AssistantBriefingPref getDefaultPrefs(Long organizationId, String keycloakId) {
        AssistantBriefingPref pref = new AssistantBriefingPref(organizationId, keycloakId);
        pref.setEnabled(true);
        pref.setFrequencyEnum(AssistantBriefingPref.Frequency.DAILY_MORNING);
        pref.setChannels("[\"in_app\"]");
        pref.setTimeLocal(LocalTime.of(8, 0));
        pref.setTimezone("Europe/Paris");
        return pref;
    }

    /** Parse la colonne {@code channels} en liste de canaux normalisee. */
    public List<String> parseChannels(AssistantBriefingPref pref) {
        if (pref == null || pref.getChannels() == null) return List.of("in_app");
        try {
            JsonNode node = objectMapper.readTree(pref.getChannels());
            if (!node.isArray()) return List.of("in_app");
            List<String> out = new ArrayList<>();
            for (JsonNode item : node) {
                String c = item.asText();
                if (c != null && ALLOWED_CHANNELS.contains(c)) out.add(c);
            }
            return out.isEmpty() ? List.of("in_app") : out;
        } catch (Exception e) {
            log.debug("parseChannels: invalid JSON, falling back to in_app");
            return List.of("in_app");
        }
    }

    private String serializeChannels(List<String> channels) {
        if (channels == null || channels.isEmpty()) return "[\"in_app\"]";
        // Whitelist + de-dup + preservation d'ordre
        Set<String> filtered = new LinkedHashSet<>();
        for (String c : channels) {
            if (c == null) continue;
            String normalized = c.trim().toLowerCase();
            if (ALLOWED_CHANNELS.contains(normalized)) filtered.add(normalized);
        }
        if (filtered.isEmpty()) filtered = new HashSet<>(List.of("in_app"));
        try {
            return objectMapper.writeValueAsString(filtered);
        } catch (JsonProcessingException e) {
            log.warn("serializeChannels failed : {}", e.getMessage());
            return "[\"in_app\"]";
        }
    }

    private static void validateTimezone(String tz) {
        try {
            java.time.ZoneId.of(tz);
        } catch (Exception e) {
            throw new IllegalArgumentException("Timezone invalide : '" + tz + "'");
        }
    }
}
