package com.clenzy.integration.compliance.controller;

import com.clenzy.integration.compliance.model.ComplianceProviderType;
import com.clenzy.integration.compliance.submission.ComplianceProviderPendingException;
import com.clenzy.integration.compliance.submission.ComplianceSubmissionService;
import com.clenzy.integration.compliance.submission.SubmissionResult;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ComplianceSubmissionControllerTest {

    @Mock private ComplianceSubmissionService service;

    @Test
    void submit_accepted_returnsResult() {
        when(service.retrySubmission(42L))
                .thenReturn(Optional.of(SubmissionResult.accepted("ext-1", "ok")));

        ResponseEntity<?> response = new ComplianceSubmissionController(service).submit(42L);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        assertThat((Map<String, Object>) response.getBody()).containsEntry("accepted", true);
    }

    @Test
    void submit_skipped_returnsOkWithSkipped() {
        when(service.retrySubmission(42L)).thenReturn(Optional.empty());

        ResponseEntity<?> response = new ComplianceSubmissionController(service).submit(42L);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat((Map<String, Object>) response.getBody()).containsEntry("skipped", true);
    }

    @Test
    void submit_providerPending_returns501() {
        when(service.retrySubmission(42L)).thenThrow(
                new ComplianceProviderPendingException(ComplianceProviderType.POLICE_MA, "pending"));

        ResponseEntity<?> response = new ComplianceSubmissionController(service).submit(42L);

        assertThat(response.getStatusCode().value()).isEqualTo(501);
        assertThat((Map<String, Object>) response.getBody()).containsEntry("pending", true);
    }
}
