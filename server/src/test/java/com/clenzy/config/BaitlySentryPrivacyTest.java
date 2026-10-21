package com.clenzy.config;

import com.clenzy.tenant.TenantContext;
import io.sentry.Attachment;
import io.sentry.Breadcrumb;
import io.sentry.Hint;
import io.sentry.JsonSerializer;
import io.sentry.SentryEvent;
import io.sentry.SentryLevel;
import io.sentry.SentryOptions;
import io.sentry.protocol.Message;
import io.sentry.protocol.Request;
import io.sentry.protocol.SentryException;
import io.sentry.protocol.SentryStackFrame;
import io.sentry.protocol.SentryStackTrace;
import io.sentry.protocol.User;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.beans.factory.ObjectProvider;
import java.io.StringWriter;
import java.util.List;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class BaitlySentryPrivacyTest {
    private static final String PRIVATE = "PRIVATE-PASSPORT-IBAN-token@example.com";

    @AfterEach void clearMdc() { MDC.clear(); }

    @Test
    void serializedErrorKeepsDiagnosisWithoutPrivatePayloadOrAttachments() throws Exception {
        SentryEvent event = new SentryEvent(new IllegalArgumentException(PRIVATE));
        event.setLevel(SentryLevel.ERROR);
        event.setEnvironment("production");
        event.setRelease("baitly@1.0.0");
        event.setExtra("payment", PRIVATE);
        event.setTag("email", PRIVATE);
        event.getContexts().put("private", Map.of("secret", PRIVATE));
        event.setUnknown(Map.of("custom", PRIVATE));
        User user = new User(); user.setEmail(PRIVATE); event.setUser(user);
        Request request = new Request(); request.setUrl("https://example.com/" + PRIVATE);
        request.setData(PRIVATE); request.setHeaders(Map.of("Authorization", PRIVATE)); event.setRequest(request);
        Message message = new Message(); message.setFormatted(PRIVATE); event.setMessage(message);
        event.addBreadcrumb(new Breadcrumb(PRIVATE));
        SentryStackFrame frame = new SentryStackFrame();
        frame.setFilename("ReservationService.java"); frame.setModule("com.clenzy.service.ReservationService");
        frame.setFunction("save"); frame.setLineno(42); frame.setContextLine(PRIVATE);
        frame.setVars(Map.of("guest", PRIVATE)); frame.setAbsPath(PRIVATE); frame.setUnknown(Map.of("private", PRIVATE));
        SentryException exception = new SentryException(); exception.setType("IllegalArgumentException");
        exception.setValue(PRIVATE); exception.setStacktrace(new SentryStackTrace(List.of(frame)));
        event.setExceptions(List.of(exception));
        Hint hint = Hint.withAttachment(new Attachment(PRIVATE.getBytes(), "private.txt"));

        SentryEvent clean = BaitlySentryPrivacy.sanitize(event, hint);
        StringWriter json = new StringWriter(); new JsonSerializer(new SentryOptions()).serialize(clean, json);

        assertThat(json.toString()).doesNotContain(PRIVATE).contains("ReservationService.java", "IllegalArgumentException");
        assertThat(clean.getEventId()).isEqualTo(event.getEventId());
        assertThat(clean.getLevel()).isEqualTo(SentryLevel.ERROR);
        assertThat(clean.getExceptions().getFirst().getStacktrace().getFrames().getFirst().getLineno()).isEqualTo(42);
        assertThat(clean.getThrowable()).isNull();
        assertThat(clean.getUser()).isNull(); assertThat(clean.getRequest()).isNull();
        assertThat(hint.getAttachments()).isEmpty();
    }

    @Test
    void callbackOnlyAddsValidatedCorrelationAndPseudonymousOrganization() {
        ObjectProvider<TenantContext> provider = mock(ObjectProvider.class);
        TenantContext tenant = new TenantContext(); tenant.setOrganizationId(123L);
        when(provider.getIfAvailable()).thenReturn(tenant);
        MDC.put("requestId", "afae05bd-c110-48a4-a062-9f5320e410c0");
        MDC.put("propertyId", PRIVATE); MDC.put("channel", PRIVATE);
        SentryEvent result = new SentryConfig().beforeSendCallback(provider).execute(new SentryEvent(), new Hint());
        assertThat(result.getTag("request_id")).isEqualTo(MDC.get("requestId"));
        assertThat(result.getTag("organization_ref")).matches("bt_[0-9a-f]{64}");
        assertThat(result.getTag("organization_id")).isNull();
        assertThat(result.getTag("property_id")).isNull(); assertThat(result.getTag("channel")).isNull();
        MDC.put("requestId", PRIVATE);
        assertThat(new SentryConfig().beforeSendCallback(provider).execute(new SentryEvent(), new Hint()).getTag("request_id")).isNull();
    }

    @Test
    void breadcrumbsAndTransactionsAreNotTransmitted() {
        SentryConfig config = new SentryConfig();
        assertThat(config.baitlySentryTransactions().execute(null, new Hint())).isNull();
        assertThat(config.baitlySentryBreadcrumbs().execute(new Breadcrumb(PRIVATE), new Hint())).isNull();
    }
}
