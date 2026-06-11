package com.clenzy.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EmailHtmlSanitizerTest {

    @Nested
    @DisplayName("contenu legitime preserve")
    class LegitContent {

        @Test
        void whenNullOrEmpty_thenReturnedAsIs() {
            assertThat(EmailHtmlSanitizer.sanitize(null)).isNull();
            assertThat(EmailHtmlSanitizer.sanitize("")).isEmpty();
        }

        @Test
        void whenPlainTextWithMarkdownAndNewlines_thenByteIdentical() {
            // Arrange — body typique d'un template plain text (variables, markdown, puces)
            String body = "Bonjour {guestName},\n\n*Important* : prix < 100 & > 50.\n"
                + "- regle 1\n- regle 2\n\n_Merci_ de votre sejour.";

            // Act
            String result = EmailHtmlSanitizer.sanitize(body);

            // Assert
            assertThat(result).isEqualTo(body);
        }

        @Test
        void whenLegitEmailHtmlBlock_thenPreservedVerbatim() {
            // Arrange — bloc table/div avec styles inline (cas {detailsHtml})
            String body = "<div style=\"background:#f8f9fa;padding:16px;\">"
                + "<table cellpadding=\"0\" cellspacing=\"0\"><tr>"
                + "<td style=\"color:#334155;\">Nom</td><td>Jean</td>"
                + "</tr></table>"
                + "<a href=\"https://app.clenzy.fr/contracts\">Voir le contrat</a></div>";

            String result = EmailHtmlSanitizer.sanitize(body);

            assertThat(result).isEqualTo(body);
        }

        @Test
        void whenHttpsLinkWithQueryParams_thenPreserved() {
            String body = "<a href=\"https://x.com/page?onboarding=true&data=1\">lien</a>";

            assertThat(EmailHtmlSanitizer.sanitize(body)).isEqualTo(body);
        }
    }

    @Nested
    @DisplayName("constructs dangereux supprimes")
    class DangerousContent {

        @Test
        void whenScriptElement_thenRemovedWithContent() {
            String result = EmailHtmlSanitizer.sanitize(
                "avant<script>alert('xss')</script>apres");

            assertThat(result).isEqualTo("avantapres");
        }

        @Test
        void whenScriptWithAttributes_thenRemoved() {
            String result = EmailHtmlSanitizer.sanitize(
                "x<script src=\"https://evil.com/x.js\" defer></script>y");

            assertThat(result.toLowerCase()).doesNotContain("<script");
            assertThat(result).contains("x").contains("y");
        }

        @Test
        void whenNestedScriptBypass_thenNeutralized() {
            // Payload classique de contournement par imbrication
            String result = EmailHtmlSanitizer.sanitize(
                "<scr<script>ipt>alert(1)</scr</script>ipt>");

            assertThat(result.toLowerCase()).doesNotContain("<script");
            assertThat(result.toLowerCase()).doesNotContain("alert(1)");
        }

        @Test
        void whenIframeObjectEmbed_thenRemoved() {
            String result = EmailHtmlSanitizer.sanitize(
                "a<iframe src=\"https://evil.com\"></iframe>"
                + "b<object data=\"x\"></object>"
                + "c<embed src=\"x.swf\">d");

            assertThat(result.toLowerCase())
                .doesNotContain("<iframe").doesNotContain("<object").doesNotContain("<embed");
            assertThat(result).isEqualTo("abcd");
        }

        @Test
        void whenImgOnerror_thenAttributeRemovedButImgKept() {
            String result = EmailHtmlSanitizer.sanitize(
                "<img src=\"https://x.com/a.png\" onerror=\"alert(1)\">");

            assertThat(result.toLowerCase()).doesNotContain("onerror");
            assertThat(result).contains("src=\"https://x.com/a.png\"");
        }

        @Test
        void whenEventHandlerAfterQuotedValue_thenRemoved() {
            // Pas de whitespace entre la fin de valeur quotee et le handler
            String result = EmailHtmlSanitizer.sanitize(
                "<img src=\"x\"onload='alert(1)'>");

            assertThat(result.toLowerCase()).doesNotContain("onload");
        }

        @Test
        void whenJavascriptHref_thenAttributeRemoved() {
            String result = EmailHtmlSanitizer.sanitize(
                "<a href=\"javascript:alert(1)\">clique ici</a>");

            assertThat(result.toLowerCase()).doesNotContain("javascript");
            assertThat(result).contains("clique ici");
        }

        @Test
        void whenObfuscatedJavascriptScheme_thenAttributeRemoved() {
            // Tab insere + entite numerique : doivent etre detectes quand meme
            String tabbed = EmailHtmlSanitizer.sanitize("<a href=\"java\tscript:alert(1)\">x</a>");
            String entity = EmailHtmlSanitizer.sanitize("<a href=\"&#106;avascript:alert(1)\">x</a>");

            assertThat(tabbed.toLowerCase()).doesNotContain("script:");
            assertThat(entity.toLowerCase()).doesNotContain("avascript");
        }

        @Test
        void whenDataUrlInSrc_thenAttributeRemoved() {
            String result = EmailHtmlSanitizer.sanitize(
                "<img src=\"data:text/html;base64,PHNjcmlwdD4=\">");

            assertThat(result.toLowerCase()).doesNotContain("data:");
        }
    }
}
