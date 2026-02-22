package com.clenzy.controller;

import com.clenzy.dto.CreateUserDto;
import com.clenzy.dto.UpdateUserDto;
import com.clenzy.dto.UserProfileDto;
import com.clenzy.service.LoginProtectionService;
import com.clenzy.service.LoginProtectionService.LoginStatus;
import com.clenzy.service.NewUserService;
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
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NewUserControllerTest {

    @Mock private NewUserService newUserService;
    @Mock private LoginProtectionService loginProtectionService;

    private NewUserController controller;

    private Jwt createJwt() {
        return Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "admin-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    @BeforeEach
    void setUp() {
        controller = new NewUserController(newUserService, loginProtectionService);
    }

    @Nested
    @DisplayName("getAllUsers")
    class GetAll {
        @Test
        void whenSuccess_thenReturnsOk() {
            UserProfileDto dto = mock(UserProfileDto.class);
            when(newUserService.getAllUserProfiles()).thenReturn(List.of(dto));

            ResponseEntity<List<UserProfileDto>> response = controller.getAllUsers();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
        }

        @Test
        void whenException_thenReturns500() {
            when(newUserService.getAllUserProfiles()).thenThrow(new RuntimeException("err"));

            ResponseEntity<List<UserProfileDto>> response = controller.getAllUsers();

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }

    @Nested
    @DisplayName("getUserById")
    class GetById {
        @Test
        void whenFound_thenReturnsOk() {
            UserProfileDto dto = mock(UserProfileDto.class);
            when(newUserService.getUserProfile("user-1")).thenReturn(dto);

            ResponseEntity<UserProfileDto> response = controller.getUserById("user-1");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenNotFound_thenReturns404() {
            when(newUserService.getUserProfile("user-1")).thenThrow(new RuntimeException("Not found"));

            ResponseEntity<UserProfileDto> response = controller.getUserById("user-1");

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }
    }

    @Nested
    @DisplayName("createUser")
    class Create {
        @Test
        void whenSuccess_thenReturnsOk() {
            CreateUserDto createDto = mock(CreateUserDto.class);
            UserProfileDto profile = mock(UserProfileDto.class);
            when(newUserService.createUser(createDto)).thenReturn(profile);

            ResponseEntity<UserProfileDto> response = controller.createUser(createDto, createJwt());

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenException_thenBadRequest() {
            CreateUserDto createDto = mock(CreateUserDto.class);
            when(newUserService.createUser(createDto)).thenThrow(new RuntimeException("err"));

            ResponseEntity<UserProfileDto> response = controller.createUser(createDto, createJwt());

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
    }

    @Nested
    @DisplayName("updateUser")
    class Update {
        @Test
        void whenSuccess_thenReturnsOk() {
            UpdateUserDto updateDto = mock(UpdateUserDto.class);
            UserProfileDto profile = mock(UserProfileDto.class);
            when(newUserService.updateUser("user-1", updateDto)).thenReturn(profile);

            ResponseEntity<UserProfileDto> response = controller.updateUser("user-1", updateDto, createJwt());

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenException_thenBadRequest() {
            UpdateUserDto updateDto = mock(UpdateUserDto.class);
            when(newUserService.updateUser("user-1", updateDto)).thenThrow(new RuntimeException("err"));

            ResponseEntity<UserProfileDto> response = controller.updateUser("user-1", updateDto, createJwt());

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
    }

    @Nested
    @DisplayName("deleteUser")
    class Delete {
        @Test
        void whenSuccess_thenReturnsOk() {
            ResponseEntity<Void> response = controller.deleteUser("user-1", createJwt());

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(newUserService).deleteUser("user-1");
        }

        @Test
        void whenException_thenBadRequest() {
            doThrow(new RuntimeException("err")).when(newUserService).deleteUser("user-1");

            ResponseEntity<Void> response = controller.deleteUser("user-1", createJwt());

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
    }

    @Nested
    @DisplayName("resetPassword")
    class ResetPassword {
        @Test
        void whenSuccess_thenReturnsOk() {
            ResponseEntity<Void> response = controller.resetPassword("user-1", "newPass123", createJwt());

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(newUserService).resetPassword("user-1", "newPass123");
        }
    }

    @Nested
    @DisplayName("userExists")
    class UserExists {
        @Test
        void whenExists_thenReturnsTrue() {
            when(newUserService.userExists("user-1")).thenReturn(true);

            ResponseEntity<Boolean> response = controller.userExists("user-1");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).isTrue();
        }
    }

    @Nested
    @DisplayName("getLockoutStatus")
    class LockoutStatus {
        @Test
        void whenUserHasEmail_thenReturnsStatus() {
            UserProfileDto dto = mock(UserProfileDto.class);
            when(dto.getEmail()).thenReturn("test@example.com");
            when(newUserService.getUserProfile("user-1")).thenReturn(dto);
            when(loginProtectionService.checkLoginAllowed("test@example.com"))
                    .thenReturn(new LoginStatus(true, 120, false));
            when(loginProtectionService.getFailedAttempts("test@example.com")).thenReturn(5);

            ResponseEntity<?> response = controller.getLockoutStatus("user-1");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body.get("isLocked")).isEqualTo(true);
            assertThat(body.get("failedAttempts")).isEqualTo(5);
        }
    }

    @Nested
    @DisplayName("unlockUser")
    class Unlock {
        @Test
        void whenSuccess_thenReturnsOk() {
            UserProfileDto dto = mock(UserProfileDto.class);
            when(dto.getEmail()).thenReturn("test@example.com");
            when(dto.getFirstName()).thenReturn("Jean");
            when(dto.getLastName()).thenReturn("Dupont");
            when(newUserService.getUserProfile("user-1")).thenReturn(dto);

            ResponseEntity<?> response = controller.unlockUser("user-1");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(loginProtectionService).forceUnlock("test@example.com");
        }

        @Test
        void whenNoEmail_thenBadRequest() {
            UserProfileDto dto = mock(UserProfileDto.class);
            when(dto.getEmail()).thenReturn(null);
            when(newUserService.getUserProfile("user-1")).thenReturn(dto);

            ResponseEntity<?> response = controller.unlockUser("user-1");

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
    }
}
