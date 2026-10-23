package com.clenzy.service.signature;

import com.clenzy.booking.service.PinnedSiteFetcher;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;

/** PDF Baitly : HTTPS public, même origine, DNS épinglé, sans redirection ni corps illimité. */
@Component
public class BaitlySignatureDownloads {
    static final long MAX_DOCUMENT_BYTES = 25L * 1024 * 1024;
    private final PinnedSiteFetcher fetcher;
    public BaitlySignatureDownloads(PinnedSiteFetcher fetcher) {this.fetcher = fetcher;}

    public byte[] fetchSameOrigin(String base, String target, HttpHeaders headers) {
        try {
            if (target == null || target.length() > 8192) throw BaitlySignatureSafety.invalidResponse();
            URI origin = URI.create(base), uri = URI.create(target);
            if (origin.getHost() == null || origin.getUserInfo() != null || origin.getFragment() != null
                    || uri.getUserInfo() != null || uri.getFragment() != null || !"https".equalsIgnoreCase(origin.getScheme())
                    || !origin.getScheme().equalsIgnoreCase(uri.getScheme()) || !origin.getHost().equalsIgnoreCase(uri.getHost())
                    || port(origin) != 443 || port(uri) != 443) throw BaitlySignatureSafety.invalidResponse();
            var authentication = new LinkedHashMap<String, String>();
            for (String name : new String[]{HttpHeaders.AUTHORIZATION, "X-Auth-Token"}) {
                if (headers.containsKey(name)) {
                    if (headers.get(name).size() != 1) throw BaitlySignatureSafety.invalidResponse();
                    authentication.put(name, headers.getFirst(name));
                }
            }
            byte[] document = fetcher.fetchAuthenticated(target, MAX_DOCUMENT_BYTES, authentication).body();
            if (document == null || document.length == 0 || document.length > MAX_DOCUMENT_BYTES
                    || !new String(document, 0, Math.min(document.length, 1024), StandardCharsets.ISO_8859_1).contains("%PDF-")) {
                throw BaitlySignatureSafety.invalidResponse();
            }
            return document;
        } catch (Exception ignored) {throw BaitlySignatureSafety.unavailable();}
    }
    private int port(URI uri) {return uri.getPort() >= 0 ? uri.getPort() : 443;}
}
