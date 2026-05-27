package com.clenzy.service.agent.briefing;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Charge les templates HTML d'email depuis le classpath et fait l'interpolation
 * naive des placeholders {@code {{key}}}.
 *
 * <h3>Pourquoi pas MJML</h3>
 * MJML est un format de description haut niveau qui se compile en HTML
 * responsive avec table-based layout (pour compatibilite Outlook). Ajouter
 * une dependance JS-pure (Node + npm via wrapper Java) ou la lib
 * {@code com.github.maxiomtech:mjml-java} alourdit le build (transitive ~400KB
 * + native dep), pour un seul template. On a opte pour un HTML responsive
 * ecrit a la main, avec table-based layout, inline-style + media-query CSS pour
 * les clients modernes. Suffisant tant qu'on a 1-2 templates simples.
 *
 * <p>Si le besoin grandit (plusieurs templates avec composants partages,
 * branding par org), basculer vers MJML deviendra justifie.</p>
 */
@Component
public class EmailTemplateLoader {

    private static final Logger log = LoggerFactory.getLogger(EmailTemplateLoader.class);
    private static final String BRIEFING_TEMPLATE_PATH = "email-templates/briefing.html";

    private String briefingTemplate;

    @PostConstruct
    void load() {
        this.briefingTemplate = readClasspath(BRIEFING_TEMPLATE_PATH);
        if (briefingTemplate == null) {
            log.warn("EmailTemplateLoader: '{}' introuvable, fallback HTML inline sera utilise",
                    BRIEFING_TEMPLATE_PATH);
        } else {
            log.info("EmailTemplateLoader: '{}' charge ({} chars)",
                    BRIEFING_TEMPLATE_PATH, briefingTemplate.length());
        }
    }

    /**
     * Interpole les variables {@code {{key}}} dans le template briefing.
     * Retourne null si le template n'a pas pu etre charge — le caller fait
     * fallback sur l'ancien HTML inline.
     */
    public String renderBriefing(Map<String, String> vars) {
        if (briefingTemplate == null) return null;
        String rendered = briefingTemplate;
        for (Map.Entry<String, String> e : vars.entrySet()) {
            String token = "{{" + e.getKey() + "}}";
            String value = e.getValue() != null ? e.getValue() : "";
            rendered = rendered.replace(token, value);
        }
        return rendered;
    }

    private static String readClasspath(String path) {
        ClassPathResource resource = new ClassPathResource(path);
        if (!resource.exists()) return null;
        try (InputStream is = resource.getInputStream()) {
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            return null;
        }
    }
}
