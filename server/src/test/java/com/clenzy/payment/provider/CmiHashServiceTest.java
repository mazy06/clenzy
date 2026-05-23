package com.clenzy.payment.provider;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Nested;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Tests unitaires pour {@link CmiHashService}.
 *
 * <h2>Strategie</h2>
 * <p>Le hash SHA-512 ver3 CMI est <strong>extremement sensible</strong> a
 * l'ordre des champs, a l'echappement des caracteres speciaux et a l'encodage.
 * Une seule de ces regles violee = paiement rejete par CMI avec un message
 * generique impossible a diagnostiquer en prod.</p>
 *
 * <p>Pour valider la conformite, on couvre :</p>
 * <ul>
 *   <li>Vecteurs de test calcules a la main avec la formule officielle</li>
 *   <li>Cas d'echappement ({@code |}, {@code \}, et combinaisons)</li>
 *   <li>Cas de tri (champs en ordre random vs trie, casse mixte)</li>
 *   <li>Exclusion des champs reserves ({@code HASH}, {@code encoding})</li>
 *   <li>Verification round-trip (compute → verify identique sur meme input)</li>
 *   <li>Resistance aux tentatives de tamper (un seul bit modifie = reject)</li>
 *   <li>Conversion des devises ISO 4217 vers code numerique CMI</li>
 * </ul>
 */
class CmiHashServiceTest {

    private CmiHashService service;

    @BeforeEach
    void setUp() {
        service = new CmiHashService();
    }

    // ─── Round-trip basique ────────────────────────────────────────────────

    @Test
    @DisplayName("computeHash + verifyHash forment un round-trip valide")
    void computeThenVerify_roundtripValid() {
        Map<String, String> params = sampleCmiParams();
        String storeKey = "STORE_KEY_TEST_123";

        String hash = service.computeHash(params, storeKey);
        Map<String, String> withHash = new LinkedHashMap<>(params);
        withHash.put("HASH", hash);

        assertThat(service.verifyHash(withHash, storeKey)).isTrue();
    }

    @Test
    @DisplayName("computeHash retourne du Base64 standard (longueur 88 pour SHA-512)")
    void computeHash_returnsBase64() {
        String hash = service.computeHash(Map.of("clientid", "100", "amount", "50.00"), "key");
        // SHA-512 = 64 bytes → Base64 = 88 chars (ceil(64/3)*4)
        assertThat(hash).hasSize(88);
        assertThat(hash).matches("^[A-Za-z0-9+/]+={0,2}$");
    }

    // ─── Tri des champs ────────────────────────────────────────────────────

    @Test
    @DisplayName("L'ordre d'insertion des params n'impacte pas le hash (tri alphabetique)")
    void computeHash_orderIndependent() {
        Map<String, String> ordered = new LinkedHashMap<>();
        ordered.put("amount", "100.00");
        ordered.put("clientid", "MERCHANT_001");
        ordered.put("oid", "TX-001");

        Map<String, String> reversed = new LinkedHashMap<>();
        reversed.put("oid", "TX-001");
        reversed.put("clientid", "MERCHANT_001");
        reversed.put("amount", "100.00");

        String h1 = service.computeHash(ordered, "key");
        String h2 = service.computeHash(reversed, "key");
        assertThat(h1).isEqualTo(h2);
    }

    @Test
    @DisplayName("Le tri est case-insensitive sur les noms de champs")
    void computeHash_caseInsensitiveFieldSort() {
        // 'amount', 'AMOUNT', 'Amount' doivent etre traites au meme endroit
        // alphabetique — mais ils ne peuvent pas coexister (TreeMap les ecrase).
        // Verifie que casser la casse d'un champ ne change pas le hash.
        Map<String, String> lower = Map.of("amount", "50.00", "clientid", "M1");
        Map<String, String> upper = Map.of("AMOUNT", "50.00", "CLIENTID", "M1");

        // Comme TreeMap est case-insensitive, lower et upper produisent les
        // memes "valeurs", donc le hash doit etre identique.
        assertThat(service.computeHash(lower, "key"))
            .isEqualTo(service.computeHash(upper, "key"));
    }

    // ─── Exclusion HASH / encoding ─────────────────────────────────────────

