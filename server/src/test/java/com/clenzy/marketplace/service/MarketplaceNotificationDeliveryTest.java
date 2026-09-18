package com.clenzy.marketplace.service;
import org.junit.jupiter.api.Test;
import java.util.UUID;
import java.util.Optional;
import static org.mockito.Mockito.*;
import com.clenzy.marketplace.repository.*;
import com.clenzy.marketplace.model.*;
import com.clenzy.service.*;

class MarketplaceNotificationDeliveryTest {
    final MarketplaceNotificationOutbox outbox=mock(MarketplaceNotificationOutbox.class);
    final MarketplaceProviderRepository providers=mock(MarketplaceProviderRepository.class);
    final EmailService emails=mock(EmailService.class);
    final MarketplaceNotificationDelivery worker=new MarketplaceNotificationDelivery(outbox,providers,mock(MarketplaceImportRepository.class),emails,mock(NotificationService.class));
    @Test void obsoleteDecisionIsCancelledWithoutSending() {
        var id=UUID.randomUUID(); var claim=new MarketplaceNotificationOutbox.Claim(id,1L,"DECISION","Old","ACTIVE",UUID.randomUUID());
        when(outbox.claim(id)).thenReturn(claim);
        var p=new MarketplaceProvider();p.setEmail("test@example.invalid");p.setStatus(ProviderStatus.ACTIVE);p.setDecisionMessage("New");
        when(providers.findById(1L)).thenReturn(Optional.of(p));
        worker.deliver(id);
        verifyNoInteractions(emails);verify(outbox).finish(claim,"CANCELLED");
    }
    @Test void smtpFailureRetainsPendingIntent() {
        var id=UUID.randomUUID(); var claim=new MarketplaceNotificationOutbox.Claim(id,1L,"DECISION","Welcome","ACTIVE",UUID.randomUUID());
        when(outbox.claim(id)).thenReturn(claim);
        var p=new MarketplaceProvider();p.setEmail("test@example.invalid");p.setStatus(ProviderStatus.ACTIVE);p.setDecisionMessage("Welcome");
        when(providers.findById(1L)).thenReturn(Optional.of(p));
        doThrow(new IllegalStateException("SMTP")).when(emails).sendSystemTemplateEmail(any(),any(),any(),any());
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> worker.deliver(id)).isInstanceOf(IllegalStateException.class);
        verify(outbox).finish(claim,"PENDING");
    }
}
