package com.clenzy.model;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Le metier de l'intervenant doit correspondre au travail demande.
 *
 * <p>Six interventions de menage etaient assignees a un technicien sur la base
 * de dev : le tarif menage ne s'y applique pas, le score qualite ne les compte
 * pas, et aucun versement ne se declenche. L'assignation automatique filtrait
 * deja sur HOUSEKEEPER ; la manuelle ne verifiait rien.</p>
 */
class InterventionRoleFitTest {

    @ParameterizedTest
    @CsvSource({
            "HOUSEKEEPER, CLEANING",
            "HOUSEKEEPER, DEEP_CLEANING",
            "HOUSEKEEPER, DISINFECTION",
            "LAUNDRY, EXPRESS_CLEANING",
            "TECHNICIAN, PLUMBING_REPAIR",
            "TECHNICIAN, EMERGENCY_REPAIR",
            // Les metiers de terrain se recouvrent : un technicien assure aussi
            // l'exterieur, et reciproquement.
            "TECHNICIAN, GARDENING",
            "EXTERIOR_TECH, PEST_CONTROL",
            "EXTERIOR_TECH, HVAC_REPAIR",
    })
    void whenRoleMatchesTrade_thenAccepted(UserRole role, String type) {
        assertThat(InterventionRoleFit.accepts(role, type)).isTrue();
    }

    @ParameterizedTest
    @CsvSource({
            "TECHNICIAN, CLEANING",
            "TECHNICIAN, BATHROOM_CLEANING",
            "EXTERIOR_TECH, DEEP_CLEANING",
            "HOUSEKEEPER, PLUMBING_REPAIR",
            "HOUSEKEEPER, GARDENING",
            "LAUNDRY, ELECTRICAL_REPAIR",
    })
    void whenRoleDoesNotMatchTrade_thenRejected(UserRole role, String type) {
        assertThat(InterventionRoleFit.accepts(role, type)).isFalse();
    }

    @ParameterizedTest
    @CsvSource({
            "SUPER_ADMIN, CLEANING",
            "SUPER_MANAGER, PLUMBING_REPAIR",
            "SUPERVISOR, CLEANING",
            "HOST, GARDENING",
    })
    void whenSupervisingRole_thenAlwaysAccepted(UserRole role, String type) {
        assertThat(InterventionRoleFit.accepts(role, type)).isTrue();
    }

    @Test
    void whenTypeIsUnknownOrGeneric_thenAccepted() {
        // On ne bloque pas sur une valeur qu'on n'a pas su lire, ni sur les
        // categories fourre-tout.
        assertThat(InterventionRoleFit.accepts(UserRole.TECHNICIAN, "OTHER")).isTrue();
        assertThat(InterventionRoleFit.accepts(UserRole.HOUSEKEEPER, "RESTORATION")).isTrue();
        assertThat(InterventionRoleFit.accepts(UserRole.TECHNICIAN, "TYPE_INCONNU")).isTrue();
        assertThat(InterventionRoleFit.accepts(UserRole.TECHNICIAN, null)).isTrue();
        assertThat(InterventionRoleFit.accepts(null, "CLEANING")).isTrue();
    }

    @Test
    void rejectionMessage_namesBothSides() {
        String message = InterventionRoleFit.rejectionMessage(UserRole.TECHNICIAN, "CLEANING");
        assertThat(message).contains("Nettoyage").contains("Technicien");
    }
}
