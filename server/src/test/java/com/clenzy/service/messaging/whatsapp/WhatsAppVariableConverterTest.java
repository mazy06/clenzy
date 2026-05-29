package com.clenzy.service.messaging.whatsapp;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests pour {@link WhatsAppVariableConverter} : conversion {@code {nom}} ↔ {@code {{N}}}.
 *
 * <p>Couvre les regles critiques :</p>
 * <ul>
 *   <li>Ordre d'apparition stable (1er nom = position 1)</li>
 *   <li>Variable repetee → meme position</li>
 *   <li>Reversibilite {@code toPositional} → {@code fromPositional}</li>
 *   <li>Edge cases : null, vide, pas de variables, noms invalides ignores</li>
 * </ul>
 */
class WhatsAppVariableConverterTest {

    private WhatsAppVariableConverter converter;

    @BeforeEach
    void setUp() {
        converter = new WhatsAppVariableConverter();
    }

    @Nested
    class ToPositional {

        @Test
        void simpleBodyWithTwoUniqueVariables_assignsPositionsInOrder() {
            // Cas nominal : 2 variables distinctes → positions 1 et 2 dans l'ordre d'apparition.
            var result = converter.toPositional("Bonjour {guestFirstName}, code {accessCode}");

            assertThat(result.metaBody()).isEqualTo("Bonjour {{1}}, code {{2}}");
            assertThat(result.orderedVars()).containsExactly("guestFirstName", "accessCode");
        }

        @Test
        void repeatedVariable_keepsSamePosition() {
            // Variable repetee → meme {{N}}. Important : Meta n'aime pas qu'on
            // re-declare la meme variable en {{1}} {{2}}, c'est la meme position.
            var result = converter.toPositional("{guestFirstName} a recu un message. Salut {guestFirstName} !");

            assertThat(result.metaBody()).isEqualTo("{{1}} a recu un message. Salut {{1}} !");
            assertThat(result.orderedVars()).containsExactly("guestFirstName");
        }

        @Test
        void mixedOrderRepeats_assignsByFirstAppearance() {
            // {a}{b}{a}{c}{b} → positions a=1, b=2, c=3 (ordre 1ere apparition)
            var result = converter.toPositional("{a}{b}{a}{c}{b}");

            assertThat(result.metaBody()).isEqualTo("{{1}}{{2}}{{1}}{{3}}{{2}}");
            assertThat(result.orderedVars()).containsExactly("a", "b", "c");
        }

        @Test
        void noVariables_returnsBodyUnchanged() {
            var result = converter.toPositional("Pas de variables ici, juste du texte.");

            assertThat(result.metaBody()).isEqualTo("Pas de variables ici, juste du texte.");
            assertThat(result.orderedVars()).isEmpty();
        }

        @Test
        void nullBody_returnsEmptyResult() {
            var result = converter.toPositional(null);

            assertThat(result.metaBody()).isEmpty();
            assertThat(result.orderedVars()).isEmpty();
        }

        @Test
        void emptyBody_returnsEmptyResult() {
            var result = converter.toPositional("");

            assertThat(result.metaBody()).isEmpty();
            assertThat(result.orderedVars()).isEmpty();
        }

        @Test
        void invalidVariableNames_areLeftAsIs() {
            // {1var} commence par un chiffre → ne match pas le pattern → laisse tel quel.
            // {bad name} contient un espace → ne match pas → laisse tel quel.
            // {} vide → ne match pas → laisse tel quel.
            var result = converter.toPositional("Texte {1var} et {bad name} et {} mais {validVar} ok");

            assertThat(result.metaBody()).isEqualTo("Texte {1var} et {bad name} et {} mais {{1}} ok");
            assertThat(result.orderedVars()).containsExactly("validVar");
        }

        @Test
        void underscoresAndNumbersInName_areAccepted() {
            // Names comme guest_first_name ou var1 sont valides.
            var result = converter.toPositional("Hi {guest_first_name} v{var1}");

            assertThat(result.metaBody()).isEqualTo("Hi {{1}} v{{2}}");
            assertThat(result.orderedVars()).containsExactly("guest_first_name", "var1");
        }

