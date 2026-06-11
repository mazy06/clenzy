package com.clenzy.config;

import com.clenzy.integration.external.service.ApiKeyEncryptionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests pour {@link SecretColumnEncryptionBackfill}.
 *
 * <p>Valide que le runner chiffre les valeurs encore en clair (via SQL natif,
 * sans déclencher le converter JPA) et qu'il est idempotent (les valeurs déjà
 * chiffrées sont détectées et sautées). Le {@link ApiKeyEncryptionService} est
 * réel (clé de test) pour que la détection « clair vs. chiffré » et le
 * roundtrip soient exercés pour de vrai.</p>
 */
@ExtendWith(MockitoExtension.class)
class SecretColumnEncryptionBackfillTest {

    @Mock private JdbcTemplate jdbcTemplate;
    @Mock private PlatformTransactionManager transactionManager;

    private final ApiKeyEncryptionService encryption =
            new ApiKeyEncryptionService("test-backfill-encryption-password");

    private SecretColumnEncryptionBackfill backfill;

    @BeforeEach
    void setUp() {
        lenient().when(transactionManager.getTransaction(any()))
                .thenReturn(new SimpleTransactionStatus());
        backfill = new SecretColumnEncryptionBackfill(jdbcTemplate, encryption, transactionManager);
        ReflectionTestUtils.setField(backfill, "enabled", true);
        // Toutes les colonnes ciblées existent par défaut (chemin nominal).
        lenient().when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), anyString(), anyString()))
                .thenReturn(1);
    }

    @Test
    @DisplayName("Une valeur en clair est ré-écrite chiffrée (M1-MODEL-04)")
    void whenPlaintextValue_thenEncryptedInPlace() {
        // Le runner itère COLUMNS dans l'ordre :
        //   1. external_pricing_configs.api_key
        //   2. check_in_instructions.access_code
        //   3. check_in_instructions.wifi_password
        //   4. check_in_instructions.extra_access_codes   <-- la colonne testée
        //   5. integration_partners.api_key_encrypted
        // On renvoie donc une ligne en clair UNIQUEMENT quand le SELECT cible
        // extra_access_codes (le cas JSONB->TEXT motivant ce backfill), sinon vide.
        when(jdbcTemplate.queryForList(anyString())).thenAnswer(invocation -> {
            String sql = invocation.getArgument(0);
            if (sql.contains("extra_access_codes")) {
                return List.of(Map.of("id", 7L, "val", "[{\"label\":\"Parking\",\"code\":\"9012\"}]"));
            }
            return List.of();
        });

        backfill.run(new DefaultApplicationArguments());

        // La ligne 7 a été ré-écrite avec une valeur chiffrée (différente du clair)
        // ET déchiffrable vers le JSON d'origine.
        verify(jdbcTemplate).update(
                eq("UPDATE check_in_instructions SET extra_access_codes = ? WHERE id = ?"),
                argThatIsEncryptedOf("[{\"label\":\"Parking\",\"code\":\"9012\"}]"),
                eq(7L));
    }

    @Test
    @DisplayName("Une valeur déjà chiffrée n'est pas re-chiffrée (idempotence)")
    void whenAlreadyEncrypted_thenSkipped() {
        String alreadyCipher = encryption.encrypt("9012");
        // Première colonne (external_pricing_configs.api_key) renvoie une valeur
        // déjà chiffrée ; toutes les autres colonnes renvoient vide.
        when(jdbcTemplate.queryForList(anyString()))
                .thenReturn(List.of(Map.of("id", 3L, "val", alreadyCipher)))
                .thenReturn(List.of());

        backfill.run(new DefaultApplicationArguments());

        // Aucune écriture : la valeur est déjà chiffrée.
        verify(jdbcTemplate, never()).update(anyString(), any(), any());
    }

    @Test
    @DisplayName("Relancer le backfill sur des valeurs chiffrées n'écrit rien (re-run sûr)")
    void whenRerunOnEncryptedData_thenNoUpdate() {
        String cipher = encryption.encrypt("api_key_xyz");
        when(jdbcTemplate.queryForList(anyString())).thenReturn(List.of(Map.of("id", 1L, "val", cipher)));

        backfill.run(new DefaultApplicationArguments());
        backfill.run(new DefaultApplicationArguments());

        verify(jdbcTemplate, never()).update(anyString(), any(), any());
    }

    @Test
    @DisplayName("Désactivé via flag : aucune requête")
    void whenDisabled_thenNoOp() {
        ReflectionTestUtils.setField(backfill, "enabled", false);

        backfill.run(new DefaultApplicationArguments());

        verify(jdbcTemplate, never()).queryForList(anyString());
    }

    @Test
    @DisplayName("Une colonne absente est ignorée sans erreur")
    void whenColumnMissing_thenSkippedSilently() {
        // information_schema renvoie 0 → colonne absente → pas de SELECT de données.
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), anyString(), anyString()))
                .thenReturn(0);

        backfill.run(new DefaultApplicationArguments());

        verify(jdbcTemplate, never()).queryForList(anyString());
    }

    /** Matcher : argument String chiffré qui se déchiffre vers {@code expectedPlain}. */
    private Object argThatIsEncryptedOf(String expectedPlain) {
        return org.mockito.ArgumentMatchers.argThat((Object arg) -> {
            if (!(arg instanceof String s)) {
                return false;
            }
            if (s.equals(expectedPlain)) {
                return false; // doit être chiffré, pas le clair
            }
            try {
                return expectedPlain.equals(encryption.decrypt(s));
            } catch (RuntimeException e) {
                return false;
            }
        });
    }
}
