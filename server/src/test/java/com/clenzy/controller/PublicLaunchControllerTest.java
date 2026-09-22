package com.clenzy.controller;

import com.clenzy.model.PlatformSettings;
import com.clenzy.service.PlatformSettingsService;
import com.clenzy.service.WaitlistService;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class PublicLaunchControllerTest {
    @Test
    void publicStatus_exposesScheduleWithoutPrivatePlatformSettings() throws Exception {
        PlatformSettings settings = new PlatformSettings();
        settings.setLaunchAt(Instant.parse("2027-01-15T09:00:00Z"));
        settings.setLaunchTimeZone("Asia/Riyadh");
        settings.setInternalNotificationEmails("private@example.com");
        settings.setSenderEmail("sender@example.com");
        PlatformSettingsService service = mock(PlatformSettingsService.class);
        when(service.getOrDefault()).thenReturn(settings);
        var mvc = MockMvcBuilders.standaloneSetup(
                new PublicWaitlistController(mock(WaitlistService.class), service)).build();

        mvc.perform(get("/api/public/waitlist/launch"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.registrationsPaused").value(true))
                .andExpect(jsonPath("$.launchTimeZone").value("Asia/Riyadh"))
                .andExpect(jsonPath("$.launchAt").exists())
                .andExpect(jsonPath("$.internalNotificationEmails").doesNotExist())
                .andExpect(jsonPath("$.senderEmail").doesNotExist())
                .andExpect(jsonPath("$.updatedBy").doesNotExist());
    }
}
