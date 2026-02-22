package com.clenzy.controller;

import com.clenzy.dto.AcceptInvitationRequest;
import com.clenzy.dto.InvitationDto;
import com.clenzy.dto.SendInvitationRequest;
import com.clenzy.service.OrganizationInvitationService;
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
class OrganizationInvitationControllerTest {

    @Mock private OrganizationInvitationService invitationService;

    private OrganizationInvitationController controller;

    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new OrganizationInvitationController(invitationService);
        jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "user-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    @Nested
    @DisplayName("sendInvitation")
    class SendInvitation {
        @Test
        void whenValid_thenReturnsOk() {
            SendInvitationRequest request = new SendInvitationRequest();
            request.setEmail("test@example.com");
            request.setRole("MEMBER");
            InvitationDto dto = mock(InvitationDto.class);
            when(invitationService.sendInvitation(1L, "test@example.com", "MEMBER", jwt)).thenReturn(dto);

            ResponseEntity<InvitationDto> response = controller.sendInvitation(1L, request, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("listInvitations")
    class ListInvitations {
        @Test
        void whenCalled_thenReturnsList() {
            InvitationDto dto = mock(InvitationDto.class);
            when(invitationService.listByOrganization(1L, jwt)).thenReturn(List.of(dto));

            ResponseEntity<List<InvitationDto>> response = controller.listInvitations(1L, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
        }
    }

    @Nested
    @DisplayName("cancelInvitation")
    class CancelInvitation {
        @Test
        void whenCalled_thenReturnsNoContent() {
            ResponseEntity<Void> response = controller.cancelInvitation(1L, 5L, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(204);
            verify(invitationService).cancelInvitation(1L, 5L, jwt);
        }
    }

    @Nested
    @DisplayName("resendInvitation")
    class ResendInvitation {
        @Test
        void whenCalled_thenReturnsOk() {
            InvitationDto dto = mock(InvitationDto.class);
            when(invitationService.resendInvitation(1L, 5L, jwt)).thenReturn(dto);

            ResponseEntity<InvitationDto> response = controller.resendInvitation(1L, 5L, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("getInvitationInfo")
    class GetInvitationInfo {
        @Test
        void whenValid_thenReturnsOk() {
            InvitationDto dto = mock(InvitationDto.class);
            when(invitationService.getInvitationInfo("valid-token")).thenReturn(dto);

            ResponseEntity<?> response = controller.getInvitationInfo("valid-token");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenInvalid_thenBadRequest() {
            when(invitationService.getInvitationInfo("bad-token"))
                    .thenThrow(new IllegalArgumentException("Token invalide"));

            ResponseEntity<?> response = controller.getInvitationInfo("bad-token");

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenExpired_thenBadRequest() {
            when(invitationService.getInvitationInfo("expired-token"))
                    .thenThrow(new IllegalStateException("Invitation expiree"));

            ResponseEntity<?> response = controller.getInvitationInfo("expired-token");

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
    }

    @Nested
    @DisplayName("acceptInvitation")
    class AcceptInvitation {
        @Test
        void whenValid_thenReturnsOk() {
            AcceptInvitationRequest request = new AcceptInvitationRequest();
            request.setToken("valid-token");
            InvitationDto dto = mock(InvitationDto.class);
            when(invitationService.acceptInvitation("valid-token", jwt)).thenReturn(dto);

            ResponseEntity<?> response = controller.acceptInvitation(request, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenNullJwt_thenUnauthorized() {
            AcceptInvitationRequest request = new AcceptInvitationRequest();
            request.setToken("token");

            ResponseEntity<?> response = controller.acceptInvitation(request, null);

            assertThat(response.getStatusCode().value()).isEqualTo(401);
        }

        @Test
        void whenInvalidToken_thenBadRequest() {
            AcceptInvitationRequest request = new AcceptInvitationRequest();
            request.setToken("bad-token");
            when(invitationService.acceptInvitation("bad-token", jwt))
                    .thenThrow(new IllegalArgumentException("Token invalide"));

            ResponseEntity<?> response = controller.acceptInvitation(request, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
    }
}
