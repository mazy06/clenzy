package com.clenzy.service;

import com.clenzy.model.PlatformSettings;
import com.clenzy.repository.PlatformSettingsRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PlatformSettingsServiceTest {

    @Mock private PlatformSettingsRepository repository;
    @InjectMocks private PlatformSettingsService service;

    @Test
    void getInternalNotificationEmails_parsesCsv_trimsAndDedupes() {
        PlatformSettings s = new PlatformSettings();
        s.setInternalNotificationEmails("a@x.com, b@y.com ,a@x.com");
        when(repository.findById(PlatformSettings.SINGLETON_ID)).thenReturn(Optional.of(s));

        assertThat(service.getInternalNotificationEmails())
                .containsExactly("a@x.com", "b@y.com");
    }

    @Test
    void getInternalNotificationEmails_blank_returnsEmpty() {
        PlatformSettings s = new PlatformSettings();
        s.setInternalNotificationEmails("");
        when(repository.findById(PlatformSettings.SINGLETON_ID)).thenReturn(Optional.of(s));

        assertThat(service.getInternalNotificationEmails()).isEmpty();
    }

    @Test
    void cleanEmails_keepsValidTrimmedDistinct_dropsInvalid() {
        List<String> result = PlatformSettingsService.cleanEmails(
                List.of(" a@x.com ", "not-an-email", "a@x.com", "b@y.com", ""));
        assertThat(result).containsExactly("a@x.com", "b@y.com");
    }

    @Test
    void cleanEmails_null_returnsEmpty() {
        assertThat(PlatformSettingsService.cleanEmails(null)).isEmpty();
    }

    @Test
    void updateInternalNotificationEmails_storesCleanedCsv_andUpdatedBy() {
        when(repository.findById(PlatformSettings.SINGLETON_ID)).thenReturn(Optional.empty());
        when(repository.save(any(PlatformSettings.class))).thenAnswer(inv -> inv.getArgument(0));

        PlatformSettings saved = service.updateInternalNotificationEmails(
                List.of(" a@x.com ", "bad", "b@y.com"), "admin");

        assertThat(saved.getInternalNotificationEmails()).isEqualTo("a@x.com,b@y.com");
        assertThat(saved.getUpdatedBy()).isEqualTo("admin");
    }

    @Test
    void getSenderEmail_returnsTrimmed_blankReturnsNull() {
        PlatformSettings s = new PlatformSettings();
        s.setSenderEmail("  hello@baitly.fr  ");
        when(repository.findById(PlatformSettings.SINGLETON_ID)).thenReturn(Optional.of(s));
        assertThat(service.getSenderEmail()).isEqualTo("hello@baitly.fr");

        s.setSenderEmail("");
        assertThat(service.getSenderEmail()).isNull();
    }

    @Test
    void updateSender_storesEmailAndName_blankNameDefaultsToBaitly() {
        when(repository.findById(PlatformSettings.SINGLETON_ID)).thenReturn(Optional.empty());
        when(repository.save(any(PlatformSettings.class))).thenAnswer(inv -> inv.getArgument(0));

        PlatformSettings saved = service.updateSender(" info@baitly.fr ", " Baitly Pro ", "admin");
        assertThat(saved.getSenderEmail()).isEqualTo("info@baitly.fr");
        assertThat(saved.getSenderName()).isEqualTo("Baitly Pro");

        PlatformSettings saved2 = service.updateSender("info@baitly.fr", "  ", "admin");
        assertThat(saved2.getSenderName()).isEqualTo("Baitly");
    }

    @Test
    void isValidEmail_validatesFormat() {
        assertThat(PlatformSettingsService.isValidEmail("a@b.com")).isTrue();
        assertThat(PlatformSettingsService.isValidEmail("nope")).isFalse();
        assertThat(PlatformSettingsService.isValidEmail(null)).isFalse();
    }
}
