package com.clenzy.service.report.render;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Base64;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Resout le logo de l'emetteur en donnee integrable au document.
 *
 * <p><b>Pourquoi ne pas laisser iText le telecharger.</b> Son moteur sait
 * charger un {@code <img src="https://…">}, mais il le ferait PENDANT le rendu,
 * sans borne que nous controlions : un serveur lent bloquerait la generation
 * d'un releve, et un rendu declenche par le planificateur mensuel n'a personne
 * pour l'interrompre. On recupere donc l'image nous-memes, avec un delai, un
 * plafond de taille et un repli — puis on la passe en {@code data:}, et iText
 * ne touche jamais au reseau.</p>
 *
 * <p>HTTPS exclusivement : l'URL vient de la configuration d'une organisation,
 * et un rendu ne doit pas pouvoir etre dirige vers un service interne en clair.</p>
 */
@Component
public class ReportLogoResolver {

    private static final Logger log = LoggerFactory.getLogger(ReportLogoResolver.class);

    private static final Duration TIMEOUT = Duration.ofSeconds(3);
    /** Au-dela, ce n'est plus un logo : on refuse plutot que d'alourdir le document. */
    private static final int MAX_BYTES = 512 * 1024;

    /**
     * Cache par URL.
     *
     * <p>Un envoi groupe produit vingt releves d'affilee, tous du meme emetteur :
     * sans cache, vingt appels reseau pour la meme image.</p>
     */
    private final Map<String, String> cache = new ConcurrentHashMap<>();

    private final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(TIMEOUT)
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    /** Le logo en {@code data:} URI, ou vide si indisponible — le nom prend alors le relais. */
    public Optional<String> resolve(String logoUrl) {
        if (logoUrl == null || logoUrl.isBlank()) {
            return Optional.empty();
        }
        final String url = logoUrl.trim();
        if (!url.toLowerCase(Locale.ROOT).startsWith("https://")) {
            return Optional.empty();
        }
        final String cached = cache.get(url);
        if (cached != null) {
            return cached.isEmpty() ? Optional.empty() : Optional.of(cached);
        }

        final String resolved = fetch(url);
        // L'echec est memorise lui aussi : un logo injoignable ne doit pas etre
        // retente a chaque document d'un envoi groupe.
        cache.put(url, resolved == null ? "" : resolved);
        return Optional.ofNullable(resolved);
    }

    private String fetch(String url) {
        try {
            final HttpResponse<byte[]> response = client.send(
                    HttpRequest.newBuilder(URI.create(url)).timeout(TIMEOUT).GET().build(),
                    HttpResponse.BodyHandlers.ofByteArray());

            if (response.statusCode() != 200) {
                return null;
            }
            final byte[] body = response.body();
            if (body.length == 0 || body.length > MAX_BYTES) {
                return null;
            }
            final String type = response.headers().firstValue("content-type").orElse("")
                    .toLowerCase(Locale.ROOT);
            if (!type.startsWith("image/")) {
                return null;
            }
            return "data:" + type.split(";")[0] + ";base64,"
                    + Base64.getEncoder().encodeToString(body);
        } catch (Exception e) {
            log.warn("Logo de l'emetteur indisponible ({}), le document part avec le nom seul",
                    e.getClass().getSimpleName());
            return null;
        }
    }
}
