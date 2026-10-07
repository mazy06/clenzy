package com.clenzy.service;

import com.clenzy.model.DocumentTemplate;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import static org.assertj.core.api.Assertions.assertThat;

/** Every native template and every historical source remains readable by the same pipeline. */
class BaitlyTemplateInventoryTest {
    static Stream<Path> templates() throws Exception {
        return Stream.concat(Files.list(Path.of("src/main/resources/seed/document-templates")),
                Files.list(Path.of("src/main/resources/templates")))
            .filter(p -> p.toString().endsWith(".html") || p.toString().endsWith(".odt"));
    }
    @ParameterizedTest(name="{0}") @MethodSource("templates")
    void everyAvailableTemplateProducesStandaloneHtmlWithOptionalData(Path source) throws Exception {
        var renderer = new DocumentTemplateRenderer(null);
        byte[] original = Files.readAllBytes(source);
        byte[] backup = original.clone();
        var template = new DocumentTemplate();
        template.setFileContent(original);
        template.setTags(new TemplateParserService().parseTemplate(original));
        var context = new LinkedHashMap<String, Object>();
        context.put("entreprise", java.util.Map.of("nom", "Conciergerie TEST", "adresse", "Adresse fictive"));
        renderer.fillMissingTags(template, context, true);
        String html = new String(renderer.fillTemplate(renderer.resolveTemplateContent(template), context), StandardCharsets.UTF_8);
        assertThat(html).contains("<html", "<body").doesNotContain("${", "[#", "<#");
        assertThat(org.jsoup.Jsoup.parse(html).text()).doesNotContainIgnoringCase("clenzy");
        assertThat(original).isEqualTo(backup);
        BaitlyHtmlTemplates.validateResources(html);
        String engineUrl = System.getProperty("baitly.test.pdf-url");
        if (engineUrl != null && source.toString().endsWith(".html")) {
            var engine = new BaitlyPdfEngine(engineUrl, new org.springframework.web.client.RestTemplate());
            byte[] pdf = engine.html(html.replace("<body>", "<body><p>APERÇU TEST · AUCUNE VALEUR LÉGALE</p>"));
            BaitlyPdfEngine.validate(pdf);
            Path output = Path.of("target/template-review");
            Files.createDirectories(output);
            Files.write(output.resolve(source.getFileName().toString().replace(".html", ".pdf")), pdf);
        }
    }
}
