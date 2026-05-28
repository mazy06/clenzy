package com.clenzy.service.messaging.whatsapp;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;
import org.yaml.snakeyaml.Yaml;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Charge les templates Clenzy standards depuis {@code resources/whatsapp-templates/*.yaml}
 * au boot Spring. Expose une liste immuable accessible via {@link #getAllTemplates()}.
 *
 * <h3>Format YAML attendu</h3>
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
 * Si un fichier YAML est mal forme ou manque un champ requis, on logue
 * une warning mais on ne fait pas crasher le boot — les autres templates
 * valides restent disponibles. Le {@link MetaTemplateProvisioner} skippera
 * les templates manquants.
 */
@Component
public class WhatsAppTemplateLoader {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppTemplateLoader.class);
    private static final String TEMPLATES_PATTERN = "classpath:whatsapp-templates/*.yaml";

    // SnakeYAML est deja dispo transitivement via spring-boot-starter (utilise
    // pour parser application.yml). On l'utilise direct, pas besoin d'ajouter
    // jackson-dataformat-yaml au pom.
    private final Yaml yamlParser = new Yaml();
    private List<WhatsAppTemplateDefinition> templates = Collections.emptyList();

    @PostConstruct
    public void load() {
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
                        log.info("Template WhatsApp charge : {} ({} langues)",
                            def.key(), def.languages().size());
                    }
                } catch (Exception e) {
                    log.warn("Echec parsing template WhatsApp {} : {}", filename, e.getMessage());
                }
            }
            this.templates = Collections.unmodifiableList(loaded);
            log.info("{} templates WhatsApp Clenzy charges au boot", loaded.size());
        } catch (Exception e) {
            log.error("Erreur scan templates WhatsApp: {}", e.getMessage());
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
