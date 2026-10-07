package com.clenzy.service.messaging;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.Map;
import java.util.regex.Pattern;
import org.jsoup.Jsoup;
import org.springframework.stereotype.Service;

/** Même enveloppe que l'envoi ; valeurs de démonstration exclusivement issues d'une ressource fixe. */
@Service
public class BaitlyEmailPreviewService {
    private static final Pattern VARIABLE = Pattern.compile("\\{([a-zA-Z][a-zA-Z0-9_]*)}");
    private final EmailWrapperService wrapper;
    private final TemplateInterpolationService interpolation;
    public BaitlyEmailPreviewService(EmailWrapperService wrapper, TemplateInterpolationService interpolation) {
        this.wrapper = wrapper; this.interpolation = interpolation;
    }

    public Preview render(String subject, String body, String style, String language) {
        Map<String, String> values = examples();
        // Un tag personnalisé reste explicitement fictif ; aucun appel à un résolveur métier.
        var tags = VARIABLE.matcher(subject + " " + body);
        while (tags.find()) values.putIfAbsent(tags.group(1), "Exemple fictif");
        String title = interpolation.interpolate(subject, values, false);
        String content = interpolation.interpolate(body, values, true);
        var document = Jsoup.parse(wrapper.wrap(style == null ? "NOTIFICATION_GUEST" : style, content));
        document.select("a").removeAttr("href").removeAttr("target").attr("aria-disabled", "true");
        document.select("img").stream().filter(image -> !image.attr("src").startsWith("data:")).forEach(image -> image.removeAttr("src"));
        document.head().prependElement("meta").attr("http-equiv", "Content-Security-Policy")
            .attr("content", "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'");
        document.body().attr("dir", "ar".equals(language) ? "rtl" : "ltr");
        document.body().prependElement("div").attr("style", "padding:12px;text-align:center;font:12px Arial,sans-serif;color:#526879;background:#e7eef4")
            .text("APERÇU · DONNÉES FICTIVES · AUCUN ENVOI");
        return new Preview(title, document.outerHtml());
    }

    private Map<String, String> examples() {
        try (var input = getClass().getResourceAsStream("/documents/baitly-email-preview-data.json")) {
            if (input == null) throw new IllegalStateException("Exemples email absents");
            return new ObjectMapper().readValue(input, new TypeReference<>() {});
        } catch (IOException e) { throw new IllegalStateException("Exemples email illisibles", e); }
    }
    public record Preview(String subject, String html) {}
}
