package com.clenzy.config;

import com.clenzy.exception.FieldDecryptionException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Tests for {@link EncryptedFieldConverter}.
 * Validates AES-256 encryption/decryption, null/empty handling,
 * ANONYMIZED bypass, and typed failure on undecryptable values (Z1-SEC-08).
 */
class EncryptedFieldConverterTest {

    private EncryptedFieldConverter converter;

    @BeforeEach
    void setUp() {
        converter = new EncryptedFieldConverter();
        // Initialize encryptor with a test password
        converter.setEncryptorPassword("test-encryption-password-for-unit-tests");
        // Etat statique partage : remettre le mode strict (defaut prod)
        converter.setFailOnDecryptError(true);
    }

    @Nested
    @DisplayName("convertToDatabaseColumn")
    class ConvertToDatabaseColumn {

        @Test
        void whenNullAttribute_thenReturnsNull() {
            assertThat(converter.convertToDatabaseColumn(null)).isNull();
        }

        @Test
        void whenEmptyAttribute_thenReturnsEmpty() {
            assertThat(converter.convertToDatabaseColumn("")).isEmpty();
        }

        @Test
        void whenAnonymizedAttribute_thenReturnsSameValue() {
            assertThat(converter.convertToDatabaseColumn("ANONYMIZED")).isEqualTo("ANONYMIZED");
        }

        @Test
        void whenAnonPrefixAttribute_thenReturnsSameValue() {
            assertThat(converter.convertToDatabaseColumn("anon_12345")).isEqualTo("anon_12345");
        }

        @Test
        void whenValidAttribute_thenReturnsEncryptedValue() {
            String plainText = "sensitive-phone-number";
            String encrypted = converter.convertToDatabaseColumn(plainText);

            assertThat(encrypted).isNotNull();
            assertThat(encrypted).isNotEqualTo(plainText);
            assertThat(encrypted).isNotEmpty();
        }

        @Test
        void whenEncryptingSameValue_thenProducesDifferentCiphertexts() {
            // AES with random IV should produce different ciphertexts
            String encrypted1 = converter.convertToDatabaseColumn("test-value");
            String encrypted2 = converter.convertToDatabaseColumn("test-value");
            // Jasypt AES256 uses random salt, so ciphertexts should differ
            assertThat(encrypted1).isNotEqualTo(encrypted2);
        }
    }

    @Nested
    @DisplayName("convertToEntityAttribute")
    class ConvertToEntityAttribute {

        @Test
        void whenNullDbData_thenReturnsNull() {
            assertThat(converter.convertToEntityAttribute(null)).isNull();
        }

        @Test
        void whenEmptyDbData_thenReturnsEmpty() {
            assertThat(converter.convertToEntityAttribute("")).isEmpty();
        }

        @Test
        void whenAnonymizedDbData_thenReturnsSameValue() {
            assertThat(converter.convertToEntityAttribute("ANONYMIZED")).isEqualTo("ANONYMIZED");
        }

        @Test
        void whenAnonPrefixDbData_thenReturnsSameValue() {
            assertThat(converter.convertToEntityAttribute("anon_abc")).isEqualTo("anon_abc");
        }

        @Test
        void whenValidEncryptedData_thenDecryptsSuccessfully() {
            String original = "+33612345678";
            String encrypted = converter.convertToDatabaseColumn(original);
            String decrypted = converter.convertToEntityAttribute(encrypted);

            assertThat(decrypted).isEqualTo(original);
        }

        @Test
        void whenDecryptionFails_thenThrowsTypedExceptionWithoutLeakingValue() {
            // Une valeur indechiffrable (donnee alteree, cle incorrecte ou valeur
            // jamais chiffree) ne doit plus etre renvoyee silencieusement (Z1-SEC-08)
            String rawValue = "not-encrypted-value";

            assertThatThrownBy(() -> converter.convertToEntityAttribute(rawValue))
                .isInstanceOf(FieldDecryptionException.class)
                .satisfies(ex -> assertThat(ex.getMessage()).doesNotContain(rawValue));
        }

        @Test
        void whenDecryptionFailsWithWrongKey_thenThrowsTypedException() {
            // Simule une rotation de cle ratee : chiffre avec une cle, lit avec une autre
            String encrypted = converter.convertToDatabaseColumn("+33612345678");
            EncryptedFieldConverter otherKeyConverter = new EncryptedFieldConverter();
            otherKeyConverter.setEncryptorPassword("another-password-after-bad-rotation");

            assertThatThrownBy(() -> otherKeyConverter.convertToEntityAttribute(encrypted))
                .isInstanceOf(FieldDecryptionException.class)
                .satisfies(ex -> assertThat(ex.getMessage()).doesNotContain(encrypted));
        }

        @Test
        void whenTolerantModeEnabled_thenReturnsRawValueWithoutThrowing() {
            // Soupape de transition (migration progressive sans backfill SQL) :
            // fail-on-decrypt-error=false sert la valeur brute au lieu de lever
            converter.setFailOnDecryptError(false);
            String rawValue = "legacy-plaintext-value";

            String result = converter.convertToEntityAttribute(rawValue);

            assertThat(result).isEqualTo(rawValue);
        }
    }

    @Nested
    @DisplayName("Roundtrip")
    class Roundtrip {

        @Test
        void whenEncryptThenDecrypt_thenOriginalRestored() {
            String[] testValues = {
                "john@example.com",
                "+33 6 12 34 56 78",
                "Données sensibles avec accents: éàü",
                "Special chars: !@#$%^&*()"
            };

            for (String original : testValues) {
                String encrypted = converter.convertToDatabaseColumn(original);
                String decrypted = converter.convertToEntityAttribute(encrypted);
                assertThat(decrypted).isEqualTo(original);
            }
        }
    }
}
