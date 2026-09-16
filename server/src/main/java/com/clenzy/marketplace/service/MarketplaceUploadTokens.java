package com.clenzy.marketplace.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Jeton de depot des pieces d'une candidature.
 *
 * <p>Un candidat n'a pas de compte : ce jeton est la SEULE chose qui lui
 * permette de revenir deposer son Kbis ou son attestation de vigilance. Il vaut
 * donc acces a un dossier contenant une piece d'identite, et se traite comme un
 * secret : 256 bits de hasard, montre une seule fois, conserve en empreinte.</p>
 *
 * <p>Le hachage est un SHA-256 nu, sans sel ni etirement — volontairement. Ces
 * fonctions protegent des secrets a FAIBLE entropie (un mot de passe se devine,
 * se rejoue depuis une table). Un jeton tire de 32 octets aleatoires ne se
 * devine pas ; l'empreinte sert ici a ce qu'une lecture de la base ne donne pas
 * le jeton, et un SHA-256 suffit exactement a cela.</p>
 */
public final class MarketplaceUploadTokens {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int TOKEN_BYTES = 32;

    private MarketplaceUploadTokens() {}

    /** Jeton en clair, a remettre au candidat et a ne jamais persister tel quel. */
    public static String generate() {
        byte[] bytes = new byte[TOKEN_BYTES];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** Empreinte stockee en base, seule forme conservee. */
    public static String hash(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(token.trim().getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(64);
            for (byte b : hashBytes) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 non disponible", e);
        }
    }
}
