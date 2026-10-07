package com.clenzy.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Smoke test du rendu reel : les 8 templates embarques se remplissent via le
 * moteur HTML/Freemarker tel qu'utilise en prod
 * ({@code DocumentGeneratorService.fillTemplate}) — directives equilibrees,
 * expressions resolvables, boucle de lignes fonctionnelle.
 *
 * <p>Garde-fou : une refonte de template qui casserait la generation PDF
 * (directive Freemarker invalide, balise mal fermee) fait echouer ce test
 * avant tout deploiement.</p>
 */
@DisplayName("Seed document templates — rendu HTML")
class SeedTemplateXDocReportSmokeTest {

    /** Les 7 templates au modele "intervention" (meme jeu de tags que la facture). */
    private static final List<String> INTERVENTION_TEMPLATES = List.of(
            "facture-baitly", "autorisation-travaux-baitly", "bon-intervention-baitly",
            "justificatif-paiement-baitly", "justificatif-remboursement-baitly",
            "mandat-gestion-baitly", "validation-fin-mission-baitly");

    @Test
    @DisplayName("les 7 templates type-intervention se remplissent sans erreur Freemarker")
    void interventionTemplates_fillWithoutError() throws Exception {
        for (String slug : INTERVENTION_TEMPLATES) {
            assertValidHtml(fill("seed/document-templates/" + slug + ".html", interventionModel()), slug);
        }
    }

    @Test
    @DisplayName("devis-baitly.html se remplit sans erreur Freemarker")
    void devisTemplate_fillsWithoutError() throws Exception {
        assertValidHtml(fill("seed/document-templates/devis-baitly.html", devisModel()), "devis-baitly");
    }

    @Test
    @DisplayName("devis-menage-baitly.html se remplit sans erreur Freemarker")
    void devisMenageTemplate_fillsWithoutError() throws Exception {
        assertValidHtml(fill("seed/document-templates/devis-menage-baitly.html", menageModel()), "devis-menage-baitly");
    }

    /** Reproduit fidelement DocumentGeneratorService.fillTemplate (moteur Freemarker, put direct). */
    private static byte[] fill(String resourcePath, Map<String, Object> model) throws Exception {
        try (InputStream is = new ClassPathResource(resourcePath).getInputStream()) {
            return new com.clenzy.service.DocumentTemplateRenderer(null).fillTemplate(is.readAllBytes(), model);
        }
    }

    private static void assertValidHtml(byte[] out, String slug) {
        String html = new String(out, java.nio.charset.StandardCharsets.UTF_8);
        assertThat(org.jsoup.Jsoup.parse(html).body().text()).as("template %s", slug).contains("Baitly");
        assertThat(html).doesNotContain("${", "[#list", "[#if");
        com.clenzy.service.BaitlyHtmlTemplates.validateResources(html);
    }