    @Test
    @DisplayName("Le champ HASH lui-meme n'est pas inclus dans le calcul")
    void computeHash_excludesHashField() {
        Map<String, String> base = Map.of("amount", "100", "clientid", "M1");
        String h1 = service.computeHash(base, "key");

        Map<String, String> withFakeHash = new HashMap<>(base);
        withFakeHash.put("HASH", "tampered-hash-value-here");
        String h2 = service.computeHash(withFakeHash, "key");

        assertThat(h1).isEqualTo(h2);
    }

    @Test
    @DisplayName("Le champ 'encoding' est exclu du calcul")
    void computeHash_excludesEncodingField() {
        Map<String, String> base = Map.of("amount", "100", "clientid", "M1");
        String h1 = service.computeHash(base, "key");

        Map<String, String> withEncoding = new HashMap<>(base);
        withEncoding.put("encoding", "utf-8");
        String h2 = service.computeHash(withEncoding, "key");

        assertThat(h1).isEqualTo(h2);
    }

    @Test
    @DisplayName("L'exclusion HASH/encoding est case-insensitive")
    void computeHash_excludesAreCaseInsensitive() {
        Map<String, String> base = Map.of("amount", "100", "clientid", "M1");
        String h1 = service.computeHash(base, "key");

        Map<String, String> withVariants = new HashMap<>(base);
        withVariants.put("hash", "x");      // lowercase
        withVariants.put("Hash", "x");      // mixed
        withVariants.put("ENCODING", "x");  // uppercase
        String h2 = service.computeHash(withVariants, "key");

        assertThat(h1).isEqualTo(h2);
    }

    // ─── Echappement ────────────────────────────────────────────────────────

    @Test
    @DisplayName("Le caractere | dans une valeur est echappe en \\|")
    void escape_pipeCharacter() {
        // Vecteur de reference calcule a la main :
        //   params = {"a": "x|y"} avec storeKey = "k"
        //   plaintext = "x\\|y" + "|" + "k" = "x\\|y|k"
        //   sha512(...) → base64
        Map<String, String> params = Map.of("a", "x|y");
        String hash = service.computeHash(params, "k");

        String expected = sha512Base64("x\\|y|k");
        assertThat(hash).isEqualTo(expected);
    }

    @Test
    @DisplayName("Le caractere \\ dans une valeur est echappe en \\\\")
    void escape_backslashCharacter() {
        // params = {"a": "x\\y"} avec storeKey = "k"
        // plaintext = "x\\\\y" + "|" + "k"
        Map<String, String> params = Map.of("a", "x\\y");
        String hash = service.computeHash(params, "k");

        String expected = sha512Base64("x\\\\y|k");
        assertThat(hash).isEqualTo(expected);
    }

    @Test
    @DisplayName("Echappement ordonne : \\ avant | (pas de double-escape)")
    void escape_orderingBackslashThenPipe() {
        // params = {"a": "x\\|y"} → on attend "x\\\\\\|y"
        // (le \ devient \\, puis le | devient \|, donnant \\\\\|)
        Map<String, String> params = Map.of("a", "x\\|y");
        String hash = service.computeHash(params, "k");

        String expected = sha512Base64("x\\\\\\|y|k");
        assertThat(hash).isEqualTo(expected);
    }

    // ─── Inclusion du storeKey ──────────────────────────────────────────────

    @Test
    @DisplayName("Le storeKey est echappe aussi (caracteres speciaux)")
    void computeHash_escapesStoreKey() {
        Map<String, String> params = Map.of("a", "1");
        String storeKeyWithPipe = "key|secret";

        String hash = service.computeHash(params, storeKeyWithPipe);
        String expected = sha512Base64("1|key\\|secret");
        assertThat(hash).isEqualTo(expected);
    }

    @Test
    @DisplayName("Changer le storeKey change le hash")
    void computeHash_changesWithStoreKey() {
        Map<String, String> params = sampleCmiParams();
        String h1 = service.computeHash(params, "key1");
        String h2 = service.computeHash(params, "key2");
        assertThat(h1).isNotEqualTo(h2);
    }

    // ─── Verification ───────────────────────────────────────────────────────

    @Test
    @DisplayName("verifyHash retourne false si le HASH est absent")
    void verifyHash_missingHash_false() {
        Map<String, String> params = Map.of("clientid", "M1", "amount", "100");
        assertThat(service.verifyHash(params, "key")).isFalse();
    }

