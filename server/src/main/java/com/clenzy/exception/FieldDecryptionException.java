package com.clenzy.exception;

/**
 * Echec de dechiffrement d'un champ chiffre au repos (EncryptedFieldConverter).
 *
 * Levee volontairement (Z1-SEC-08) : une valeur indechiffrable signale soit
 * une JASYPT_ENCRYPTOR_PASSWORD incorrecte (rotation de cle ratee), soit une
 * donnee alteree/non chiffree en base. Renvoyer silencieusement la valeur
 * brute masquerait l'incident et exposerait le ciphertext comme une valeur
 * metier.
 *
 * Invariant : le message ne contient JAMAIS la valeur en cause.
 */
public class FieldDecryptionException extends RuntimeException {

    public FieldDecryptionException(String message, Throwable cause) {
        super(message, cause);
    }
}
