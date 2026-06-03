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
 * Smoke test du rendu reel : les templates embarques (devis, facture) sont
 * valides pour le moteur XDocReport/Freemarker tel qu'utilise en prod
 * ({@code DocumentGeneratorService.fillTemplate}) — directives equilibrees,
 * expressions resolvables, boucle de lignes fonctionnelle.
 *
 * <p>Garde-fou : une refonte de template qui casserait la generation PDF
 * (directive Freemarker invalide, balise mal fermee) fait echouer ce test
 * avant tout deploiement.</p>
 */
@DisplayName("Seed document templates — rendu XDocReport")
class SeedTemplateXDocReportSmokeTest {

    @Test
    @DisplayName("facture-clenzy.odt se remplit sans erreur Freemarker")
    void factureTemplate_fillsWithoutError() throws Exception {
        assertValidOdt(fill("seed/document-templates/facture-clenzy.odt", factureModel()));
    }

    @Test
    @DisplayName("devis-clenzy.odt se remplit sans erreur Freemarker")
    void devisTemplate_fillsWithoutError() throws Exception {
        assertValidOdt(fill("seed/document-templates/devis-clenzy.odt", devisModel()));
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

    private static void assertValidOdt(byte[] out) {
        assertThat(out).isNotEmpty();
        // En-tete ZIP "PK" => archive ODT valide produite.
        assertThat(new String(out, 0, 2)).isEqualTo("PK");
    }

    private static Map<String, Object> factureModel() {
        return Map.of(
            "entreprise", Map.of("nom", "Clenzy", "adresse", "12 rue X, 75001 Paris",
                    "siret", "12345678900012", "email", "info@clenzy.fr", "telephone", "07 49 24 54 66"),
            "client", Map.of("nom_complet", "Toufik Mazy", "societe", "Acme", "email", "t@x.fr",
                    "telephone", "06 00 00 00 00", "code_postal", "75001", "ville", "Paris"),
            "property", Map.of("nom", "Appartement Paris", "adresse", "1 rue Y", "code_postal", "75001",
                    "ville", "Paris", "type", "Appartement", "surface", "110"),
            "intervention", Map.ofEntries(
                    Map.entry("id", "123"), Map.entry("titre", "Menage complet"),
                    Map.entry("description", "Menage + linge"), Map.entry("type", "MENAGE"),
                    Map.entry("statut", "COMPLETED"), Map.entry("date_debut", "01/06/2026"),
                    Map.entry("date_fin", "01/06/2026"), Map.entry("date_completion", "01/06/2026"),
                    Map.entry("duree_reelle", "3h"), Map.entry("cout_estime", "90 EUR"),
                    Map.entry("cout_reel", "100 EUR"), Map.entry("notes", "RAS"),
                    Map.entry("notes_technicien", "OK"),
                    Map.entry("lignes", List.of(
                            Map.of("description", "Menage", "quantite", "1",
                                    "prix_unitaire", "100 EUR", "total", "100 EUR")))),
            "technicien", Map.of("nom_complet", "Jean Tech", "email", "jean@x.fr", "telephone", "06 11 11 11 11"),
            "paiement", Map.of("statut", "Paye", "montant", "100 EUR",
                    "date_paiement", "02/06/2026", "reference_stripe", "pi_123"),
            "nf", Map.of("conditions_paiement", "Paiement a 30 jours",
                    "legal_mention_1", "TVA non applicable, art. 293 B du CGI",
                    "legal_mention_2", "Penalites de retard : 3x taux legal"),
            "system", Map.of("numero_auto", "F-2026-001", "date", "03/06/2026"));
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
