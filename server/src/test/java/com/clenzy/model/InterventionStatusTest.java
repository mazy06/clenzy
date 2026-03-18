package com.clenzy.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import static org.assertj.core.api.Assertions.assertThat;

class InterventionStatusTest {

    @Nested
    @DisplayName("PENDING transitions")
    class PendingTransitions {
        @Test
        void canTransitionToInProgress() {
            assertThat(InterventionStatus.PENDING.canTransitionTo(InterventionStatus.IN_PROGRESS)).isTrue();
        }
        @Test
        void canTransitionToCancelled() {
            assertThat(InterventionStatus.PENDING.canTransitionTo(InterventionStatus.CANCELLED)).isTrue();
        }
        @Test
        void cannotTransitionToCompleted() {
            assertThat(InterventionStatus.PENDING.canTransitionTo(InterventionStatus.COMPLETED)).isFalse();
        }
    }

    @Nested
    @DisplayName("IN_PROGRESS transitions")
    class InProgressTransitions {
        @Test
        void canTransitionToCompleted() {
            assertThat(InterventionStatus.IN_PROGRESS.canTransitionTo(InterventionStatus.COMPLETED)).isTrue();
        }
        @Test
        void canTransitionToCancelled() {
            assertThat(InterventionStatus.IN_PROGRESS.canTransitionTo(InterventionStatus.CANCELLED)).isTrue();
        }
    }

    @Nested
    @DisplayName("COMPLETED transitions")
    class CompletedTransitions {
        @Test
        void canTransitionToInProgress_reopen() {
            assertThat(InterventionStatus.COMPLETED.canTransitionTo(InterventionStatus.IN_PROGRESS)).isTrue();
        }
        @Test
        void cannotTransitionToCancelled() {
            assertThat(InterventionStatus.COMPLETED.canTransitionTo(InterventionStatus.CANCELLED)).isFalse();
        }
    }

    @Nested
    @DisplayName("CANCELLED is terminal")
    class CancelledTransitions {
        @ParameterizedTest
        @EnumSource(InterventionStatus.class)
        void cannotTransitionToAnyStatus(InterventionStatus target) {
            assertThat(InterventionStatus.CANCELLED.canTransitionTo(target)).isFalse();
        }
    }

    @Nested
    @DisplayName("fromString conversion")
    class FromString {
        @Test
        void whenValidString_thenReturnsEnum() {
            assertThat(InterventionStatus.fromString("IN_PROGRESS")).isEqualTo(InterventionStatus.IN_PROGRESS);
        }
        @Test
        void whenLowercaseString_thenReturnsEnum() {
            assertThat(InterventionStatus.fromString("pending")).isEqualTo(InterventionStatus.PENDING);
        }
    }
}
