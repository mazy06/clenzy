package com.clenzy.config;

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
 * IMPORTANT : Le mot de passe de chiffrement (JASYPT_ENCRYPTOR_PASSWORD) doit etre
 * identique entre les deployments pour pouvoir lire les donnees existantes.
 */
@Component
@Converter
public class EncryptedFieldConverter implements AttributeConverter<String, String> {

    private static final Logger log = LoggerFactory.getLogger(EncryptedFieldConverter.class);

    private static AES256TextEncryptor encryptor;

    /**
     * Initialisation statique du chiffreur.
     * Spring injecte la valeur via @Value sur le setter pour que le composant static fonctionne.
     */
    @Value("${jasypt.encryptor.password:default-dev-key}")
    public void setEncryptorPassword(String password) {
        encryptor = new AES256TextEncryptor();
        encryptor.setPassword(password);
        log.debug("EncryptedFieldConverter initialise avec succes");
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
            // Si le dechiffrement echoue, retourner la valeur brute
            // (peut arriver si la donnee n'a pas ete chiffree — migration progressive)
            log.warn("Dechiffrement impossible pour une valeur en base (migration progressive?): {}", e.getMessage());
            return dbData;
        }
    }
}
