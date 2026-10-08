package com.clenzy.service;

import com.clenzy.exception.DocumentValidationException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

class BaitlyHtmlTemplatesTest {
    @Test void htmlFieldsLoopsConditionsAndEscapingUseTheSameRenderer() {
        String template = BaitlyDocumentHtml.page("Test", "<h1>${client.nom}</h1>[#if visible]<table>[#list lignes as ligne]<tr><td>${ligne.description}</td></tr>[/#list]</table>[/#if]");
        var context = Map.<String,Object>of("client", Map.of("nom", "<script>alert(1)</script> & ${7*7}"), "visible", true,
                "lignes", List.of(Map.of("description", "Premier"), Map.of("description", "Deuxième")));
        String rendered = new String(BaitlyHtmlTemplates.render(template.getBytes(StandardCharsets.UTF_8), context), StandardCharsets.UTF_8);
        var doc = org.jsoup.Jsoup.parse(rendered);
        assertThat(doc.select("tr")).hasSize(2);
        assertThat(doc.select("script")).isEmpty();
        assertThat(doc.select("h1").text()).isEqualTo("<script>alert(1)</script> & ${7*7}");
        assertThat(context.get("client")).isEqualTo(Map.of("nom", "<script>alert(1)</script> & ${7*7}"));
    }

    @ParameterizedTest @ValueSource(strings = {
        "<script>alert(1)</script>", "<img src='http://127.0.0.1/private'>", "<iframe src='file:///etc/passwd'></iframe>",
        "<style>@import 'https://example.test/a.css';</style>", "<p style='background: url(https://example.test/x)'>X</p>",
        "<p onclick='alert(1)'>X</p>", "<meta http-equiv='refresh' content='0;url=http://localhost'>",
        "[#include '/private/file']", "${'7*7'?eval}", "${'java.lang.Runtime'?new()}", "${value?no_esc}"
    }) void rejectsExecutableTemplatesAndRemoteResources(String fragment) {
        assertThatThrownBy(() -> BaitlyHtmlTemplates.source(BaitlyDocumentHtml.page("Test", fragment).getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(DocumentValidationException.class);
    }

    @Test void loopVariablesAreNotRequiredBusinessFields() {
        var tags = new TemplateParserService().parseTemplate(BaitlyDocumentHtml.page("Test",
                "[#list intervention.lignes as ligne]<p>${ligne.description}</p>[/#list]<p>${client.nom}</p>").getBytes(StandardCharsets.UTF_8));
        assertThat(tags).extracting(com.clenzy.model.DocumentTemplateTag::getTagName)
                .contains("intervention.lignes", "client.nom").doesNotContain("ligne.description");
    }
}
