package com.clenzy.service;

import com.clenzy.model.ContactMessage;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ContactMessageCommitTest {
    @Test void participantsAreNotNotifiedUntilCommitAndNeverOnRollback() {
        var messaging = mock(SimpMessagingTemplate.class);
        @SuppressWarnings("unchecked") var provider = (ObjectProvider<SimpMessagingTemplate>) mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(messaging);
        var publisher = new ContactMessageEventPublisher(provider);
        var source = new DriverManagerDataSource("jdbc:h2:mem:" + UUID.randomUUID(), "sa", "");
        var transaction = new TransactionTemplate(new DataSourceTransactionManager(source));
        var message = new ContactMessage(); message.setId(1L); message.setOrganizationId(7L);
        assertThatThrownBy(() -> transaction.executeWithoutResult(status -> {
            publisher.publishToParticipants(message, null, List.of("customer"));
            verifyNoInteractions(messaging);
            throw new IllegalStateException("rollback");
        })).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(messaging);
        transaction.executeWithoutResult(status -> {
            publisher.publishToParticipants(message, null, List.of("customer"));
            verifyNoInteractions(messaging);
        });
        verify(messaging).convertAndSendToUser(eq("customer"), eq("/queue/contact-messages"), any(Object.class));
    }
}
