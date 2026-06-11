package com.clenzy.util;

import java.util.List;

/**
 * Résolution unique de l'IP cliente réelle derrière les proxies de confiance
 * (nginx, réseaux Docker). Source de vérité partagée par tout le code qui doit
 * identifier le client réel : keying du rate-limit ({@code RateLimitInterceptor})
 * et dossier de preuve SES des signatures électroniques ({@code TrustedClientIpResolver}).
 *
 * <p>Pure et testable sans {@code HttpServletRequest} : les valeurs brutes
 * ({@code remoteAddr}, {@code X-Forwarded-For}, {@code X-Real-IP}) sont passées en
 * paramètres. Aucune résolution DNS.</p>
 *
 * <p>{@code X-Forwarded-For} n'est honoré que si le pair direct ({@code remoteAddr})
 * est un proxy de confiance, et la chaîne est parcourue de DROITE à GAUCHE en sautant
 * les proxies de confiance : nginx AJOUTE l'IP réelle en fin de chaîne
 * ({@code proxy_add_x_forwarded_for}), donc les entrées de gauche sont fournies par le
 * client et spoofables. Sans cette garde, un client pourrait forger l'IP attestée
 * (preuve de signature) ou faire tourner la clé de rate-limit via un simple en-tête
 * (Z1-SEC-04 / Z4B-SECBUGS-01).</p>
 */
public final class ClientIpResolver {

    /**
     * Plages privées/loopback considérées comme proxies de confiance (nginx,
     * réseaux Docker). CIDR exacts : 172.32.x.x ou 172.0.x.x (publiques) ne sont
     * PAS de confiance, contrairement à un test {@code startsWith("172.")}.
     */
    private static final List<Ipv4Cidr> TRUSTED_PROXY_RANGES = List.of(
            Ipv4Cidr.parse("127.0.0.0/8"),
            Ipv4Cidr.parse("10.0.0.0/8"),
            Ipv4Cidr.parse("172.16.0.0/12"),
            Ipv4Cidr.parse("192.168.0.0/16"));

    private ClientIpResolver() {}

    /**
     * Résout l'IP cliente réelle : {@code remoteAddr} tel quel si le pair direct
     * n'est pas un proxy de confiance ; sinon première entrée non-trusted de
     * {@code X-Forwarded-For} (droite → gauche), repli {@code X-Real-IP}, repli
     * {@code remoteAddr}.
     */
    public static String resolve(String remoteAddr, String xForwardedFor, String xRealIp) {
        if (!isTrustedProxy(remoteAddr)) {
            return remoteAddr;
        }
        String forwardedClientIp = resolveClientIpFromForwardedChain(xForwardedFor);
        if (forwardedClientIp != null) {
            return forwardedClientIp;
        }
        if (xRealIp != null && !xRealIp.isBlank()) {
            return xRealIp.trim();
        }
        return remoteAddr;
    }

    /**
     * Parcourt X-Forwarded-For de droite à gauche et retourne la première adresse
     * qui n'est pas un proxy de confiance (= IP cliente vue par le premier proxy
     * de confiance). Retourne null si le header est absent/vide ou si toute la
     * chaîne est de confiance (client interne : repli X-Real-IP/remoteAddr).
     */
    private static String resolveClientIpFromForwardedChain(String xForwardedFor) {
        if (xForwardedFor == null || xForwardedFor.isBlank()) {
            return null;
        }
        String[] entries = xForwardedFor.split(",");
        for (int i = entries.length - 1; i >= 0; i--) {
            String candidate = entries[i].trim();
            if (candidate.isEmpty()) {
                continue;
            }
            if (!isTrustedProxy(candidate)) {
                return candidate;
            }
        }
        return null;
    }

    /**
     * Indique si l'adresse appartient aux plages de proxies de confiance
     * (loopback IPv4/IPv6, plages privées RFC 1918 en CIDR exacts).
     */
    public static boolean isTrustedProxy(String address) {
        if (address == null || address.isBlank()) {
            return false;
        }
        String trimmed = address.trim();
        if (trimmed.equals("0:0:0:0:0:0:0:1") || trimmed.equals("::1")) {
            return true;
        }
        Integer ipv4 = Ipv4Cidr.parseAddress(trimmed);
        if (ipv4 == null) {
            return false;
        }
        for (Ipv4Cidr range : TRUSTED_PROXY_RANGES) {
            if (range.contains(ipv4)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Plage CIDR IPv4 : comparaison par masque sur des littéraux d'adresse,
     * sans aucune résolution DNS.
     */
    record Ipv4Cidr(int network, int mask) {

        static Ipv4Cidr parse(String cidr) {
            int slash = cidr.indexOf('/');
            if (slash < 0) {
                throw new IllegalArgumentException("CIDR invalide: " + cidr);
            }
            Integer base = parseAddress(cidr.substring(0, slash));
            int prefix = Integer.parseInt(cidr.substring(slash + 1));
            if (base == null || prefix < 0 || prefix > 32) {
                throw new IllegalArgumentException("CIDR invalide: " + cidr);
            }
            int mask = prefix == 0 ? 0 : -1 << (32 - prefix);
            return new Ipv4Cidr(base & mask, mask);
        }

        /** Retourne null si la valeur n'est pas une IPv4 littérale valide. */
        static Integer parseAddress(String address) {
            String[] octets = address.split("\\.", -1);
            if (octets.length != 4) {
                return null;
            }
            int value = 0;
            for (String octetText : octets) {
                if (octetText.isEmpty() || octetText.length() > 3) {
                    return null;
                }
                final int octet;
                try {
                    octet = Integer.parseInt(octetText);
                } catch (NumberFormatException e) {
                    return null;
                }
                if (octet < 0 || octet > 255) {
                    return null;
                }
                value = (value << 8) | octet;
            }
            return value;
        }

        boolean contains(int address) {
            return (address & mask) == network;
        }
    }
}
