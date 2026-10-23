package com.clenzy.integration.external.strategy;

import com.clenzy.integration.external.controller.ExternalConnectionController;
import com.clenzy.integration.external.dto.ExternalConnectionRequest;
import com.clenzy.integration.external.service.ExternalServiceConnectionService;
import com.clenzy.service.signature.SignatureProviderRegistry;
import com.clenzy.service.signature.SignatureProviderType;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Vraies stratégies de remplacement : aucun fournisseur ni secret réel. */
class BaitlyUnverifiedExternalConnectionTest {
    @ParameterizedTest
    @EnumSource(value=SignatureProviderType.class,names={"YOUSIGN","UNIVERSIGN","DOCAPOSTE"})
    void completeFieldsCannotActivateAnUnverifiedConnection(SignatureProviderType type) {
        var strategies = new ConnectionTestStrategyRegistry(List.of(new YousignConnectionTestStrategy(),
                new UniversignConnectionTestStrategy(), new DocaPosteConnectionTestStrategy()));
        var service = mock(ExternalServiceConnectionService.class);
        var tenant = mock(TenantContext.class); when(tenant.getRequiredOrganizationId()).thenReturn(7L);
        var controller = new ExternalConnectionController(service, strategies, mock(SignatureProviderRegistry.class), tenant);
        var logger = (ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory.getLogger(ExternalConnectionController.class);
        var logs = new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>(); logs.start(); logger.addAppender(logs);
        try {
            var request = new ExternalConnectionRequest("https://example.invalid/private?token=synthetic-private", "synthetic-user", "synthetic-private-key");
            var response = controller.connect(type, request, null);
            assertThat(response.getStatusCode().value()).isEqualTo(400);
            assertThat(response.getBody().toString()).contains("connection_failed").doesNotContain("synthetic-private");
            verifyNoInteractions(service);
            assertThat(logs.list).allSatisfy(event -> {
                assertThat(event.getFormattedMessage()).doesNotContain("synthetic-private", "example.invalid");
                assertThat(event.getThrowableProxy()).isNull();
            });
        } finally {logger.detachAppender(logs); logs.stop();}
    }
}
