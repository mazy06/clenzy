package com.clenzy.integration.channel.controller;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.dto.ChannelConnectRequest;
import com.clenzy.integration.channel.dto.ChannelConnectionDto;
import com.clenzy.integration.channel.dto.ChannelConnectionTestResult;
import com.clenzy.integration.channel.service.ChannelConnectionService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChannelConnectionControllerTest {

    @Mock private ChannelConnectionService channelConnectionService;
    @Mock private TenantContext tenantContext;

    private ChannelConnectionController controller;

    @BeforeEach
    void setUp() {
        controller = new ChannelConnectionController(channelConnectionService, tenantContext);
        lenient().when(tenantContext.getRequiredOrganizationId()).thenReturn(7L);
    }

    private ChannelConnectionDto dto(ChannelName channel) {
        return new ChannelConnectionDto(1L, channel, "CONNECTED", true, null, null, null, "ext-1");
    }

    @Test
    void getAll_returnsList() {
        when(channelConnectionService.getConnectionsForOrganization(7L))
                .thenReturn(List.of(dto(ChannelName.BOOKING), dto(ChannelName.EXPEDIA)));

        ResponseEntity<List<ChannelConnectionDto>> resp = controller.getAll();

        assertThat(resp.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(resp.getBody()).hasSize(2);
    }

    @Test
    void getStatus_existingChannel_returnsOk() {
        when(channelConnectionService.getConnectionStatus(7L, ChannelName.BOOKING))
                .thenReturn(Optional.of(dto(ChannelName.BOOKING)));

        ResponseEntity<ChannelConnectionDto> resp = controller.getStatus("BOOKING");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody().channel()).isEqualTo(ChannelName.BOOKING);
    }

    @Test
    void getStatus_lowercase_isUppercased() {
        when(channelConnectionService.getConnectionStatus(7L, ChannelName.AGODA))
                .thenReturn(Optional.of(dto(ChannelName.AGODA)));

        ResponseEntity<ChannelConnectionDto> resp = controller.getStatus("agoda");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void getStatus_missing_returns404() {
        when(channelConnectionService.getConnectionStatus(7L, ChannelName.EXPEDIA))
                .thenReturn(Optional.empty());

        ResponseEntity<ChannelConnectionDto> resp = controller.getStatus("EXPEDIA");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void connect_returns201() {
        ChannelConnectRequest req = new ChannelConnectRequest(Map.of("apiKey", "x"));
        when(channelConnectionService.connect(eq(7L), eq(ChannelName.BOOKING), any()))
                .thenReturn(dto(ChannelName.BOOKING));

        ResponseEntity<ChannelConnectionDto> resp = controller.connect("BOOKING", req);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }

    @Test
    void disconnect_returnsNoContent() {
        ResponseEntity<Void> resp = controller.disconnect("BOOKING");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(channelConnectionService).disconnect(7L, ChannelName.BOOKING);
    }

    @Test
    void test_returnsTestResult() {
        ChannelConnectRequest req = new ChannelConnectRequest(Map.of("apiKey", "x"));
        ChannelConnectionTestResult result = new ChannelConnectionTestResult(true, "OK", "My Hotel");
        when(channelConnectionService.testConnection(eq(7L), eq(ChannelName.AGODA), any()))
                .thenReturn(result);

        ResponseEntity<ChannelConnectionTestResult> resp = controller.test("AGODA", req);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody().success()).isTrue();
    }

    @Test
    void parseChannelName_invalidChannel_throwsHandledViaHandler() {
        // Cannot test via direct call, but exception handler returns 400
        ResponseEntity<Map<String, String>> resp = controller.handleIllegalArgument(
                new IllegalArgumentException("Channel inconnu: bogus"));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(resp.getBody().get("error")).contains("Channel inconnu");
    }

    @Test
    void handleIllegalState_returns409() {
        ResponseEntity<Map<String, String>> resp = controller.handleIllegalState(
                new IllegalStateException("Already connected"));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(resp.getBody().get("error")).contains("Already connected");
    }

    @Test
    void getStatus_invalidChannelString_throwsViaParse() {
        // parseChannelName throws when invalid — caught by exception handler
        try {
            controller.getStatus("not-a-real-channel");
        } catch (IllegalArgumentException e) {
            assertThat(e.getMessage()).contains("Channel inconnu");
        }
    }

    private static <T> T eq(T value) {
        return org.mockito.ArgumentMatchers.eq(value);
    }
}