    private static Map<String, Object> interventionModel() {
        List<Map<String, Object>> lignes = List.of(
                Map.of("description", "Menage", "quantite", "1",
                        "prix_unitaire", "100 EUR", "total", "100 EUR"));
        return Map.ofEntries(
            Map.entry("entreprise", Map.of("nom", "Baitly", "adresse", "12 rue X, 75001 Paris",
                    "siret", "12345678900012", "email", "info@clenzy.fr", "telephone", "07 49 24 54 66")),
            Map.entry("client", Map.of("nom_complet", "Toufik Mazy", "societe", "Acme", "email", "t@x.fr",
                    "telephone", "06 00 00 00 00", "code_postal", "75001", "ville", "Paris")),
            Map.entry("property", Map.of("nom", "Appartement Paris", "adresse", "1 rue Y", "code_postal", "75001",
                    "ville", "Paris", "type", "Appartement", "surface", "110")),
            Map.entry("intervention", Map.ofEntries(
                    Map.entry("id", "123"), Map.entry("titre", "Menage complet"),
                    Map.entry("description", "Menage + linge"), Map.entry("type", "MENAGE"),
                    Map.entry("statut", "COMPLETED"), Map.entry("date_debut", "01/06/2026"),
                    Map.entry("date_fin", "01/06/2026"), Map.entry("date_completion", "01/06/2026"),
                    Map.entry("duree_reelle", "3h"), Map.entry("cout_estime", "90 EUR"),
                    Map.entry("cout_reel", "100 EUR"), Map.entry("notes", "RAS"),
                    Map.entry("notes_technicien", "OK"),
                    // intervention.lignes : encore utilise par les 6 autres templates type-intervention.
                    Map.entry("lignes", lignes))),
            // lignes (top-level) + has_intervention/has_technicien : alimentent le nouveau
            // facture-baitly.html ([#list lignes] + guards [#if has_intervention]/[#if has_technicien]).
            // fill() ne passe pas par fillMissingTags : on fournit ces cles a la main.
            Map.entry("lignes", lignes),
            Map.entry("has_intervention", true),
            Map.entry("has_technicien", true),
            Map.entry("technicien", Map.of("nom_complet", "Jean Tech", "email", "jean@x.fr", "telephone", "06 11 11 11 11")),
            Map.entry("paiement", Map.of("statut", "Paye", "montant", "100 EUR",
                    "date_paiement", "02/06/2026", "reference_stripe", "pi_123")),
            Map.entry("nf", Map.of("conditions_paiement", "Paiement a 30 jours",
                    "legal_mention_1", "TVA non applicable, art. 293 B du CGI",
                    "legal_mention_2", "Penalites de retard : 3x taux legal")),
            Map.entry("system", Map.of("numero_auto", "DOC-2026-001", "date", "03/06/2026")));
    }

    private static Map<String, Object> menageModel() {
        return Map.of(
            "entreprise", Map.of("nom", "Baitly", "adresse", "12 rue X", "siret", "123",
                    "email", "info@clenzy.fr", "telephone", "07 49 24 54 66"),
            "client", Map.of("nom_complet", "Toufik Mazy", "email", "t@x.fr", "telephone", "06 00 00 00 00"),
            "property", Map.of("nom", "Duplex Marrakech", "adresse", "1 rue Y", "code_postal", "40000",
                    "ville", "Marrakech", "surface", "50 m²", "chambres", "2", "salles_bain", "1"),
            "menage", Map.ofEntries(
                    Map.entry("express_prix", "60 €"), Map.entry("express_fourchette", "50 € – 70 €"),
                    Map.entry("express_duree", "2 h 15"),
                    Map.entry("standard_prix", "95 €"), Map.entry("standard_fourchette", "80 € – 110 €"),
                    Map.entry("standard_duree", "2 h 15"),
                    Map.entry("deep_prix", "150 €"), Map.entry("deep_fourchette", "130 € – 175 €"),
                    Map.entry("deep_duree", "2 h 15"),
                    Map.entry("decomposition", "Base (chambres) : 120 min · Étages supplémentaires : 15 min"),
                    Map.entry("taux_horaire", "42 €/h")),
            "system", Map.of("numero_auto", "DM-2026-001", "date", "10/07/2026"));
    }

    private static Map<String, Object> devisModel() {
        return Map.of(
            "entreprise", Map.of("nom", "Baitly", "adresse", "12 rue X", "siret", "123",
                    "email", "info@clenzy.fr", "telephone", "07 49 24 54 66"),
            "client", Map.of("nom_complet", "Toufik Mazy", "societe", "Acme", "email", "t@x.fr",
                    "telephone", "06 00 00 00 00", "code_postal", "75001", "ville", "Paris"),
            "property", Map.of("nom", "Appartement", "adresse", "1 rue Y", "code_postal", "75001",
                    "ville", "Paris", "type", "Appartement", "surface", "110"),
            "demande", Map.of("titre", "Devis menage", "type_service", "MENAGE", "priorite", "NORMALE",
                    "date_souhaitee", "10/06/2026", "creneau", "Matin",
                    "description", "Menage regulier", "cout_estime", "Sur demande"),
            "intervention", Map.of("lignes", List.of(
                    Map.of("description", "Menage", "quantite", "1",
                            "prix_unitaire", "Sur devis", "total", "Sur devis"))),
            "nf", Map.of("numero", "DEV-001", "date", "03/06/2026",
                    "conditions_paiement", "Acompte 30%", "validite", "Validite 30 jours"));
    }
}
