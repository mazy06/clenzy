package com.clenzy.service;

import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Set;

/**
 * Validates iCal feed URLs against SSRF attacks.
 * Blocks: non-HTTPS schemes, private/loopback/link-local IPs, cloud metadata endpoints.
 * Returns the resolved InetAddress so callers can pin DNS (prevent TOCTOU rebinding).
 */
public final class ICalUrlValidator {

    private static final Set<String> ALLOWED_SCHEMES = Set.of("https");

    private ICalUrlValidator() {}

    /**
     * Validates the URL and resolves DNS, returning the first safe InetAddress.
     * The caller MUST use this resolved address for the HTTP request
     * to prevent DNS rebinding (TOCTOU between validation and request).
     *
     * @param url the iCal feed URL to validate
     * @return the resolved InetAddress safe to connect to
     * @throws IllegalArgumentException if the URL is invalid, uses a blocked scheme,
     *         points to a private/local address, or cannot be resolved
     */
    public static InetAddress validateAndResolve(String url) {
        if (url == null || url.isBlank()) {
            throw new IllegalArgumentException("L'URL du calendrier iCal ne peut pas etre vide");
        }

        URI uri;
        try {
            uri = URI.create(url.trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("URL iCal invalide : " + e.getMessage());
        }

        // Scheme check: HTTPS only
        String scheme = uri.getScheme();
        if (scheme == null || !ALLOWED_SCHEMES.contains(scheme.toLowerCase())) {
            throw new IllegalArgumentException(
                    "Seul le protocole HTTPS est autorise pour les URLs iCal (recu: " + scheme + ")");
        }

        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            throw new IllegalArgumentException("L'URL iCal doit contenir un nom d'hote valide");
        }

        blockLocalHosts(host);
        blockCloudMetadata(host);

        return resolveAndBlockPrivateIps(host);
    }

    /**
     * Blocks localhost variants and internal domain suffixes.
     */
    private static void blockLocalHosts(String host) {
        String hostLower = host.toLowerCase();
        if (hostLower.equals("localhost") || hostLower.equals("127.0.0.1")
                || hostLower.equals("[::1]") || hostLower.equals("0.0.0.0")
                || hostLower.endsWith(".local") || hostLower.endsWith(".internal")) {
            throw new IllegalArgumentException("Les adresses locales ne sont pas autorisees pour les URLs iCal");
        }
    }

    /**
     * Blocks well-known cloud metadata endpoints (AWS, GCP).
     */
    private static void blockCloudMetadata(String host) {
        String hostLower = host.toLowerCase();
        if (hostLower.equals("169.254.169.254") || hostLower.equals("metadata.google.internal")) {
            throw new IllegalArgumentException("Les endpoints de metadata cloud ne sont pas autorises");
        }
    }

    /**
     * Resolves DNS for the host and verifies none of the addresses are private.
     * Returns the first valid public address.
     */
    private static InetAddress resolveAndBlockPrivateIps(String host) {
        try {
            InetAddress[] addresses = InetAddress.getAllByName(host);
            InetAddress validAddress = null;
            for (InetAddress addr : addresses) {
                if (addr.isLoopbackAddress() || addr.isSiteLocalAddress()
                        || addr.isLinkLocalAddress() || addr.isAnyLocalAddress()
                        || isRfc1918Private(addr)) {
                    throw new IllegalArgumentException(
                            "L'URL iCal pointe vers une adresse IP privee ou locale");
                }
                if (validAddress == null) {
                    validAddress = addr;
                }
            }
            if (validAddress == null) {
                throw new IllegalArgumentException("Aucune adresse IP valide pour : " + host);
            }
            return validAddress;
        } catch (UnknownHostException e) {
            throw new IllegalArgumentException("Impossible de resoudre le nom d'hote : " + host);
        }
    }

    /**
     * Checks if an address falls within RFC 1918 private ranges.
     * Covers 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16.
     * Java's isSiteLocalAddress() only covers 192.168.x.x,
     * so 10.x and 172.16-31.x must be checked manually.
     */
    private static boolean isRfc1918Private(InetAddress addr) {
        byte[] bytes = addr.getAddress();
        if (bytes == null || bytes.length != 4) return false;
        int b0 = bytes[0] & 0xFF;
        int b1 = bytes[1] & 0xFF;
        // 10.0.0.0/8
        if (b0 == 10) return true;
        // 172.16.0.0/12 (172.16.x.x - 172.31.x.x)
        if (b0 == 172 && b1 >= 16 && b1 <= 31) return true;
        // 192.168.0.0/16
        return b0 == 192 && b1 == 168;
    }
}
