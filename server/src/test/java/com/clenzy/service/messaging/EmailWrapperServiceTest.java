package com.clenzy.service.messaging;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EmailWrapperServiceTest {

    private final EmailWrapperService service = new EmailWrapperService();

    @Nested
    @DisplayName("sanitisation au rendu (stored XSS — Z7-SEC-01)")
    class RenderSanitization {

        @Test
        void whenBodyContainsScript_thenScriptAbsentFromRenderedEmail() {
            // Arrange — override malveillant stocke avant la sanitisation au stockage
            String body = "Bonjour,\n\n<script>alert('xss')</script>Texte legitime.";

            // Act
            String html = service.wrap("NOTIFICATION_OWNER", body);

            // Assert
            assertThat(html.toLowerCase()).doesNotContain("<script");
            assertThat(html).contains("Texte legitime.");
        }

        @Test
        void whenBodyContainsImgOnerror_thenHandlerStripped() {
            String html = service.wrap("NOTIFICATION_GUEST",
                "Bienvenue <img src=\"https://x.com/logo.png\" onerror=\"alert(1)\"> chez nous");

            assertThat(html.toLowerCase()).doesNotContain("onerror");
            assertThat(html).contains("src=\"https://x.com/logo.png\"");
        }

        @Test
        void whenBodyContainsJavascriptLink_thenHrefRemoved() {
            String html = service.wrap("NOTIFICATION_OWNER",
                "<p><a href=\"javascript:alert(1)\">cliquez ici</a></p>");

            assertThat(html.toLowerCase()).doesNotContain("javascript:");
            assertThat(html).contains("cliquez ici");
        }

        @Test
        void whenBodyContainsIframe_thenIframeRemoved() {
            String html = service.wrap("NOTIFICATION_GUEST",
                "Texte\n\n<iframe src=\"https://evil.example\"></iframe>\n\nFin");

            assertThat(html.toLowerCase()).doesNotContain("<iframe");
            assertThat(html).contains("Texte").contains("Fin");
        }
    }

    @Nested
    @DisplayName("rendu legitime non casse")
    class LegitRendering {

        @Test
        void whenPlainTextWithMarkdown_thenParagraphsAndBoldRendered() {
            String html = service.wrap("NOTIFICATION_OWNER",
                "Bonjour *Jean*,\n\nLigne 1\nLigne 2");

            assertThat(html).contains("<strong>Jean</strong>");
            assertThat(html).contains("Ligne 1<br>Ligne 2");
        }

        @Test
        void whenTrustedHtmlBlockInjected_thenPreservedVerbatim() {
            // Arrange — bloc {detailsHtml} pre-rendu cote Java (table + styles inline)
            String details = "<div style=\"background:#f8f9fa;\"><table cellpadding=\"0\">"
                + "<tr><td style=\"color:#334155;\">Nom</td><td>Jean</td></tr></table></div>";

            String html = service.wrap("INTERNAL_FORM", "Nouvelle demande :\n\n" + details);

            // La sanitisation jsoup re-serialise le bloc en sa forme normalisee :
            // <tbody> implicite materialise. Structure, styles inline et contenu
            // conserves a l'identique (aucun construct dangereux ici a retirer).
            String normalized = "<div style=\"background:#f8f9fa;\"><table cellpadding=\"0\">"
                + "<tbody><tr><td style=\"color:#334155;\">Nom</td><td>Jean</td></tr></tbody></table></div>";
            assertThat(html).contains(normalized);
        }

        @Test
        void whenInvitationWithCta_thenButtonRendered() {
            String html = service.wrap("INVITATION",
                "Rejoins l'equipe.\n\n[ACCEPTER → https://app.clenzy.fr/invite/abc]");

            assertThat(html).contains("href=\"https://app.clenzy.fr/invite/abc\"");
            assertThat(html).contains("ACCEPTER");
        }

        @Test
        void whenBulletList_thenRenderedAsUl() {
            String html = service.wrap("NOTIFICATION_GUEST",
                "Regles de la maison :\n- Pas de bruit apres 22h\n- Tri des dechets");

            assertThat(html).contains("<ul").contains("<li").contains("Pas de bruit apres 22h");
        }
    }
}
