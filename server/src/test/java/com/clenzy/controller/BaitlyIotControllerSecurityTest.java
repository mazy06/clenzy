package com.clenzy.controller;

import com.clenzy.integration.baitlyiot.BaitlyIotClient;
import com.clenzy.integration.baitlyiot.BaitlyIotSensorService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.test.context.support.WithAnonymousUser;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(SpringExtension.class)
@ContextConfiguration(classes = BaitlyIotControllerSecurityTest.TestConfiguration.class)
class BaitlyIotControllerSecurityTest {
    @Configuration
    @EnableMethodSecurity
    static class TestConfiguration {
        @Bean BaitlyIotClient client() { return mock(BaitlyIotClient.class); }
        @Bean BaitlyIotSensorService service() { return mock(BaitlyIotSensorService.class); }
        @Bean BaitlyIotController controller(BaitlyIotSensorService service, BaitlyIotClient client) {
            return new BaitlyIotController(service, client);
        }
    }
    @Autowired BaitlyIotController controller;

    @Test
    @WithAnonymousUser
    void whenAnonymous_thenRejectsManagement() {
        assertThatThrownBy(() -> controller.configuration()).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }

    @Test
    @WithMockUser(roles = "TECHNICIAN")
    void whenTechnician_thenRejectsManagement() {
        assertThatThrownBy(() -> controller.configuration()).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }

    @Test
    @WithMockUser(roles = "HOST")
    void whenHost_thenCanCheckConfiguration() {
        assertThat(controller.configuration()).isNotNull();
    }
}