        @Test
        void replacementWithRegexSpecialChars_isEscapedSafely() {
            // Si le body contient des caracteres speciaux regex ($1, \n) PRES d'une
            // variable, Matcher.appendReplacement interprete normalement ces caracteres
            // dans le replacement. On verifie que notre quoteReplacement les neutralise.
            // Ici on teste avec un $ qui suit la variable.
            var result = converter.toPositional("Prix : {amount}$");

            assertThat(result.metaBody()).isEqualTo("Prix : {{1}}$");
            assertThat(result.orderedVars()).containsExactly("amount");
        }

        @Test
        void realCheckinTemplate_convertsCorrectly() {
            // Verifie sur un template reel du seed : 5 variables uniques.
            String namedBody = "Bonjour {guestFirstName} 🏠\n\n"
                + "Votre check-in à *{propertyAddress}* est prévu demain à partir de {checkInTime}.\n\n"
                + "Vous recevrez le code d'accès le jour J à 14h.\n\n"
                + "En cas de question : *{emergencyContact}* au {emergencyPhone}.\n\n"
                + "Bon voyage !";

            var result = converter.toPositional(namedBody);

            assertThat(result.orderedVars()).containsExactly(
                "guestFirstName", "propertyAddress", "checkInTime", "emergencyContact", "emergencyPhone");
            assertThat(result.metaBody())
                .contains("Bonjour {{1}} 🏠")
                .contains("*{{2}}*")
                .contains("à partir de {{3}}")
                .contains("*{{4}}*")
                .contains("au {{5}}.");
        }
    }

    @Nested
    class FromPositional {

        @Test
        void simplePositionalBody_substitutesNames() {
            String result = converter.fromPositional(
                "Bonjour {{1}}, code {{2}}",
                List.of("guestFirstName", "accessCode"));

            assertThat(result).isEqualTo("Bonjour {guestFirstName}, code {accessCode}");
        }

        @Test
        void repeatedPosition_substitutesAllOccurrences() {
            String result = converter.fromPositional(
                "{{1}} a recu un message. Salut {{1}} !",
                List.of("guestFirstName"));

            assertThat(result).isEqualTo("{guestFirstName} a recu un message. Salut {guestFirstName} !");
        }

        @Test
        void positionOutOfRange_leavesPlaceholderAsIs() {
            // {{42}} sans correspondant dans la liste → laisse tel quel pour que
            // l'UI puisse signaler "reference cassee".
            String result = converter.fromPositional(
                "Hello {{1}} and {{42}}",
                List.of("guestFirstName"));

            assertThat(result).isEqualTo("Hello {guestFirstName} and {{42}}");
        }

        @Test
        void emptyOrderedVars_returnsBodyUnchanged() {
            String result = converter.fromPositional(
                "Hello {{1}}",
                List.of());

            assertThat(result).isEqualTo("Hello {{1}}");
        }

        @Test
        void nullInputs_returnEmptyOrUnchanged() {
            assertThat(converter.fromPositional(null, List.of("x"))).isEmpty();
            assertThat(converter.fromPositional("", List.of("x"))).isEmpty();
            assertThat(converter.fromPositional("Hello {{1}}", null)).isEqualTo("Hello {{1}}");
        }
    }

    @Nested
    class Reversibility {

        @Test
        void toPositionalThenFromPositional_yieldsOriginal() {
            // Propriete cle : conversion aller-retour preserve le body original.
            String original = "Hi {guestFirstName}, your booking at {propertyName} is for {checkInDate}.";

            var positional = converter.toPositional(original);
            String recovered = converter.fromPositional(positional.metaBody(), positional.orderedVars());

            assertThat(recovered).isEqualTo(original);
        }

        @Test
        void roundTripWithRepeatedVariable_preservesOriginal() {
            String original = "{a} and {b} and {a} again";

            var positional = converter.toPositional(original);
            String recovered = converter.fromPositional(positional.metaBody(), positional.orderedVars());

            assertThat(recovered).isEqualTo(original);
        }
    }

    @Nested
    class ExtractVariables {

        @Test
        void extractsUniqueVariablesInOrder() {
            var vars = converter.extractVariables("{a}{b}{a}{c}");

            assertThat(vars).containsExactly("a", "b", "c");
        }

        @Test
        void nullOrEmpty_returnsEmptyList() {
            assertThat(converter.extractVariables(null)).isEmpty();
            assertThat(converter.extractVariables("")).isEmpty();
            assertThat(converter.extractVariables("aucune variable")).isEmpty();
        }
    }
}
