package com.clenzy.booking.service;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * Fetches a website's HTML and CSS content using Jsoup.
 * Used by AiDesignService to provide raw content for AI analysis.
 *
 * Security:
 * - HTTPS only (no HTTP)
 * - Blocks private/internal IPs (SSRF protection)
 * - Content size limiting
 * - Request timeout
 */
@Service
public class WebsiteFetchService {

    private static final Logger log = LoggerFactory.getLogger(WebsiteFetchService.class);

    @Value("${clenzy.ai.website-fetch.timeout-seconds:15}")
    private int timeoutSeconds;

    @Value("${clenzy.ai.website-fetch.max-content-length-kb:512}")
    private int maxContentLengthKb;

    /**
     * Result of fetching a website.
     */
    public record WebsiteContent(String html, String css, String contentHash) {}

    /**
     * Fetches the HTML and extracts CSS from a website URL.
     *
     * @param url the website URL (must be HTTPS)
     * @return WebsiteContent with HTML body, concatenated CSS, and SHA-256 hash
     * @throws IllegalArgumentException if URL is invalid or uses HTTP
     * @throws IOException if the website cannot be fetched
     */
    public WebsiteContent fetchWebsite(String url) throws IOException {
        validateUrl(url);

        log.info("Fetching website for AI design analysis: {}", url);

        Document doc = Jsoup.connect(url)
                .userAgent("ClenzyBot/1.0 (design-analysis)")
                .timeout(timeoutSeconds * 1000)
                .maxBodySize(maxContentLengthKb * 1024)
                .followRedirects(true)
                .get();

        // Extract HTML body (without scripts for smaller payload)
        doc.select("script").remove();
        doc.select("noscript").remove();
        String html = doc.body() != null ? doc.body().html() : "";

        // Extract CSS: inline <style> blocks + linked stylesheets
        StringBuilder cssBuilder = new StringBuilder();

        // Inline styles
        Elements styleElements = doc.select("style");
        for (Element style : styleElements) {
            cssBuilder.append("/* inline style */\n");
            cssBuilder.append(style.data()).append("\n\n");
        }

        // Linked stylesheets (fetch up to 5, first-party only)
        Elements linkElements = doc.select("link[rel=stylesheet]");
        String baseHost = extractHost(url);
        int fetchedSheets = 0;

        for (Element link : linkElements) {
            if (fetchedSheets >= 5) break;

            String href = link.absUrl("href");
            if (href.isEmpty()) continue;

            // Only fetch first-party or common CDN stylesheets
            String sheetHost = extractHost(href);
            if (sheetHost == null) continue;

            boolean isFirstParty = sheetHost.equals(baseHost);
            boolean isCommonCdn = sheetHost.contains("googleapis.com")
                    || sheetHost.contains("fonts.googleapis.com")
                    || sheetHost.contains("cdnjs.cloudflare.com");

            if (!isFirstParty && !isCommonCdn) continue;

            try {
                Document cssDoc = Jsoup.connect(href)
                        .userAgent("ClenzyBot/1.0 (design-analysis)")
                        .timeout(5000)
                        .maxBodySize(200 * 1024) // 200KB per sheet
                        .ignoreContentType(true)
                        .get();
                cssBuilder.append("/* ").append(href).append(" */\n");
                cssBuilder.append(cssDoc.body().text()).append("\n\n");
                fetchedSheets++;
            } catch (Exception e) {
                log.debug("Failed to fetch stylesheet {}: {}", href, e.getMessage());
            }
        }

        String css = cssBuilder.toString();
        String contentHash = sha256(html + css);

        log.info("Website fetched: {}KB HTML, {}KB CSS, hash={}",
                html.length() / 1024, css.length() / 1024, contentHash.substring(0, 12));

        return new WebsiteContent(html, css, contentHash);
    }

    // ─── Validation ─────────────────────────────────────────────────────

    private void validateUrl(String url) {
        if (url == null || url.isBlank()) {
            throw new IllegalArgumentException("Website URL is required");
        }

        URI uri;
        try {
            uri = new URI(url);
        } catch (URISyntaxException e) {
            throw new IllegalArgumentException("Invalid URL format: " + url);
        }

        // HTTPS only
        if (!"https".equalsIgnoreCase(uri.getScheme())) {
            throw new IllegalArgumentException("Only HTTPS URLs are accepted");
        }

        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            throw new IllegalArgumentException("URL must have a valid host");
        }

        // SSRF protection: block private/internal IPs
        try {
            InetAddress address = InetAddress.getByName(host);
            if (address.isLoopbackAddress()
                    || address.isSiteLocalAddress()
                    || address.isLinkLocalAddress()
                    || address.isAnyLocalAddress()) {
                throw new IllegalArgumentException("Internal/private URLs are not allowed");
            }
        } catch (UnknownHostException e) {
            throw new IllegalArgumentException("Cannot resolve host: " + host);
        }
    }

    private String extractHost(String url) {
        try {
            return new URI(url).getHost();
        } catch (URISyntaxException e) {
            return null;
        }
    }

    // ─── Hashing ────────────────────────────────────────────────────────

    private String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder(2 * hash.length);
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }
}
