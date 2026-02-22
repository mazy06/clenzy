package com.clenzy.controller;

import com.clenzy.dto.KeycloakUserDto;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.KeycloakService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SyncControllerTest {

    @Mock private KeycloakService keycloakService;
    @Mock private UserRepository userRepository;

    private SyncController controller;

    @BeforeEach
    void setUp() {
        controller = new SyncController(keycloakService, userRepository);
    }

    @Nested
    @DisplayName("forceSyncAllToKeycloak")
    class ForceSync {
        @Test
        void whenSuccess_thenReturnsStats() {
            User dbUser = new User();
            dbUser.setEmail("user@test.com");
            dbUser.setFirstName("Jean");
            dbUser.setLastName("Dupont");
            dbUser.setRole(UserRole.HOST);
            when(userRepository.findAll()).thenReturn(List.of(dbUser));

            KeycloakUserDto kcUser = new KeycloakUserDto();
            kcUser.setId("kc-123");
            kcUser.setEmail("user@test.com");
            when(keycloakService.getAllUsers()).thenReturn(List.of(kcUser));

            ResponseEntity<Map<String, Object>> response = controller.forceSyncAllToKeycloak();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("success", true);
            assertThat(response.getBody()).containsEntry("totalDbUsers", 1);
        }

        @Test
        void whenException_thenReturns500() {
            when(userRepository.findAll()).thenThrow(new RuntimeException("DB error"));

            ResponseEntity<Map<String, Object>> response = controller.forceSyncAllToKeycloak();

            assertThat(response.getStatusCode().value()).isEqualTo(500);
            assertThat(response.getBody()).containsEntry("success", false);
        }
    }

    @Nested
    @DisplayName("syncUser")
    class SyncUser {
        @Test
        void whenUserExistsInDb_thenUpdates() {
            KeycloakUserDto kcUser = new KeycloakUserDto();
            kcUser.setId("kc-123");
            kcUser.setFirstName("Jean");
            kcUser.setLastName("Dupont");
            kcUser.setEmail("jean@test.com");
            when(keycloakService.getUser("kc-123")).thenReturn(kcUser);

            User existingUser = new User();
            existingUser.setId(1L);
            when(userRepository.findByKeycloakId("kc-123")).thenReturn(Optional.of(existingUser));

            ResponseEntity<Map<String, Object>> response = controller.syncUser("kc-123");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("action", "updated");
            verify(userRepository).save(existingUser);
        }

        @Test
        void whenUserNotInDb_thenCreates() {
            KeycloakUserDto kcUser = new KeycloakUserDto();
            kcUser.setId("kc-new");
            kcUser.setFirstName("Nouveau");
            kcUser.setLastName("User");
            kcUser.setEmail("new@test.com");
            when(keycloakService.getUser("kc-new")).thenReturn(kcUser);
            when(userRepository.findByKeycloakId("kc-new")).thenReturn(Optional.empty());

            ResponseEntity<Map<String, Object>> response = controller.syncUser("kc-new");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("action", "created");
            verify(userRepository).save(any(User.class));
        }

        @Test
        void whenException_thenReturns500() {
            when(keycloakService.getUser("kc-123")).thenThrow(new RuntimeException("Keycloak error"));

            ResponseEntity<Map<String, Object>> response = controller.syncUser("kc-123");

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }
}
