package com.clenzy.service.signature;

import com.clenzy.util.ClientIpResolver;

/**
 * Résolution de l'IP cliente réelle derrière les proxies de confiance (nginx,
 * réseaux Docker) pour les endpoints publics de signature : l'IP alimente le
 * dossier de preuve SES (certificat eIDAS) et le keying du rate-limit.
 *
 * <p>Délègue à {@link ClientIpResolver} (package {@code com.clenzy.util}), source
 * de vérité unique partagée avec {@code RateLimitInterceptor} : même logique
 * anti-spoofing X-Forwarded-For, mêmes plages de proxies de confiance. Cette
 * façade existe pour conserver le point d'appel du package signature.</p>
 */
public final class TrustedClientIpResolver {

    private TrustedClientIpResolver() {}

    /**
     * Résout l'IP cliente réelle : {@code remoteAddr} tel quel si le pair direct
     * n'est pas un proxy de confiance ; sinon première entrée non-trusted de
     * {@code X-Forwarded-For} (droite → gauche), repli {@code X-Real-IP}, repli
     * {@code remoteAddr}.
     */
    public static String resolve(String remoteAddr, String xForwardedFor, String xRealIp) {
        return ClientIpResolver.resolve(remoteAddr, xForwardedFor, xRealIp);
    }

    /** Visibilité package-private pour les tests. Délègue à {@link ClientIpResolver}. */
    static boolean isTrustedProxy(String address) {
        return ClientIpResolver.isTrustedProxy(address);
    }
}
