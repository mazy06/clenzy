package com.clenzy.integration.baitlyiot;

import com.clenzy.controller.BaitlyIotController;
import com.clenzy.model.NoiseDevice;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.repository.NoiseDeviceRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real HTTP and IoT PostgreSQL; PMS repositories are isolated test doubles, never the live PMS database. */
@EnabledIfEnvironmentVariable(named = "BAITLY_IOT_TEST_BASE_URL", matches = ".+")
@EnabledIfEnvironmentVariable(named = "BAITLY_IOT_TEST_INGESTION_URL", matches = ".+")
class BaitlyIotJourneyIT {
    @Test
    void whenTestingWithoutHardware_thenProvisionIngestReadRotateRevokeAndDeleteWorkThroughPms() throws Exception {
        String baseUrl = System.getenv("BAITLY_IOT_TEST_BASE_URL");
        var client = new BaitlyIotClient(baseUrl, System.getenv("BAITLY_IOT_TEST_SERVICE_TOKEN"), "", true, 8,
                java.time.Clock.systemUTC());
        var properties = mock(PropertyRepository.class);
        var devices = mock(NoiseDeviceRepository.class);
        var rows = new HashMap<Long, NoiseDevice>();
        User owner = new User(); owner.setKeycloakId("journey-host");
        Property property = new Property(); property.setId(11L); property.setOrganizationId(7L); property.setOwner(owner);
        when(properties.findByIdWithOwnerNoOrgFilter(11L)).thenReturn(Optional.of(property));
        when(devices.findById(anyLong())).thenAnswer(call -> Optional.ofNullable(rows.get(call.getArgument(0))));
        when(devices.findByDeviceTypeAndExternalDeviceId(any(), anyString())).thenAnswer(call -> rows.values().stream()
                .filter(row -> row.getExternalDeviceId().equals(call.getArgument(1))).findFirst());
        when(devices.saveAndFlush(any())).thenAnswer(call -> {
            NoiseDevice row = call.getArgument(0); row.setId(99L); rows.put(99L, row); return row;
        });
        doAnswer(call -> { rows.remove(((NoiseDevice) call.getArgument(0)).getId()); return null; }).when(devices).delete(any(NoiseDevice.class));
        TenantContext tenant = new TenantContext(); tenant.setOrganizationId(7L);
        var access = new BaitlyIotAccessService(properties, devices, new OrganizationAccessGuard(tenant));
        var service = new BaitlyIotSensorService(access, client, devices);
        var mvc = MockMvcBuilders.standaloneSetup(new BaitlyIotController(service, client))
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).build();
        Jwt jwt = Jwt.withTokenValue("test-only").header("alg", "RS256").subject("journey-host").build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt,
                List.of(new SimpleGrantedAuthority("ROLE_HOST"))));
        UUID externalId = UUID.randomUUID();
        String registration = "{\"requestId\":\"" + externalId + "\",\"propertyId\":11,\"name\":\"Parcours Baitly test\"}";
        try {
            mvc.perform(post("/api/baitly-iot/noise-devices").contentType(MediaType.APPLICATION_JSON).content(registration))
                    .andExpect(status().isCreated()).andExpect(jsonPath("id").value(99));
            mvc.perform(post("/api/baitly-iot/noise-devices").contentType(MediaType.APPLICATION_JSON).content(registration))
                    .andExpect(status().isCreated()).andExpect(jsonPath("id").value(99));
            String sample = "{\"eventId\":\"" + UUID.randomUUID() + "\",\"measuredAt\":\"" + Instant.now()
                    + "\",\"laeqDbA\":62.4}";
            mvc.perform(post("/api/baitly-iot/noise-devices/99/simulate").contentType(MediaType.APPLICATION_JSON).content(sample))
                    .andExpect(status().isOk());
            mvc.perform(get("/api/baitly-iot/noise-devices/99")).andExpect(status().isOk())
                    .andExpect(jsonPath("online").value(true)).andExpect(jsonPath("simulation").value(true));
            assertThat(client.noise(externalId.toString(), 7, 11, null, null, "Salon")).hasSize(1);
            String credentials = mvc.perform(post("/api/baitly-iot/noise-devices/99/credentials"))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
            String token = new ObjectMapper().readTree(credentials).path("token").asText();
            var http = HttpClient.newHttpClient();
            String externalSample = "{\"eventId\":\"" + UUID.randomUUID() + "\",\"measuredAt\":\"" + Instant.now()
                    + "\",\"windowSeconds\":10,\"laeqDbA\":71.2}";
            var request = HttpRequest.newBuilder(URI.create(System.getenv("BAITLY_IOT_TEST_INGESTION_URL") + "/api/v1/measurements"))
                    .header("Authorization", "Bearer " + token).header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(externalSample)).build();
            assertThat(http.send(request, HttpResponse.BodyHandlers.discarding()).statusCode()).isEqualTo(200);
            assertThat(client.noise(externalId.toString(), 7, 11, null, null, "Salon")).hasSize(2);
            mvc.perform(post("/api/baitly-iot/noise-devices/99/revoke")).andExpect(status().isNoContent());
            assertThat(http.send(request, HttpResponse.BodyHandlers.discarding()).statusCode()).isEqualTo(401);
            mvc.perform(delete("/api/baitly-iot/noise-devices/99")).andExpect(status().isNoContent());
            assertThat(rows).isEmpty();
        } finally {
            SecurityContextHolder.clearContext();
            // Erase only this test's device if an assertion interrupted the journey (idempotent).
            client.requestErasure(externalId.toString(), 7);
        }
    }
}
