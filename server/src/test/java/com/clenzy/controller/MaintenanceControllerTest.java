package com.clenzy.controller;

import com.clenzy.dto.MaintenanceRequestDto;
import com.clenzy.repository.ReceivedFormRepository;
import com.clenzy.service.EmailService;
import com.clenzy.service.NotificationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MaintenanceControllerTest {

    @Mock private EmailService emailService;
    @Mock private ReceivedFormRepository receivedFormRepository;
    @Mock private NotificationService notificationService;
    @Mock private HttpServletRequest httpRequest;

    private MaintenanceController controller;

    @BeforeEach
    void setUp() {
        controller = new MaintenanceController(emailService, receivedFormRepository, new ObjectMapper(), notificationService);
        lenient().when(httpRequest.getRemoteAddr()).thenReturn("127.0.0.1");
        lenient().when(httpRequest.getHeader(anyString())).thenReturn(null);
    }

    private MaintenanceRequestDto validDto() {
        MaintenanceRequestDto dto = mock(MaintenanceRequestDto.class);
        when(dto.getFullName()).thenReturn("Jean Dupont");
        when(dto.getEmail()).thenReturn("jean@test.com");
        when(dto.getSelectedWorks()).thenReturn(List.of("plumbing", "electrical"));
        when(dto.getUrgency()).thenReturn("HIGH");
        return dto;
    }

    @Nested
    @DisplayName("submitMaintenanceRequest")
    class Submit {
        @Test
        void whenValidRequest_thenReturnsOk() {
            MaintenanceRequestDto dto = validDto();

            ResponseEntity<?> response = controller.submitMaintenanceRequest(dto, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(emailService).sendMaintenanceNotification(dto);
        }

        @Test
        void whenMissingName_thenBadRequest() {
            MaintenanceRequestDto dto = mock(MaintenanceRequestDto.class);
            when(dto.getFullName()).thenReturn("");

            ResponseEntity<?> response = controller.submitMaintenanceRequest(dto, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenMissingEmail_thenBadRequest() {
            MaintenanceRequestDto dto = mock(MaintenanceRequestDto.class);
            when(dto.getFullName()).thenReturn("Jean");
            when(dto.getEmail()).thenReturn("");

            ResponseEntity<?> response = controller.submitMaintenanceRequest(dto, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenInvalidEmail_thenBadRequest() {
            MaintenanceRequestDto dto = mock(MaintenanceRequestDto.class);
            when(dto.getFullName()).thenReturn("Jean");
            when(dto.getEmail()).thenReturn("not-an-email");

            ResponseEntity<?> response = controller.submitMaintenanceRequest(dto, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenNoWorksOrCustom_thenBadRequest() {
            MaintenanceRequestDto dto = mock(MaintenanceRequestDto.class);
            when(dto.getFullName()).thenReturn("Jean");
            when(dto.getEmail()).thenReturn("jean@test.com");
            when(dto.getSelectedWorks()).thenReturn(List.of());
            when(dto.getCustomNeed()).thenReturn(null);

            ResponseEntity<?> response = controller.submitMaintenanceRequest(dto, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenEmailFails_thenStillReturnsOk() {
            MaintenanceRequestDto dto = validDto();
            doThrow(new RuntimeException("SMTP error")).when(emailService).sendMaintenanceNotification(any());

            ResponseEntity<?> response = controller.submitMaintenanceRequest(dto, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }
}
