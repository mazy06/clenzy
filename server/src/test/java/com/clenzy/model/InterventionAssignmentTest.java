package com.clenzy.model;

import org.junit.jupiter.api.Test;
import java.time.LocalDateTime;
import static org.assertj.core.api.Assertions.*;

class InterventionAssignmentTest {
    @Test
    void aReplacementNeverInheritsThePreviousAcceptance() {
        Intervention intervention = new Intervention();
        User first = new User(); first.setId(1L);
        User replacement = new User(); replacement.setId(2L);
        intervention.proposeAssignment(first, null);
        intervention.setAssignmentResponse(InterventionAssignmentResponse.ACCEPTED);
        intervention.setAssignmentRespondedAt(LocalDateTime.now());
        intervention.proposeAssignment(replacement, null);
        assertThat(intervention.getAssignmentResponse()).isEqualTo(InterventionAssignmentResponse.PENDING);
        assertThat(intervention.getAssignmentRespondedAt()).isNull();
        assertThat(intervention.getAssignedTechnicianId()).isEqualTo(2L);
    }

    @Test
    void repeatingTheSameAssignmentPreservesItsAcceptance() {
        Intervention intervention = new Intervention();
        intervention.proposeAssignment(null, 42L);
        intervention.setAssignmentResponse(InterventionAssignmentResponse.ACCEPTED);
        intervention.proposeAssignment(null, 42L);
        assertThat(intervention.getAssignmentResponse()).isEqualTo(InterventionAssignmentResponse.ACCEPTED);
    }
}
