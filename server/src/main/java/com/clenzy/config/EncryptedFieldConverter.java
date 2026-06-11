package com.clenzy.config;

import com.clenzy.exception.FieldDecryptionException;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.jasypt.util.text.AES256TextEncryptor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * JPA AttributeConverter pour le chiffrement AES-256 au repos des colonnes sensibles.
 *
 * Conformite RGPD Article 32 — Securite du traitement :
 * "le pseudonymisation et le chiffrement des donnees a caractere personnel"
 *
 * Usage dans les entites JPA :
 *   @Convert(converter = EncryptedFieldConverter.class)
 *   private String phoneNumber;
 *
 * Les valeurs sont chiffrees avant ecriture en base et dechiffrees a la lecture.
 * En base, les colonnes contiennent des valeurs chiffrees AES-256 (illisibles).
 *
 * Gestion d'erreur (Z1-SEC-08) : un echec de dechiffrement leve une
 * {@link FieldDecryptionException} (la valeur brute n'est jamais renvoyee ni
 * loggee). Detecte les rotations de cle ratees et les donnees alterees.
 *
 * IMPORTANT : Le mot de passe de chiffrement (JASYPT_ENCRYPTOR_PASSWORD) doit etre
 * identique entre les deployments pour pouvoir lire les donnees existantes.
 */
@Component
@Converter
public class EncryptedFieldConverter implements AttributeConverter<String, String> {

    private static final Logger log = LoggerFactory.getLogger(EncryptedFieldConverter.class);

    private static AES256TextEncryptor encryptor;

    /**
     * Mode strict (defaut) : un echec de dechiffrement leve une
     * {@link FieldDecryptionException}. Le mode tolerant
     * ({@code clenzy.security.field-encryption.fail-on-decrypt-error=false})
     * est une soupape de transition UNIQUEMENT : si des lignes legacy non
     * chiffrees subsistent (la migration progressive n'a pas de backfill SQL),
     * il permet de les servir le temps du backfill applicatif, avec log ERROR.
     */
    private static boolean failOnDecryptError = true;

    /**
     * Initialisation statique du chiffreur.
     * Spring injecte la valeur via @Value sur le setter pour que le composant static fonctionne.
     */
    @Value("${jasypt.encryptor.password}")
    public void setEncryptorPassword(String password) {
        encryptor = new AES256TextEncryptor();
        encryptor.setPassword(password);
        log.debug("EncryptedFieldConverter initialise avec succes");
    }

    @Value("${clenzy.security.field-encryption.fail-on-decrypt-error:true}")
    public void setFailOnDecryptError(boolean value) {
        failOnDecryptError = value;
    }

    @Override
    public String convertToDatabaseColumn(String attribute) {
        if (attribute == null || attribute.isEmpty()) {
            return attribute;
        }
        // Ne pas re-chiffrer une valeur deja anonymisee
        if ("ANONYMIZED".equals(attribute) || attribute.startsWith("anon_")) {
            return attribute;
        }
        try {
            return encryptor.encrypt(attribute);
        } catch (Exception e) {
            log.error("Erreur de chiffrement pour la colonne: {}", e.getMessage());
            throw new RuntimeException("Erreur de chiffrement RGPD", e);
        }
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isEmpty()) {
            return dbData;
        }
        // Ne pas dechiffrer les valeurs anonymisees
        if ("ANONYMIZED".equals(dbData) || dbData.startsWith("anon_")) {
            return dbData;
        }
        try {
            return encryptor.decrypt(dbData);
        } catch (Exception e) {
            // Z1-SEC-08 : ne plus renvoyer silencieusement la valeur brute (le
            // ciphertext ou une donnee alteree serait servie comme valeur metier
            // sans alerte, et une rotation incorrecte de JASYPT_ENCRYPTOR_PASSWORD
            // passerait inapercue). Echec bruyant via exception typee.
            // Log volontairement sans la valeur ni le message d'origine
            // (aucune donnee sensible ne doit fuiter dans les logs).
            log.error("Echec de dechiffrement d'un champ chiffre en base "
                    + "(cle JASYPT incorrecte ou donnee alteree) [{}]",
                    e.getClass().getSimpleName());
            if (failOnDecryptError) {
                throw new FieldDecryptionException(
                        "Echec de dechiffrement d'un champ chiffre au repos", e);
            }
            // Mode tolerant explicite (transition migration progressive) :
            // sert la valeur brute, mais l'echec reste visible (ERROR ci-dessus).
            return dbData;
        }
    }
}
