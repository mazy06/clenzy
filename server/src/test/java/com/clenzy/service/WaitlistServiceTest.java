package com.clenzy.service;

import com.clenzy.dto.WaitlistSignupDto;
import com.clenzy.model.WaitlistSignup;
import com.clenzy.repository.WaitlistSignupRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WaitlistServiceTest {

    @Mock private WaitlistSignupRepository repository;
    @Mock private EmailService emailService;
    @Mock private BrevoContactService brevoContactService;
    @InjectMocks private WaitlistService service;

    @Test
    void register_newEmail_savesNotifies_andIsFounderWhenWithinFirst20() {
        when(repository.findByEmailIgnoreCase("a@b.com")).thenReturn(Optional.empty());
        when(repository.save(any(WaitlistSignup.class))).thenAnswer(inv -> {
            WaitlistSignup s = inv.getArgument(0);
            s.setId(5L);
            return s;
        });
        when(repository.positionOf(5L)).thenReturn(5L);
        when(repository.count()).thenReturn(5L);
        when(brevoContactService.addToWaitlist(any())).thenReturn(false);

        var result = service.register(
                new WaitlistSignupDto("a@b.com", "Jean", null, null, "Paris", null), "1.2.3.4");

        assertThat(result.position()).isEqualTo(5L);
        assertThat(result.founder()).isTrue();
        assertThat(result.alreadyRegistered()).isFalse();
        assertThat(result.founderSpotsLeft()).isEqualTo(15L);
        verify(emailService).sendWaitlistNotification(any(WaitlistSignup.class), eq(5L));
    }

    @Test
    void register_existingEmail_isIdempotent_noSaveNoEmail() {
        WaitlistSignup existing = new WaitlistSignup();
        existing.setId(3L);
        existing.setEmail("a@b.com");
        when(repository.findByEmailIgnoreCase("a@b.com")).thenReturn(Optional.of(existing));
        when(repository.positionOf(3L)).thenReturn(3L);
        when(repository.count()).thenReturn(10L);

        var result = service.register(
                new WaitlistSignupDto("a@b.com", null, null, null, null, null), "1.2.3.4");

        assertThat(result.alreadyRegistered()).isTrue();
        assertThat(result.position()).isEqualTo(3L);
        verify(repository, never()).save(any());
        verify(emailService, never()).sendWaitlistNotification(any(), anyLong());
    }

    @Test
    void register_invalidEmail_throws() {
        assertThatThrownBy(() -> service.register(
                new WaitlistSignupDto("not-an-email", null, null, null, null, null), "1.2.3.4"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void markUnsubscribed_existingEmail_setsTimestampAndSaves() {
        WaitlistSignup s = new WaitlistSignup();
        s.setId(7L);
        s.setEmail("x@y.com");
        when(repository.findByEmailIgnoreCase("x@y.com")).thenReturn(Optional.of(s));

        boolean found = service.markUnsubscribed("x@y.com");

        assertThat(found).isTrue();
        assertThat(s.getUnsubscribedAt()).isNotNull();
        verify(repository).save(s);
    }

    @Test
    void markUnsubscribed_alreadyUnsubscribed_isIdempotent_noSave() {
        WaitlistSignup s = new WaitlistSignup();
        s.setId(8L);
        s.setEmail("x@y.com");
        s.setUnsubscribedAt(LocalDateTime.now().minusDays(1));
        when(repository.findByEmailIgnoreCase("x@y.com")).thenReturn(Optional.of(s));

        boolean found = service.markUnsubscribed("x@y.com");

        assertThat(found).isTrue();
        verify(repository, never()).save(any());
    }

    @Test
    void markUnsubscribed_unknownEmail_returnsFalse() {
        when(repository.findByEmailIgnoreCase("none@x.com")).thenReturn(Optional.empty());
        assertThat(service.markUnsubscribed("none@x.com")).isFalse();
        verify(repository, never()).save(any());
    }
}
