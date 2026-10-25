package com.clenzy.controller;

import com.clenzy.dto.noise.CreateNoiseDeviceDto;
import com.clenzy.dto.noise.NoiseChartDataDto;
import com.clenzy.dto.noise.NoiseDataPointDto;
import com.clenzy.dto.noise.NoiseDeviceDto;
import com.clenzy.service.NoiseDeviceService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NoiseDeviceControllerTest {

    @Mock private NoiseDeviceService noiseDeviceService;

    private NoiseDeviceController controller;

    private Jwt createJwt() {
        return Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "user-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    @BeforeEach
    void setUp() {
        controller = new NoiseDeviceController(noiseDeviceService);
    }

    private final ch.qos.logback.classic.Logger logger =
        (ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory.getLogger(NoiseDeviceController.class);
    private final ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent> logs =
        new ch.qos.logback.core.read.ListAppender<>();
    private ch.qos.logback.classic.Level previous;

    @BeforeEach void captureDiagnostics() {
        previous = logger.getLevel();
        logger.setLevel(ch.qos.logback.classic.Level.DEBUG);
        logs.start();
        logger.addAppender(logs);
    }

    @AfterEach void checkDiagnostics() {
        try {
            assertThat(logs.list).allSatisfy(event -> {
                assertThat(event.getFormattedMessage()).doesNotContain("synthetic-secret", "example.invalid", "user-123");
                assertThat(event.getThrowableProxy()).isNull();
                if (event.getArgumentArray() != null)
                    assertThat(java.util.Arrays.toString(event.getArgumentArray())).doesNotContain("synthetic-secret", "example.invalid", "user-123");
            });
        } finally {
            logger.detachAppender(logs);
            logger.setLevel(previous);
            logs.stop();
        }
    }

    private ResponseEntity<?> invokeFailure(String action, RuntimeException failure) {
        var jwt = createJwt();
        return switch (action) {
            case "create" -> {
                var input = new CreateNoiseDeviceDto();
                when(noiseDeviceService.createDevice("user-123", input)).thenThrow(failure);
                yield controller.createDevice(jwt, input);
            }
            case "delete" -> {
                doThrow(failure).when(noiseDeviceService).deleteDevice("user-123", 1L);
                yield controller.deleteDevice(jwt, 1L);
            }
            case "data" -> {
                when(noiseDeviceService.getNoiseData("user-123", 1L, null, null)).thenThrow(failure);
                yield controller.getNoiseData(jwt, 1L, null, null);
            }
            case "status" -> {
                when(noiseDeviceService.getDeviceStatus("user-123", 1L)).thenThrow(failure);
                yield controller.getDeviceStatus(jwt, 1L);
            }
            default -> {
                when(noiseDeviceService.getAllNoiseData("user-123", null, null)).thenThrow(failure);
                yield controller.getAllNoiseData(jwt, null, null);
            }
        };
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"create", "delete", "data", "status", "all"})
    void providerFailuresNeverExposeContext(String action) {
        var failure = new IllegalStateException("synthetic-secret guest@example.invalid",
            new IllegalArgumentException("synthetic-secret"));
        failure.addSuppressed(new IllegalArgumentException("synthetic-secret"));
        var response = invokeFailure(action, failure);
        assertThat(response.getStatusCode().value()).isEqualTo(500);
        assertThat(response.getBody().toString()).doesNotContain("synthetic-secret", "example.invalid");
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"create", "delete", "data", "status"})
    void privateValidationErrorsAreNotReturned(String action) {
        var response = invokeFailure(action, new IllegalArgumentException("synthetic-secret guest@example.invalid"));
        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(response.getBody().toString()).doesNotContain("synthetic-secret", "example.invalid");
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"create", "delete", "data", "status"})
    void validationWithoutMessageStillReturns400(String action) {
        assertThat(invokeFailure(action, new IllegalArgumentException()).getStatusCode().value()).isEqualTo(400);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"create", "delete", "data", "status", "all"})
    void organizationDenialIsPreservedForSecurityHandler(String action) {
        var denied = new org.springframework.security.access.AccessDeniedException("synthetic-secret");
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> invokeFailure(action, denied)).isSameAs(denied);
        assertThat(logs.list).isEmpty();
    }

    @Nested
    @DisplayName("getUserDevices")
    class GetDevices {
        @Test
        void whenSuccess_thenReturnsList() {
            NoiseDeviceDto dto = mock(NoiseDeviceDto.class);
            when(noiseDeviceService.getUserDevices("user-123")).thenReturn(List.of(dto));

            ResponseEntity<List<NoiseDeviceDto>> response = controller.getUserDevices(createJwt());

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
        }
    }

    @Nested
    @DisplayName("createDevice")
    class CreateDevice {
        @Test
        void whenSuccess_thenReturnsDevice() {
            CreateNoiseDeviceDto createDto = mock(CreateNoiseDeviceDto.class);
            NoiseDeviceDto device = mock(NoiseDeviceDto.class);
            when(noiseDeviceService.createDevice("user-123", createDto)).thenReturn(device);

            ResponseEntity<?> response = controller.createDevice(createJwt(), createDto);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenValidationError_thenBadRequest() {
            CreateNoiseDeviceDto createDto = mock(CreateNoiseDeviceDto.class);
            when(noiseDeviceService.createDevice("user-123", createDto))
                    .thenThrow(new IllegalArgumentException("Invalid device"));

            ResponseEntity<?> response = controller.createDevice(createJwt(), createDto);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenServerError_thenReturns500() {
            CreateNoiseDeviceDto createDto = mock(CreateNoiseDeviceDto.class);
            when(noiseDeviceService.createDevice("user-123", createDto))
                    .thenThrow(new RuntimeException("Server error"));

            ResponseEntity<?> response = controller.createDevice(createJwt(), createDto);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }

    @Nested
    @DisplayName("deleteDevice")
    class DeleteDevice {
        @Test
        void whenSuccess_thenReturnsOk() {
            ResponseEntity<?> response = controller.deleteDevice(createJwt(), 1L);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(noiseDeviceService).deleteDevice("user-123", 1L);
        }

        @Test
        void whenNotFound_thenBadRequest() {
            doThrow(new IllegalArgumentException("Not found")).when(noiseDeviceService).deleteDevice("user-123", 1L);

            ResponseEntity<?> response = controller.deleteDevice(createJwt(), 1L);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenServerError_thenReturns500() {
            doThrow(new RuntimeException("Server error")).when(noiseDeviceService).deleteDevice("user-123", 1L);

            ResponseEntity<?> response = controller.deleteDevice(createJwt(), 1L);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }

    @Nested
    @DisplayName("getNoiseData")
    class GetNoiseData {
        @Test
        void whenSuccess_thenReturnsList() {
            List<NoiseDataPointDto> data = List.of(mock(NoiseDataPointDto.class));
            when(noiseDeviceService.getNoiseData("user-123", 1L, "2026-01-01", "2026-01-31")).thenReturn(data);

            ResponseEntity<?> response = controller.getNoiseData(createJwt(), 1L, "2026-01-01", "2026-01-31");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenNotFound_thenBadRequest() {
            when(noiseDeviceService.getNoiseData("user-123", 1L, null, null))
                    .thenThrow(new IllegalArgumentException("Device not found"));

            ResponseEntity<?> response = controller.getNoiseData(createJwt(), 1L, null, null);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenServerError_thenReturns500() {
            when(noiseDeviceService.getNoiseData("user-123", 1L, null, null))
                    .thenThrow(new RuntimeException("err"));

            ResponseEntity<?> response = controller.getNoiseData(createJwt(), 1L, null, null);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }

    @Nested
    @DisplayName("getAllNoiseData")
    class GetAllNoiseData {
        @Test
        void whenSuccess_thenReturnsChartData() {
            NoiseChartDataDto chartData = mock(NoiseChartDataDto.class);
            when(noiseDeviceService.getAllNoiseData("user-123", null, null)).thenReturn(chartData);

            ResponseEntity<?> response = controller.getAllNoiseData(createJwt(), null, null);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenServerError_thenReturns500() {
            when(noiseDeviceService.getAllNoiseData("user-123", null, null))
                    .thenThrow(new RuntimeException("err"));

            ResponseEntity<?> response = controller.getAllNoiseData(createJwt(), null, null);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }
}
