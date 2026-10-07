package com.clenzy.service;

import com.clenzy.model.DocumentTemplate;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

/** Le logo est incorporé dans le HTML, y compris lors de la reprise d'une source historique. */
class DocumentTemplateLogoRenderingTest {
    @ParameterizedTest @ValueSource(strings = {
        "bon-intervention-baitly.html", "validation-fin-mission-baitly.html", "justificatif-remboursement-baitly.html",
        "bon-intervention-clenzy.odt", "validation-fin-mission-clenzy.odt", "justificatif-remboursement-clenzy.odt"
    }) void logoBytesAreEmbeddedAndSourceDoesNotChange(String name) throws Exception {
        byte[] source;
        try (var in = getClass().getResourceAsStream("/seed/document-templates/" + name)) { source = in.readAllBytes(); }
        byte[] original = source.clone();
        var image = new java.awt.image.BufferedImage(4, 4, java.awt.image.BufferedImage.TYPE_INT_RGB);
        var out = new java.io.ByteArrayOutputStream(); javax.imageio.ImageIO.write(image, "png", out);
        String logo = Base64.getEncoder().encodeToString(out.toByteArray());
        var template = new DocumentTemplate(); template.setTags(new TemplateParserService().parseTemplate(source));
        var renderer = new DocumentTemplateRenderer(null);
        var context = new LinkedHashMap<String,Object>();
        renderer.fillMissingTags(template, context, false);
        context.put("logo_prestataire", out.toByteArray());
        String html = new String(renderer.fillTemplate(source, context), StandardCharsets.UTF_8);
        assertThat(org.jsoup.Jsoup.parse(html).select("img").eachAttr("src")).contains("data:image/png;base64," + logo);
        assertThat(source).isEqualTo(original);
        context.remove("logo_prestataire");
        assertThat(renderer.fillTemplate(source, context)).isNotEmpty();
    }
}
