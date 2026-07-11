package com.clenzy.config;

import fr.opensagres.xdocreport.document.IXDocReport;
import fr.opensagres.xdocreport.document.registry.XDocReportRegistry;
import fr.opensagres.xdocreport.template.IContext;
import fr.opensagres.xdocreport.template.TemplateEngineKind;
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
 * moteur XDocReport/Freemarker tel qu'utilise en prod
 * ({@code DocumentGeneratorService.fillTemplate}) — directives equilibrees,
 * expressions resolvables, boucle de lignes fonctionnelle.
 *
 * <p>Garde-fou : une refonte de template qui casserait la generation PDF
 * (directive Freemarker invalide, balise mal fermee) fait echouer ce test
 * avant tout deploiement.</p>
 */
@DisplayName("Seed document templates — rendu XDocReport")
class SeedTemplateXDocReportSmokeTest {

    /** Les 7 templates au modele "intervention" (meme jeu de tags que la facture). */
    private static final List<String> INTERVENTION_TEMPLATES = List.of(
            "facture-clenzy", "autorisation-travaux-clenzy", "bon-intervention-clenzy",
            "justificatif-paiement-clenzy", "justificatif-remboursement-clenzy",
            "mandat-gestion-clenzy", "validation-fin-mission-clenzy");

    @Test
    @DisplayName("les 7 templates type-intervention se remplissent sans erreur Freemarker")
    void interventionTemplates_fillWithoutError() throws Exception {
        for (String slug : INTERVENTION_TEMPLATES) {
            assertValidOdt(fill("seed/document-templates/" + slug + ".odt", interventionModel()), slug);
        }
    }

    @Test
    @DisplayName("devis-clenzy.odt se remplit sans erreur Freemarker")
    void devisTemplate_fillsWithoutError() throws Exception {
        assertValidOdt(fill("seed/document-templates/devis-clenzy.odt", devisModel()), "devis-clenzy");
    }

    @Test
    @DisplayName("devis-menage-clenzy.odt se remplit sans erreur Freemarker")
    void devisMenageTemplate_fillsWithoutError() throws Exception {
        assertValidOdt(fill("seed/document-templates/devis-menage-clenzy.odt", menageModel()), "devis-menage-clenzy");
    }

    /** Reproduit fidelement DocumentGeneratorService.fillTemplate (moteur Freemarker, put direct). */
    private static byte[] fill(String resourcePath, Map<String, Object> model) throws Exception {
        try (InputStream is = new ClassPathResource(resourcePath).getInputStream()) {
            IXDocReport report = XDocReportRegistry.getRegistry().loadReport(is, TemplateEngineKind.Freemarker);
            IContext context = report.createContext();
            model.forEach(context::put);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            report.process(context, out);
            return out.toByteArray();
        }
    }

    private static void assertValidOdt(byte[] out, String slug) {
        assertThat(out).as("template %s produit un document", slug).isNotEmpty();
        // En-tete ZIP "PK" => archive ODT valide produite.
        assertThat(new String(out, 0, 2)).as("template %s est une archive ODT", slug).isEqualTo("PK");
    }

    private static Map<String, Object> interventionModel() {
        List<Map<String, Object>> lignes = List.of(
                Map.of("description", "Menage", "quantite", "1",
                        "prix_unitaire", "100 EUR", "total", "100 EUR"));
        return Map.ofEntries(
            Map.entry("entreprise", Map.of("nom", "Clenzy", "adresse", "12 rue X, 75001 Paris",
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
            // facture-clenzy.odt ([#list lignes] + guards [#if has_intervention]/[#if has_technicien]).
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
            "entreprise", Map.of("nom", "Clenzy", "adresse", "12 rue X", "siret", "123",
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
            "entreprise", Map.of("nom", "Clenzy", "adresse", "12 rue X", "siret", "123",
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
