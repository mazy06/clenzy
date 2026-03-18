package com.clenzy.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class InterventionTest {

    @Nested
    @DisplayName("Default constructor")
    class DefaultConstructor {

        @Test
        void setsCreatedAt() {
            Intervention intervention = new Intervention();
            assertThat(intervention.getCreatedAt()).isNotNull();
        }

        @Test
        void doesNotSetStartTime() {
            Intervention intervention = new Intervention();
            assertThat(intervention.getStartTime()).isNull();
        }

        @Test
        void setsDefaultStatus() {
            Intervention intervention = new Intervention();
            assertThat(intervention.getStatus()).isEqualTo(InterventionStatus.PENDING);
        }

        @Test
        void setsDefaultProgressToZero() {
            Intervention intervention = new Intervention();
            assertThat(intervention.getProgressPercentage()).isZero();
        }

        @Test
        void setsDefaultPaymentStatus() {
            Intervention intervention = new Intervention();
            assertThat(intervention.getPaymentStatus()).isEqualTo(PaymentStatus.PENDING);
        }
    }

    @Nested
    @DisplayName("getAssignedToType")
    class AssignedToType {

        @Test
        void whenAssignedUser_thenReturnsUser() {
            Intervention intervention = new Intervention();
            User user = new User();
            intervention.setAssignedUser(user);
            assertThat(intervention.getAssignedToType()).isEqualTo("user");
        }

        @Test
        void whenTeamId_thenReturnsTeam() {
            Intervention intervention = new Intervention();
            intervention.setTeamId(5L);
            assertThat(intervention.getAssignedToType()).isEqualTo("team");
        }

        @Test
        void whenNoAssignment_thenReturnsNull() {
            Intervention intervention = new Intervention();
            assertThat(intervention.getAssignedToType()).isNull();
        }
    }
}
