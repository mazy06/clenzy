package com.clenzy.controller;

import com.clenzy.dto.OpsAlertRequest;
import com.clenzy.service.NotificationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class BaitlyOpsAlertControllerTest {
    final NotificationService notifications = mock(NotificationService.class);
    final SimpleMeterRegistry registry = new SimpleMeterRegistry();
    final OpsAlertController controller = new OpsAlertController(notifications, "test-ops-token", registry);
    final ObjectMapper json = new ObjectMapper();

    @Test void opaqueOpsSchemePassesJwtFilterButStillRequiresTheSharedSecret() throws Exception {
        var filter = new BearerTokenAuthenticationFilter((org.springframework.security.authentication.AuthenticationManager) authentication -> {
            throw new OAuth2AuthenticationException(new OAuth2Error("invalid_token"));
        });
        var mvc = MockMvcBuilders.standaloneSetup(controller).addFilters(filter).build();
        when(notifications.notifyPlatformOpsStrict(anyString(), anyString(), isNull())).thenReturn(1);
        String payload = "{\"status\":\"firing\",\"alerts\":[{}]}";
        mvc.perform(post("/api/ops/alerts/alertmanager").contentType("application/json")
                .header("Authorization", "Bearer test-ops-token").content(payload)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/ops/alerts/alertmanager").contentType("application/json")
                .header("Authorization", "BaitlyOps wrong").content(payload)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/ops/alerts/alertmanager").contentType("application/json")
                .header("Authorization", "Basic test-ops-token").content(payload)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/ops/alerts/alertmanager").contentType("application/json")
                .content(payload)).andExpect(status().isUnauthorized());
        verifyNoInteractions(notifications);
        mvc.perform(post("/api/ops/alerts/alertmanager").contentType("application/json")
                .header("Authorization", "BaitlyOps test-ops-token").content(payload)).andExpect(status().isAccepted());
        verify(notifications).notifyPlatformOpsStrict(anyString(), anyString(), isNull());
    }

    @Test void refusesMissingInvalidAndUnconfiguredTokensWithoutNotifying() throws Exception {
        var payload = json.readTree("{\"status\":\"firing\",\"alerts\":[{}]}");
        assertThat(controller.receiveAlertmanager(payload, null, null).getStatusCode().value()).isEqualTo(401);
        assertThat(controller.receiveAlertmanager(payload, "wrong", null).getStatusCode().value()).isEqualTo(401);
        assertThat(new OpsAlertController(notifications, "", registry)
                .receiveAlertmanager(payload, "test-ops-token", null).getStatusCode().value()).isEqualTo(401);
        verifyNoInteractions(notifications);
    }

    @Test void forwardsOnlyControlledLabelsAndCountsAcceptedNotifications() throws Exception {
        when(notifications.notifyPlatformOpsStrict(anyString(),anyString(),isNull())).thenReturn(1);
        var payload = json.readTree("""
            {"status":"firing","alerts":[
              {"labels":{"alertname":"BaitlyOutboxExhausted","severity":"critical","customer":"PRIVATE"},
               "annotations":{"summary":"PRIVATE email@example.test","description":"SECRET"}},
              {"labels":{"alertname":"PRIVATE","severity":"SECRET"}}]}
            """);
        assertThat(controller.receiveAlertmanager(payload, null, "Bearer test-ops-token").getStatusCode().value()).isEqualTo(202);
        var title = ArgumentCaptor.forClass(String.class);
        var message = ArgumentCaptor.forClass(String.class);
        verify(notifications).notifyPlatformOpsStrict(title.capture(),message.capture(),isNull());
        assertThat(title.getValue()).contains("BaitlyOutboxExhausted", "MonitoringAlert").doesNotContain("PRIVATE");
        assertThat(message.getValue()).doesNotContain("PRIVATE", "SECRET", "example.test");
        assertThat(registry.get("baitly.ops.alerts.received").tags("source","alertmanager","status","firing").counter().count()).isEqualTo(1);
    }

    @Test void rejectsEmptyInvalidStatusAndOversizedGroups() throws Exception {
        assertThat(controller.receiveAlertmanager(json.readTree("{\"alerts\":[]}"),"test-ops-token",null).getStatusCode().value()).isEqualTo(400);
        assertThat(controller.receiveAlertmanager(json.readTree("{\"status\":\"PRIVATE\",\"alerts\":[{}]}"),"test-ops-token",null).getStatusCode().value()).isEqualTo(400);
        var payload = json.createObjectNode(); var alerts = payload.putArray("alerts");
        for(int i=0;i<51;i++) alerts.addObject();
        assertThat(controller.receiveAlertmanager(payload,"test-ops-token",null).getStatusCode().value()).isEqualTo(400);
        verifyNoInteractions(notifications);
    }

    @Test void acceptsRecoveryWithoutRecordingAnErrorOrPrivateText() throws Exception {
        when(notifications.notifyPlatformOpsStrict(anyString(),anyString(),isNull())).thenReturn(1);
        var payload=json.readTree("{\"status\":\"resolved\",\"alerts\":[{\"labels\":{\"alertname\":\"BaitlyOutboxExhausted\"}}]}");
        assertThat(controller.receiveAlertmanager(payload,"test-ops-token",null).getStatusCode().value()).isEqualTo(202);
        assertThat(registry.get("baitly.ops.alerts.received").tags("source","alertmanager","status","resolved").counter().count()).isEqualTo(1);
    }

    @Test void storageFailureReturnsRetryableStatusWithoutClaimingAcceptanceOrLeakingDetails() throws Exception {
        when(notifications.notifyPlatformOpsStrict(anyString(),anyString(),isNull()))
                .thenThrow(new IllegalStateException("PRIVATE SQL secret@example.test"));
        var payload=json.readTree("{\"status\":\"firing\",\"alerts\":[{}]}");
        var response=controller.receiveAlertmanager(payload,"test-ops-token",null);
        assertThat(response.getStatusCode().value()).isEqualTo(503);
        assertThat(response.getBody().toString()).isEqualTo("{error=notification_unavailable}");
        assertThat(registry.find("baitly.ops.alerts.received").counter()).isNull();
        assertThat(registry.get("baitly.ops.alerts.rejected").tag("source","alertmanager").counter().count()).isEqualTo(1);
    }

    @Test void zeroRecipientsReturnsRetryableStatusForCiAsWell() {
        var response=controller.receive(new OpsAlertRequest("critical","Test","Synthetic","ci",null),"test-ops-token");
        assertThat(response.getStatusCode().value()).isEqualTo(503);
        assertThat(registry.find("baitly.ops.alerts.received").counter()).isNull();
    }

    @Test void successfulCiNotificationIsAcknowledgedAfterPersistence() {
        when(notifications.notifyPlatformOpsStrict(anyString(),anyString(),isNull())).thenReturn(2);
        assertThat(controller.receive(new OpsAlertRequest("critical","Test","Synthetic","ci",null),"test-ops-token")
                .getStatusCode().value()).isEqualTo(202);
        assertThat(registry.get("baitly.ops.alerts.received").tag("source","ci").counter().count()).isEqualTo(1);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.NullAndEmptySource
    @org.junit.jupiter.params.provider.ValueSource(strings = {
            "https://github.com/mazy06/clenzy/actions/runs/123?token=synthetic-private",
            "https://github.com/mazy06/clenzy/actions/runs/123#synthetic-private",
            "https://synthetic-private@github.com/mazy06/clenzy/actions/runs/123",
            "http://github.com/mazy06/clenzy/actions/runs/123",
            "https://github.com:443/mazy06/clenzy/actions/runs/123",
            "https://github.com.evil.invalid/mazy06/clenzy/actions/runs/123",
            "https://github.com/other/clenzy/actions/runs/123",
            "https://github.com/mazy06/unknown/actions/runs/123",
            "https://github.com/mazy06/clenzy/actions/runs/0",
            "https://github.com/mazy06/clenzy/actions/runs/123/../synthetic-private",
            "https://github.com/mazy06/clenzy/actions/runs/%31%32%33",
            "/settings?token=synthetic-private", "//evil.invalid/synthetic-private",
            "javascript:synthetic-private", "synthetic-private\ninvalid-uri"})
    void ciPrivatePayloadAndUnsafeLinksAreNeverPersisted(String link) {
        when(notifications.notifyPlatformOpsStrict(anyString(),anyString(),isNull())).thenReturn(1);
        var req = new OpsAlertRequest("synthetic-private", "synthetic-private@example.invalid",
                "token=synthetic-private SQL <script>", "synthetic-private-source",link);
        var response = controller.receive(req,"test-ops-token");
        assertThat(response.getStatusCode().value()).isEqualTo(202);
        var title = ArgumentCaptor.forClass(String.class); var message = ArgumentCaptor.forClass(String.class);
        verify(notifications).notifyPlatformOpsStrict(title.capture(),message.capture(),isNull());
        assertThat(title.getValue()).isEqualTo("[critical] Baitly : alerte d’exploitation");
        assertThat(message.getValue()).isEqualTo("Consulter le monitoring interne et le guide d’incident.");
        assertThat(registry.getMeters()).allSatisfy(meter ->
                assertThat(meter.getId().toString()).doesNotContain("synthetic-private","token=","example.invalid"));
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {
            "https://github.com/mazy06/clenzy/actions/runs/123",
            "https://github.com/mazy06/clenzy-infra/actions/runs/123/attempts/2",
            "https://github.com/mazy06/clenzy-sites/actions/runs/123/job/456"})
    void trustedPublicRunLinkSurvivesWithoutFreeDiagnostic(String link) {
        when(notifications.notifyPlatformOpsStrict(anyString(),anyString(),isNull())).thenReturn(1);
        controller.receive(new OpsAlertRequest("warning","synthetic-private","synthetic-private","synthetic-private",link),"test-ops-token");
        var title = ArgumentCaptor.forClass(String.class); var message = ArgumentCaptor.forClass(String.class);
        verify(notifications).notifyPlatformOpsStrict(title.capture(),message.capture(),isNull());
        assertThat(title.getValue()).isEqualTo("[warning] Baitly : alerte d’exploitation");
        assertThat(message.getValue()).endsWith(link).doesNotContain("synthetic-private");
    }

    @Test void ciAuthenticationAndRecipientFailureStayClosedWithPrivatePayload() {
        var req = new OpsAlertRequest("info","synthetic-private","synthetic-private","ci",null);
        assertThat(controller.receive(req,"wrong").getStatusCode().value()).isEqualTo(401);
        verifyNoInteractions(notifications);
        when(notifications.notifyPlatformOpsStrict(anyString(),anyString(),isNull()))
                .thenThrow(new IllegalStateException("synthetic-private SQL token"));
        var response = controller.receive(req,"test-ops-token");
        assertThat(response.getStatusCode().value()).isEqualTo(503);
        assertThat(response.getBody().toString()).doesNotContain("synthetic-private");
        assertThat(registry.find("baitly.ops.alerts.received").counter()).isNull();
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"BaitlyRecoveryMetricsUnavailable","BaitlyRecoveryMetricsStale",
            "BaitlyAccountingExportStalled","BaitlyAccountingExportUncertain", "BaitlyMinutRecoveryStalled", "BaitlyMinutRecoveryUncertain", "BaitlyNoiseWarningMetricsUnavailable", "BaitlyNoiseWarningUncertain", "BaitlyNoiseWarningRepairStalled",
            "BaitlyAutomationMetricsUnavailable", "BaitlyAutomationStalled", "BaitlyAutomationUncertain", "BaitlyAutomationReviewRequired",
            "BaitlyExternalEffectMetricsUnavailable", "BaitlyLockEffectUncertain", "BaitlyReportEffectUncertain", "BaitlyReportEffectPartial"})
    void recoveryRulesKeepControlledNamesForFiringAndResolutionWithoutPrivateLabels(String name) throws Exception {
        when(notifications.notifyPlatformOpsStrict(anyString(),anyString(),isNull())).thenReturn(1);
        for (String state : java.util.List.of("firing","resolved")) {
            var payload = json.createObjectNode().put("status",state);
            var alert = payload.putArray("alerts").addObject();
            alert.putObject("labels").put("alertname",name).put("severity","warning").put("organization","synthetic-private");
            alert.putObject("annotations").put("description","token=synthetic-private");
            assertThat(controller.receiveAlertmanager(payload,"test-ops-token",null).getStatusCode().value()).isEqualTo(202);
        }
        var titles = ArgumentCaptor.forClass(String.class); var messages = ArgumentCaptor.forClass(String.class);
        verify(notifications,times(2)).notifyPlatformOpsStrict(titles.capture(),messages.capture(),isNull());
        assertThat(titles.getAllValues()).allSatisfy(title -> assertThat(title).contains(name).doesNotContain("synthetic-private"));
        assertThat(messages.getAllValues()).allSatisfy(message -> assertThat(message).contains(name).doesNotContain("synthetic-private"));
        assertThat(registry.getMeters()).allSatisfy(meter ->
            assertThat(meter.getId().toString()).doesNotContain("synthetic-private","token=","organization"));
    }
}
