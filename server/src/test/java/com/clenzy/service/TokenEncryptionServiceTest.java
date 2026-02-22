package com.clenzy.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TokenEncryptionServiceTest {

    private TokenEncryptionService encryptionService;

    private static final String PASSWORD = "test-encryption-password-32chars!";

    @BeforeEach
    void setUp() {
        encryptionService = new TokenEncryptionService(PASSWORD, 1, "");
    }

    // ===== ENCRYPT =====

    @Nested
    class Encrypt {

        @Test
        void whenValidToken_thenReturnsGcmPrefixedString() {
            String result = encryptionService.encrypt("my-secret-token");

            assertThat(result).isNotNull();
            assertThat(result).startsWith("GCMv1:");
        }

        @Test
        void whenNull_thenReturnsNull() {
            assertThat(encryptionService.encrypt(null)).isNull();
        }

        @Test
        void whenEmpty_thenReturnsNull() {
            assertThat(encryptionService.encrypt("")).isNull();
        }

        @Test
        void whenSameTokenEncryptedTwice_thenProducesDifferentCiphertexts() {
            String enc1 = encryptionService.encrypt("same-token");
            String enc2 = encryptionService.encrypt("same-token");

            // Different due to random IV
            assertThat(enc1).isNotEqualTo(enc2);
        }
    }

    // ===== DECRYPT =====

    @Nested
    class Decrypt {

        @Test
        void whenGcmVersionedToken_thenDecryptsCorrectly() {
            String encrypted = encryptionService.encrypt("hello-world");
            String decrypted = encryptionService.decrypt(encrypted);

            assertThat(decrypted).isEqualTo("hello-world");
        }

        @Test
        void whenNull_thenReturnsNull() {
            assertThat(encryptionService.decrypt(null)).isNull();
        }

        @Test
        void whenEmpty_thenReturnsNull() {
            assertThat(encryptionService.decrypt("")).isNull();
        }

        @Test
        void whenWrongKeyVersion_thenThrowsRuntime() {
            String encrypted = encryptionService.encrypt("test");
            // Replace version to an unknown one
            String tampered = encrypted.replace("GCMv1:", "GCMv99:");

            assertThatThrownBy(() -> encryptionService.decrypt(tampered))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Cle non trouvee pour la version 99");
        }

        @Test
        void roundTrip_withSpecialCharacters() {
            String token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.çàéè!@#$%";
            String encrypted = encryptionService.encrypt(token);
            String decrypted = encryptionService.decrypt(encrypted);

            assertThat(decrypted).isEqualTo(token);
        }

        @Test
        void roundTrip_withLongToken() {
            String token = "a".repeat(5000);
            String encrypted = encryptionService.encrypt(token);
            String decrypted = encryptionService.decrypt(encrypted);

            assertThat(decrypted).isEqualTo(token);
        }
    }

    // ===== KEY ROTATION =====

    @Nested
    class KeyRotation {

        @Test
        void whenPreviousPasswordProvided_thenCanDecryptOldTokens() {
            // Encrypt with v1 (old key)
            TokenEncryptionService v1Service = new TokenEncryptionService("old-password", 1, "");
            String encryptedWithV1 = v1Service.encrypt("secret");

            // Create v2 service with old-password as previous
            TokenEncryptionService v2Service = new TokenEncryptionService(
                    "new-password", 2, "old-password");

            String decrypted = v2Service.decrypt(encryptedWithV1);
            assertThat(decrypted).isEqualTo("secret");
        }

        @Test
        void whenV2Service_thenEncryptsWithV2() {
            TokenEncryptionService v2Service = new TokenEncryptionService(
                    "new-password", 2, "old-password");

            String encrypted = v2Service.encrypt("test");
            assertThat(encrypted).startsWith("GCMv2:");
        }

        @Test
        void reEncrypt_migratesFromOldToNewKey() {
            TokenEncryptionService v1Service = new TokenEncryptionService("old-pwd", 1, "");
            String v1Encrypted = v1Service.encrypt("migrate-me");

            TokenEncryptionService v2Service = new TokenEncryptionService(
                    "new-pwd", 2, "old-pwd");

            String reEncrypted = v2Service.reEncrypt(v1Encrypted);
            assertThat(reEncrypted).startsWith("GCMv2:");

            String decrypted = v2Service.decrypt(reEncrypted);
            assertThat(decrypted).isEqualTo("migrate-me");
        }
    }

    // ===== VERSION CHECKS =====

    @Nested
    class VersionChecks {

        @Test
        void isCurrentVersion_whenCurrentVersion_thenTrue() {
            String encrypted = encryptionService.encrypt("test");
            assertThat(encryptionService.isCurrentVersion(encrypted)).isTrue();
        }

        @Test
        void isCurrentVersion_whenOldVersion_thenFalse() {
            assertThat(encryptionService.isCurrentVersion("GCMv0:abc")).isFalse();
        }

        @Test
        void isCurrentVersion_whenNull_thenFalse() {
            assertThat(encryptionService.isCurrentVersion(null)).isFalse();
        }

        @Test
        void isLegacyFormat_whenNonGcmToken_thenTrue() {
            assertThat(encryptionService.isLegacyFormat("some-jasypt-encrypted-token")).isTrue();
        }

        @Test
        void isLegacyFormat_whenGcmToken_thenFalse() {
            String encrypted = encryptionService.encrypt("test");
            assertThat(encryptionService.isLegacyFormat(encrypted)).isFalse();
        }

        @Test
        void isLegacyFormat_whenLegacyGcm_thenFalse() {
            assertThat(encryptionService.isLegacyFormat("GCM:base64data")).isFalse();
        }

        @Test
        void isLegacyFormat_whenNull_thenFalse() {
            assertThat(encryptionService.isLegacyFormat(null)).isFalse();
        }

        @Test
        void getCurrentKeyVersion_returnsConfiguredVersion() {
            assertThat(encryptionService.getCurrentKeyVersion()).isEqualTo(1);
        }
    }
}
