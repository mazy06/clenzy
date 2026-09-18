package com.clenzy.marketplace.service;
import com.clenzy.model.AuditLog;
import com.clenzy.repository.AuditLogRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class MarketplaceDecisionJournalTest {
    @Test void decisionUsesTheExistingAuditAuthorityAndKeepsActorAndBothStates() {
        var repository=mock(AuditLogRepository.class);
        new MarketplaceDecisionJournal(repository).record(7L,"STATUS","PENDING_REVIEW","ACTIVE","moderator");
        var captor=ArgumentCaptor.forClass(AuditLog.class); verify(repository).save(captor.capture());
        var entry=captor.getValue();
        assertThat(entry.getEntityType()).isEqualTo("MarketplaceProvider");
        assertThat(entry.getEntityId()).isEqualTo("7");
        assertThat(entry.getUserId()).isEqualTo("moderator");
        assertThat(entry.getOldValue()).isEqualTo("PENDING_REVIEW");
        assertThat(entry.getNewValue()).isEqualTo("ACTIVE");
        assertThat(entry.getOrganizationId()).isNull();
    }
    @Test void anAuditWriteFailureIsNotSwallowedSoTheDecisionCanRollBack() {
        var repository=mock(AuditLogRepository.class);
        when(repository.save(any())).thenThrow(new IllegalStateException("storage unavailable"));
        assertThatThrownBy(() -> new MarketplaceDecisionJournal(repository).record(7L,"STATUS","ACTIVE","SUSPENDED","moderator"))
            .isInstanceOf(IllegalStateException.class);
    }
}

