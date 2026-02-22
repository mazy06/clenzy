package com.clenzy.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Tests for {@link EncryptedFieldConverter}.
 * Validates AES-256 encryption/decryption, null/empty handling,
 * ANONYMIZED bypass, and graceful decryption fallback.
 */
class EncryptedFieldConverterTest {

    private EncryptedFieldConverter converter;

    @BeforeEach
    void setUp() {
        converter = new EncryptedFieldConverter();
        // Initialize encryptor with a test password
        converter.setEncryptorPassword("test-encryption-password-for-unit-tests");
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
        void whenDecryptionFails_thenReturnsRawValue() {
            // Simulates a value that was never encrypted (migration progressive)
            String rawValue = "not-encrypted-value";
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
