package com.clenzy.booking.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Audit 2026-07 (P9-01) — XSS stocke sur les pages de site.
 *
 * <p>{@code applyPage} persistait {@code req.blocks()} tel quel : le seul rempart avant
 * rendu public etait {@code sanitizeHtml.ts} cote client, un filtre par expressions
 * regulieres contournable (il exige un espace avant {@code on...} et des guillemets
 * autour des URL). Les services voisins ({@code SiteGenerationService},
 * {@code SiteTemplateService}, {@code SiteRefinementService}) assainissent tous leur HTML
 * via {@link com.clenzy.util.EmailHtmlSanitizer} — seule l'ecriture directe par l'API
 * d'administration ne le faisait pas.</p>
 *
 * <p>Ces tests portent sur le helper d'assainissement de l'enveloppe GrapesJS plutot que
 * sur {@code updatePage} : c'est la ou vit la logique, et cela evite de monter les neuf
 * dependances du service pour prouver une transformation de chaine.</p>
 */
class SiteAdminServiceTest {

    /** Payloads issus de l'audit : ils traversent le sanitizer regex du front. */
    private static final String EVENT_HANDLER_BYPASS = "<img/onerror=alert(1) src=x>";
    private static final String JS_URL_BYPASS = "<a href=javascript:alert(1)>Reserver</a>";

    private static String envelope(String html) {
        return "{\"format\":\"grapes-v1\",\"html\":" + quote(html) + ",\"css\":\"\",\"projectData\":null}";
    }

    private static String quote(String raw) {
        return "\"" + raw.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }

    @Nested
    @DisplayName("sanitizeGrapesEnvelope")
    class SanitizeGrapesEnvelope {

        @Test
        @DisplayName("supprime les handlers d'evenement que la regex du front laisse passer")
        void stripsEventHandlerBypass() {
            String result = SiteAdminService.sanitizeGrapesEnvelope(envelope(EVENT_HANDLER_BYPASS));

            assertThat(result)
                    .as("le handler onerror doit disparaitre de l'enveloppe persistee")
                    .doesNotContain("onerror");
        }

        @Test
        @DisplayName("supprime les URL javascript: non quotees")
        void stripsJavascriptUrlBypass() {
            String result = SiteAdminService.sanitizeGrapesEnvelope(envelope(JS_URL_BYPASS));

            assertThat(result).doesNotContain("javascript:");
        }

        @Test
        @DisplayName("supprime les balises script")
        void stripsScriptTags() {
            String result = SiteAdminService.sanitizeGrapesEnvelope(
                    envelope("<div><script>fetch('/api/users')</script>Bienvenue</div>"));

            assertThat(result).doesNotContain("<script");
        }

        @Test
        @DisplayName("preserve le contenu legitime et la structure de l'enveloppe")
        void keepsLegitimateContentAndEnvelopeShape() {
            String result = SiteAdminService.sanitizeGrapesEnvelope(
                    envelope("<h1>Villa Palmeraie</h1><a href=\"/reserver\">Reserver</a>"));

            assertThat(result)
                    .as("le markup legitime doit survivre")
                    .contains("Villa Palmeraie")
                    .contains("/reserver");
            assertThat(result)
                    .as("l'enveloppe GrapesJS doit rester exploitable par l'editeur et le rendu public")
                    .contains("\"format\"")
                    .contains("\"html\"")
                    .contains("\"css\"");
        }

        @Test
        @DisplayName("laisse passer null et vide sans lever")
        void passesThroughNullAndBlank() {
            assertThat(SiteAdminService.sanitizeGrapesEnvelope(null)).isNull();
            assertThat(SiteAdminService.sanitizeGrapesEnvelope("")).isEmpty();
        }

        /**
         * Une page pré-existante peut porter un {@code blocks} qui n'est pas une enveloppe
         * JSON (contenu legacy). On ne doit ni lever ni corrompre la donnee : le contenu est
         * alors traite comme du HTML et assaini tel quel.
         */
        @Test
        @DisplayName("traite un contenu non-JSON comme du HTML sans lever")
        void handlesNonJsonBlocksAsHtml() {
            String result = SiteAdminService.sanitizeGrapesEnvelope("<div>legacy" + EVENT_HANDLER_BYPASS + "</div>");

            assertThat(result).doesNotContain("onerror");
            assertThat(result).contains("legacy");
        }
    }
}
