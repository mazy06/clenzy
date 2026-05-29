package com.clenzy.service.messaging.whatsapp;

import com.clenzy.model.WhatsAppTemplateContent;
import com.clenzy.repository.WhatsAppTemplateContentRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;
import org.yaml.snakeyaml.Yaml;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Source de verite des templates WhatsApp standards Clenzy.
 *
 * <h3>Priorite des sources (depuis la migration 0154)</h3>
 * <ol>
 *   <li><b>Base de donnees</b> ({@code whatsapp_template_content} avec
 *       {@code organization_id IS NULL AND is_system = true}) : source primaire.
 *       Permet aux super-admins Clenzy d'editer le wording standard sans release.</li>
 *   <li><b>Fallback YAML</b> ({@code resources/whatsapp-templates/*.yaml}) : si
 *       la BDD est vide (cas test sans migration ou bootstrap rate), on retombe
 *       sur les fichiers historiques.</li>
 * </ol>
 *
 * <h3>Conversion format</h3>
 * Les contenus BDD sont stockes au format nomme ({@code "{guestFirstName}"}). Au
 * chargement, on les convertit en format positionnel ({@code "{{1}}"}) via
 * {@link WhatsAppVariableConverter} pour rester compatible avec {@link MetaTemplateProvisioner}
 * qui pousse a Meta Cloud API (format positionnel requis).
 *
 * <h3>Format YAML attendu (fallback)</h3>
 * <pre>
 * key: booking_confirmation
 * category: UTILITY
 * languages:
 *   fr_FR:
 *     body: "Bonjour {{1}}, ..."
 *   en_US:
 *     body: "Hello {{1}}, ..."
 * </pre>
 *
 * <h3>Resilience</h3>
 * <ul>
 *   <li>Si la BDD est inaccessible (cas test JPA sans schema) → fallback YAML.</li>
 *   <li>Si un fichier YAML est mal forme → warning, autres templates valides
 *       restent dispo.</li>
 *   <li>Si conversion converter rate sur une ligne BDD → warning + skip cette
 *       ligne (les autres langues du meme template restent).</li>
 * </ul>
 */
@Component
public class WhatsAppTemplateLoader {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppTemplateLoader.class);
    private static final String TEMPLATES_PATTERN = "classpath:whatsapp-templates/*.yaml";

    // SnakeYAML est deja dispo transitivement via spring-boot-starter (utilise
    // pour parser application.yml). On l'utilise direct, pas besoin d'ajouter
    // jackson-dataformat-yaml au pom.
    private final Yaml yamlParser = new Yaml();

    // Injection optionnelle : Spring fournit ces beans en runtime normal, mais
    // les tests unitaires qui instancient le loader directement (cf.
    // WhatsAppTemplateLoaderTest) n'ont pas de contexte Spring. Dans ce cas,
    // le loader tombe sur le fallback YAML.
    private final WhatsAppTemplateContentRepository repository;
    private final WhatsAppVariableConverter converter;

    private List<WhatsAppTemplateDefinition> templates = Collections.emptyList();

    /**
     * Constructeur Spring : injection BDD + converter pour mode primaire.
     */
    @Autowired
    public WhatsAppTemplateLoader(WhatsAppTemplateContentRepository repository,
                                    WhatsAppVariableConverter converter) {
        this.repository = repository;
        this.converter = converter;
    }

    /**
     * Constructeur sans dependance : mode fallback YAML uniquement. Utilise par
     * les tests unitaires existants ({@link WhatsAppTemplateLoaderTest}) pour
     * valider le parsing YAML sans avoir besoin d'un contexte Spring complet.
     */
    public WhatsAppTemplateLoader() {
        this.repository = null;
        this.converter = null;
    }

    @PostConstruct
    public void load() {
        // 1. Tenter la BDD si on a les dependances injectees
        if (repository != null && converter != null) {
            try {
                List<WhatsAppTemplateDefinition> fromDb = loadFromDatabase();
                if (!fromDb.isEmpty()) {
                    this.templates = Collections.unmodifiableList(fromDb);
                    log.info("{} templates WhatsApp Clenzy charges depuis la BDD", fromDb.size());
                    return;
                }
                log.info("BDD vide pour whatsapp_template_content — fallback sur les YAML");
            } catch (Exception e) {
                log.warn("Echec chargement BDD whatsapp_template_content ({}), fallback YAML",
                    e.getMessage());
            }
        }

        // 2. Fallback : scan YAML (comportement historique)
        loadFromYaml();
    }

    /**
     * Charge les templates depuis la table {@code whatsapp_template_content}
     * (lignes systeme uniquement). Convertit chaque body_named en body_meta
     * positionnel pour rester compatible avec le contrat existant.
     */
    private List<WhatsAppTemplateDefinition> loadFromDatabase() {
        List<WhatsAppTemplateContent> rows = repository.findAllSystemTemplates();

        // Group par template_key → map<language, body_meta>
        Map<String, WhatsAppTemplateDefinition> byKey = new LinkedHashMap<>();
        for (WhatsAppTemplateContent row : rows) {
            try {
                var conversion = converter.toPositional(row.getBodyNamed());

                WhatsAppTemplateDefinition existing = byKey.get(row.getTemplateKey());
                Map<String, WhatsAppTemplateDefinition.LanguageBody> languages;
                if (existing == null) {
                    languages = new HashMap<>();
                } else {
                    languages = new HashMap<>(existing.languages());
                }
                languages.put(row.getLanguage(),
                    new WhatsAppTemplateDefinition.LanguageBody(conversion.metaBody()));

                byKey.put(row.getTemplateKey(),
                    new WhatsAppTemplateDefinition(row.getTemplateKey(), row.getCategory(), languages));
            } catch (Exception e) {
                log.warn("Echec conversion body_named pour template {}/{} : {} — skip cette langue",
                    row.getTemplateKey(), row.getLanguage(), e.getMessage());
            }
        }

        List<WhatsAppTemplateDefinition> loaded = new ArrayList<>(byKey.values());
        for (var def : loaded) {
            log.info("Template WhatsApp charge depuis BDD : {} ({} langues)",
                def.key(), def.languages().size());
        }
        return loaded;
    }

    private void loadFromYaml() {
        try {
            PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
            Resource[] resources = resolver.getResources(TEMPLATES_PATTERN);

            List<WhatsAppTemplateDefinition> loaded = new ArrayList<>();
            for (Resource resource : resources) {
                String filename = resource.getFilename();
                try (InputStream is = resource.getInputStream()) {
                    Map<String, Object> raw = yamlParser.load(is);
                    WhatsAppTemplateDefinition def = parse(raw, filename);
                    if (def != null) {
                        loaded.add(def);
                        log.info("Template WhatsApp charge (YAML fallback) : {} ({} langues)",
                            def.key(), def.languages().size());
                    }
                } catch (Exception e) {
                    log.warn("Echec parsing template WhatsApp {} : {}", filename, e.getMessage());
                }
            }
            this.templates = Collections.unmodifiableList(loaded);
            log.info("{} templates WhatsApp Clenzy charges depuis YAML", loaded.size());
        } catch (Exception e) {
            log.error("Erreur scan templates WhatsApp: {}", e.getMessage());
        }
    }

    /**
     * Force le rechargement depuis la BDD. Appele quand un super-admin Clenzy
     * edite un template systeme (les autres orgs verront immediatement le
     * nouveau contenu au prochain envoi). Best-effort si la BDD echoue.
     */
    public synchronized void reloadFromDatabase() {
        if (repository == null || converter == null) {
            log.warn("reloadFromDatabase() appele sans dependances injectees — no-op");
            return;
        }
        try {
            List<WhatsAppTemplateDefinition> fromDb = loadFromDatabase();
            if (!fromDb.isEmpty()) {
                this.templates = Collections.unmodifiableList(fromDb);
                log.info("Rechargement BDD WhatsApp templates : {} templates", fromDb.size());
            }
        } catch (Exception e) {
            log.warn("Echec reloadFromDatabase : {} — l'ancien cache reste actif", e.getMessage());
        }
    }

    /**
     * Retourne la liste immuable des templates charges.
     */
    public List<WhatsAppTemplateDefinition> getAllTemplates() {
        return templates;
    }

    @SuppressWarnings("unchecked")
    private WhatsAppTemplateDefinition parse(Map<String, Object> raw, String filename) {
        String key = (String) raw.get("key");
        String category = (String) raw.get("category");
        Object languagesObj = raw.get("languages");

        if (key == null || key.isBlank()) {
            log.warn("Template {} skippe : champ 'key' manquant", filename);
            return null;
        }
        if (category == null || category.isBlank()) {
            log.warn("Template {} skippe : champ 'category' manquant", filename);
            return null;
        }
        if (!(languagesObj instanceof Map)) {
            log.warn("Template {} skippe : champ 'languages' invalide", filename);
            return null;
        }

        Map<String, Object> rawLanguages = (Map<String, Object>) languagesObj;
        Map<String, WhatsAppTemplateDefinition.LanguageBody> languages = new HashMap<>();
        for (Map.Entry<String, Object> entry : rawLanguages.entrySet()) {
            if (!(entry.getValue() instanceof Map)) continue;
            Map<String, Object> langData = (Map<String, Object>) entry.getValue();
            String body = (String) langData.get("body");
            if (body == null || body.isBlank()) {
                log.warn("Template {} langue {} skippee : body vide", key, entry.getKey());
                continue;
            }
            languages.put(entry.getKey(), new WhatsAppTemplateDefinition.LanguageBody(body));
        }

        if (languages.isEmpty()) {
            log.warn("Template {} skippe : aucune langue valide", key);
            return null;
        }

        return new WhatsAppTemplateDefinition(key, category, languages);
    }
}