    @Test
    @DisplayName("verifyHash retourne false pour un payload tampere (1 char modifie)")
    void verifyHash_tamperedPayload_false() {
        Map<String, String> params = sampleCmiParams();
        String storeKey = "key";
        String hash = service.computeHash(params, storeKey);

        Map<String, String> tampered = new HashMap<>(params);
        tampered.put("amount", "999.99"); // attaque : modifier le montant
        tampered.put("HASH", hash);

        assertThat(service.verifyHash(tampered, storeKey)).isFalse();
    }

    @Test
    @DisplayName("verifyHash retourne false pour un mauvais storeKey")
    void verifyHash_wrongStoreKey_false() {
        Map<String, String> params = sampleCmiParams();
        String hash = service.computeHash(params, "real_key");

        Map<String, String> received = new HashMap<>(params);
        received.put("HASH", hash);
        assertThat(service.verifyHash(received, "wrong_key")).isFalse();
    }

    @Test
    @DisplayName("verifyHash retourne false pour un null params")
    void verifyHash_nullParams_false() {
        assertThat(service.verifyHash(null, "key")).isFalse();
    }

    // ─── Robustesse des arguments ──────────────────────────────────────────

    @Test
    @DisplayName("computeHash refuse un storeKey null")
    void computeHash_nullStoreKey_throws() {
        assertThatThrownBy(() -> service.computeHash(Map.of("a", "1"), null))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("computeHash refuse un storeKey vide")
    void computeHash_emptyStoreKey_throws() {
        assertThatThrownBy(() -> service.computeHash(Map.of("a", "1"), ""))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("computeHash refuse un params null")
    void computeHash_nullParams_throws() {
        assertThatThrownBy(() -> service.computeHash(null, "key"))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("Une valeur null est traitee comme une chaine vide")
    void computeHash_nullValueTreatedAsEmpty() {
        Map<String, String> withNull = new HashMap<>();
        withNull.put("a", null);
        withNull.put("b", "");

        // params equivalent : {"a": "", "b": ""}
        Map<String, String> withEmpty = Map.of("a", "", "b", "");

        assertThat(service.computeHash(withNull, "k"))
            .isEqualTo(service.computeHash(withEmpty, "k"));
    }

    // ─── Conversion devises ─────────────────────────────────────────────────

    @Nested
    @DisplayName("Conversion devises ISO 4217 → CMI")
    class CurrencyConversion {

        @Test
        void mad_returns504() {
            assertThat(CmiHashService.toCmiCurrencyCode("MAD")).isEqualTo("504");
        }

        @Test
        void eur_returns978() {
            assertThat(CmiHashService.toCmiCurrencyCode("EUR")).isEqualTo("978");
        }

        @Test
        void usd_returns840() {
            assertThat(CmiHashService.toCmiCurrencyCode("USD")).isEqualTo("840");
        }

        @Test
        void caseInsensitive() {
            assertThat(CmiHashService.toCmiCurrencyCode("mad")).isEqualTo("504");
            assertThat(CmiHashService.toCmiCurrencyCode("Eur")).isEqualTo("978");
        }

        @Test
        void nullDefaultsToMad() {
            assertThat(CmiHashService.toCmiCurrencyCode(null)).isEqualTo("504");
        }

        @Test
        void unsupportedThrows() {
            assertThatThrownBy(() -> CmiHashService.toCmiCurrencyCode("JPY"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("CMI");
        }
    }

    // ─── Helpers ───────────────────────────────────────────────────────────

    private static Map<String, String> sampleCmiParams() {
        Map<String, String> p = new LinkedHashMap<>();
        p.put("clientid", "MERCHANT_001");
        p.put("amount", "250.00");
        p.put("currency", "504");
        p.put("oid", "TX-abc123");
        p.put("okUrl", "https://app.clenzy.fr/booking/success");
        p.put("failUrl", "https://app.clenzy.fr/booking/error");
        p.put("callbackUrl", "https://api.clenzy.fr/api/webhooks/payments/cmi");
        p.put("TranType", "Auth");
        p.put("storetype", "3D_PAY_HOSTING");
        p.put("hashAlgorithm", "ver3");
        p.put("rnd", "abc123def456");
        p.put("lang", "fr");
        return p;
    }

    /** Helper : calcule SHA-512 + base64 sur un plaintext en clair (pour vecteurs). */
    private static String sha512Base64(String plaintext) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-512");
            byte[] sha = md.digest(plaintext.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(sha);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
