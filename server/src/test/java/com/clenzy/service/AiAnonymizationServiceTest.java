package com.clenzy.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.*;

class AiAnonymizationServiceTest {

    private AiAnonymizationService service;

    @BeforeEach
    void setUp() {
        service = new AiAnonymizationService();
    }

    // ─── Null / Empty / Blank ────────────────────────────────────────────

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "\t", "\n"})
    @DisplayName("null, empty, blank inputs are returned as-is")
    void nullEmptyBlank_returnedAsIs(String input) {
        assertEquals(input, service.anonymize(input));
    }

    // ─── Emails ──────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Email anonymization")
    class Emails {

        @Test
        void simpleEmail_isRedacted() {
            String result = service.anonymize("Contact: john@example.com");
            assertEquals("Contact: [EMAIL_REDACTED]", result);
            assertFalse(result.contains("john@example.com"));
        }

        @Test
        void multipleEmails_allRedacted() {
            String result = service.anonymize("From alice@test.fr to bob.dupont@hotel.co.uk");
            assertFalse(result.contains("alice@test.fr"));
            assertFalse(result.contains("bob.dupont@hotel.co.uk"));
            assertEquals(2, countOccurrences(result, "[EMAIL_REDACTED]"));
        }

        @Test
        void emailWithSpecialChars_isRedacted() {
            String result = service.anonymize("user+tag@sub.domain.org");
            assertEquals("[EMAIL_REDACTED]", result);
        }
    }

    // ─── Telephones FR ───────────────────────────────────────────────────

    @Nested
    @DisplayName("French phone anonymization")
    class PhonesFR {

        @Test
        void frenchMobile_isRedacted() {
            String result = service.anonymize("Tel: 06 12 34 56 78");
            assertEquals("Tel: [PHONE_REDACTED]", result);
        }

        @Test
        void frenchLandline_isRedacted() {
            String result = service.anonymize("Bureau: 01.23.45.67.89");
            assertEquals("Bureau: [PHONE_REDACTED]", result);
        }

        @Test
        void frenchWithPlus33_isRedacted() {
            String result = service.anonymize("Appelez +33 6 12 34 56 78");
            assertEquals("Appelez [PHONE_REDACTED]", result);
        }

        @Test
        void frenchWithDashes_isRedacted() {
            String result = service.anonymize("Fax: 04-56-78-90-12");
            assertEquals("Fax: [PHONE_REDACTED]", result);
        }
    }

    // ─── Telephones International ────────────────────────────────────────

    @Nested
    @DisplayName("International phone anonymization")
    class PhonesInternational {

        @Test
        void usNumber_isRedacted() {
            String result = service.anonymize("US: +1 555 123 4567");
            assertEquals("US: [PHONE_REDACTED]", result);
        }

        @Test
        void ukNumber_isRedacted() {
            String result = service.anonymize("UK: +44 20 7123 4567");
            assertEquals("UK: [PHONE_REDACTED]", result);
        }
    }

    // ─── Cartes bancaires ────────────────────────────────────────────────

    @Nested
    @DisplayName("Credit card anonymization")
    class CreditCards {

        @Test
        void visaWithSpaces_isRedacted() {
            String result = service.anonymize("Carte: 4111 1111 1111 1111");
            assertTrue(result.contains("[CREDIT_CARD_REDACTED]"));
            assertFalse(result.contains("4111"));
        }

        @Test
        void mastercardWithDashes_isRedacted() {
            String result = service.anonymize("MC: 5500-0000-0000-0004");
            assertTrue(result.contains("[CREDIT_CARD_REDACTED]"));
            assertFalse(result.contains("5500"));
        }
    }

    // ─── IBAN ────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("IBAN anonymization")
    class IBANs {

        @Test
        void frenchIBAN_isRedacted() {
            String result = service.anonymize("IBAN: FR76 3000 6000 0112 3456 7890 189");
            assertTrue(result.contains("[IBAN_REDACTED]"));
            assertFalse(result.contains("FR76"));
        }

        @Test
        void germanIBAN_isRedacted() {
            String result = service.anonymize("DE89 3704 0044 0532 0130 00");
            assertTrue(result.contains("[IBAN_REDACTED]"));
            assertFalse(result.contains("DE89"));
        }
    }

    // ─── Texte mixte ────────────────────────────────────────────────────

    @Nested
    @DisplayName("Mixed text with multiple PII types")
    class MixedText {

        @Test
        void multipleTypes_allRedacted() {
            String input = "Client: jean@hotel.fr, tel 06 12 34 56 78, " +
                    "CB 4111 1111 1111 1111, IBAN FR76 3000 6000 0112 3456 7890 189";
            String result = service.anonymize(input);

            assertTrue(result.contains("[EMAIL_REDACTED]"));
            assertTrue(result.contains("[PHONE_REDACTED]"));
            assertTrue(result.contains("[CREDIT_CARD_REDACTED]") || result.contains("[IBAN_REDACTED]"));
            assertFalse(result.contains("jean@hotel.fr"));
            assertFalse(result.contains("06 12 34 56 78"));
        }
    }

    // ─── Texte sans PII ─────────────────────────────────────────────────

    @Test
    @DisplayName("Text without PII is preserved intact")
    void textWithoutPII_preserved() {
        String input = "Bonjour, la reservation pour 3 nuits du 15 au 18 mars coute 450 EUR.";
        assertEquals(input, service.anonymize(input));
    }

    // ─── deAnonymize (V1 passthrough) ────────────────────────────────────

    @Test
    @DisplayName("deAnonymize returns text unchanged (V1)")
    void deAnonymize_returnsUnchanged() {
        String text = "Contact: [EMAIL_REDACTED], tel [PHONE_REDACTED]";
        assertEquals(text, service.deAnonymize(text));
    }

    // ─── Helper ──────────────────────────────────────────────────────────

    private int countOccurrences(String text, String substring) {
        int count = 0;
        int idx = 0;
        while ((idx = text.indexOf(substring, idx)) != -1) {
            count++;
            idx += substring.length();
        }
        return count;
    }
}
