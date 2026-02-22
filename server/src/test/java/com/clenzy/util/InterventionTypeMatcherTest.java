package com.clenzy.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests for {@link InterventionTypeMatcher}.
 * Validates team intervention type ↔ service type compatibility matrix.
 */
class InterventionTypeMatcherTest {

    @Nested
    @DisplayName("Null inputs")
    class NullInputs {

        @Test
        void whenNullTeamType_thenReturnsFalse() {
            assertThat(InterventionTypeMatcher.isCompatible(null, "CLEANING")).isFalse();
        }

        @Test
        void whenNullServiceType_thenReturnsFalse() {
            assertThat(InterventionTypeMatcher.isCompatible("CLEANING", null)).isFalse();
        }

        @Test
        void whenBothNull_thenReturnsFalse() {
            assertThat(InterventionTypeMatcher.isCompatible(null, null)).isFalse();
        }
    }

    @Nested
    @DisplayName("CLEANING team type")
    class CleaningTeam {

        @ParameterizedTest
        @CsvSource({
                "CLEANING, CLEANING",
                "CLEANING, EXPRESS_CLEANING",
                "CLEANING, DEEP_CLEANING",
                "CLEANING, WINDOW_CLEANING",
                "CLEANING, FLOOR_CLEANING",
                "CLEANING, KITCHEN_CLEANING",
                "CLEANING, BATHROOM_CLEANING",
                "CLEANING, DISINFECTION",
                "CLEANING, RESTORATION"
        })
        void whenCompatibleServiceType_thenReturnsTrue(String teamType, String serviceType) {
            assertThat(InterventionTypeMatcher.isCompatible(teamType, serviceType)).isTrue();
        }

        @Test
        void whenIncompatibleServiceType_thenReturnsFalse() {
            assertThat(InterventionTypeMatcher.isCompatible("CLEANING", "PLUMBING_REPAIR")).isFalse();
        }
    }

    @Nested
    @DisplayName("MAINTENANCE team type")
    class MaintenanceTeam {

        @ParameterizedTest
        @CsvSource({
                "MAINTENANCE, PREVENTIVE_MAINTENANCE",
                "MAINTENANCE, EMERGENCY_REPAIR",
                "MAINTENANCE, ELECTRICAL_REPAIR",
                "MAINTENANCE, PLUMBING_REPAIR",
                "MAINTENANCE, HVAC_REPAIR",
                "MAINTENANCE, APPLIANCE_REPAIR"
        })
        void whenCompatibleServiceType_thenReturnsTrue(String teamType, String serviceType) {
            assertThat(InterventionTypeMatcher.isCompatible(teamType, serviceType)).isTrue();
        }

        @Test
        void whenIncompatibleServiceType_thenReturnsFalse() {
            assertThat(InterventionTypeMatcher.isCompatible("MAINTENANCE", "CLEANING")).isFalse();
        }
    }

    @Nested
    @DisplayName("OTHER team type")
    class OtherTeam {

        @ParameterizedTest
        @CsvSource({
                "OTHER, GARDENING",
                "OTHER, EXTERIOR_CLEANING",
                "OTHER, PEST_CONTROL",
                "OTHER, OTHER"
        })
        void whenCompatibleServiceType_thenReturnsTrue(String teamType, String serviceType) {
            assertThat(InterventionTypeMatcher.isCompatible(teamType, serviceType)).isTrue();
        }

        @Test
        void whenIncompatibleServiceType_thenReturnsFalse() {
            assertThat(InterventionTypeMatcher.isCompatible("OTHER", "DEEP_CLEANING")).isFalse();
        }
    }

    @Nested
    @DisplayName("Case insensitivity")
    class CaseInsensitivity {

        @Test
        void whenLowercaseTeamType_thenStillMatches() {
            assertThat(InterventionTypeMatcher.isCompatible("cleaning", "CLEANING")).isTrue();
        }

        @Test
        void whenLowercaseServiceType_thenStillMatches() {
            assertThat(InterventionTypeMatcher.isCompatible("CLEANING", "cleaning")).isTrue();
        }

        @Test
        void whenMixedCase_thenStillMatches() {
            assertThat(InterventionTypeMatcher.isCompatible("Maintenance", "Emergency_Repair")).isTrue();
        }
    }

    @Nested
    @DisplayName("Unknown team types")
    class UnknownTeamType {

        @Test
        void whenUnknownTeamType_thenReturnsFalse() {
            assertThat(InterventionTypeMatcher.isCompatible("UNKNOWN", "CLEANING")).isFalse();
        }

        @Test
        void whenEmptyTeamType_thenReturnsFalse() {
            assertThat(InterventionTypeMatcher.isCompatible("", "CLEANING")).isFalse();
        }
    }
}
