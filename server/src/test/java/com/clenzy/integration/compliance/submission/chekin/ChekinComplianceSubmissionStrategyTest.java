package com.clenzy.integration.compliance.submission.chekin;

import com.clenzy.integration.compliance.model.ComplianceConnection;
import com.clenzy.integration.compliance.model.ComplianceProviderType;
import com.clenzy.integration.compliance.submission.SubmissionResult;
import com.clenzy.model.GuestDeclaration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChekinComplianceSubmissionStrategyTest {

    @Mock private ChekinApiClient client;

    private ComplianceConnection connection() {
        ComplianceConnection c = new ComplianceConnection();
        c.setProviderType(ComplianceProviderType.CHEKIN);
        c.setServerUrl("https://staging.example/public/api/v1");
        c.setAccountIdentifier("housing-77");
        return c;
    }

    private GuestDeclaration declaration() {
        GuestDeclaration d = new GuestDeclaration();
        d.setId(7L);
        d.setFirstName("Jean");
        d.setLastName("Dupont");
        d.setBirthDate("1990-05-12");
        d.setNationality("FR");
        d.setIdDocumentType("PASSPORT");
        d.setIdDocumentNumber("12AB34567");
        return d;
    }

    @Test
    void provider_isChekin() {
        assertThat(new ChekinComplianceSubmissionStrategy(client).provider())
                .isEqualTo(ComplianceProviderType.CHEKIN);
    }

    @Test
    void submit_exchangesTokenThenCreatesGuest_mapsFields() {
        ChekinComplianceSubmissionStrategy strategy = new ChekinComplianceSubmissionStrategy(client);
        ComplianceConnection conn = connection();
        when(client.exchangeApiKeyForToken(eq(conn.getServerUrl()), anyString(), eq("plain-key")))
                .thenReturn("jwt-token");
        when(client.createGuest(eq(conn.getServerUrl()), anyString(), eq("jwt-token"), any()))
                .thenReturn("guest-999");

        SubmissionResult result = strategy.submit(declaration(), conn, "plain-key");

        assertThat(result.accepted()).isTrue();
        assertThat(result.externalReference()).isEqualTo("guest-999");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> payloadCaptor = ArgumentCaptor.forClass(Map.class);
        verify(client).createGuest(eq(conn.getServerUrl()), anyString(), eq("jwt-token"), payloadCaptor.capture());
        Map<String, Object> payload = payloadCaptor.getValue();
        assertThat(payload).containsEntry("name", "Jean");
        assertThat(payload).containsEntry("surname", "Dupont");
        assertThat(payload).containsEntry("birth_date", "1990-05-12");
        assertThat(payload).containsEntry("document_number", "12AB34567");
        assertThat(payload).containsEntry("housing_id", "housing-77");
    }

    @Test
    void submit_providerReturns4xx_rejectedNotSwallowed() {
        ChekinComplianceSubmissionStrategy strategy = new ChekinComplianceSubmissionStrategy(client);
        ComplianceConnection conn = connection();
        when(client.exchangeApiKeyForToken(anyString(), anyString(), anyString())).thenReturn("jwt-token");
        when(client.createGuest(anyString(), anyString(), anyString(), any()))
                .thenThrow(HttpClientErrorException.create(
                        HttpStatus.UNPROCESSABLE_ENTITY, "Unprocessable", null, null, null));

        SubmissionResult result = strategy.submit(declaration(), conn, "plain-key");

        assertThat(result.accepted()).isFalse();
        assertThat(result.message()).contains("422");
    }
}
