package com.clenzy.service;

import com.clenzy.dto.CreateUserDto;
import com.clenzy.dto.KeycloakUserDto;
import com.clenzy.dto.UpdateUserDto;
import com.clenzy.dto.UserProfileDto;
import com.clenzy.exception.UserNotFoundException;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.model.UserStatus;
import com.clenzy.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NewUserServiceTest {

    @Mock private KeycloakService keycloakService;
    @Mock private UserRepository userRepository;

    private NewUserService service;

    @BeforeEach
    void setUp() {
        service = new NewUserService(keycloakService, userRepository);
    }

    private KeycloakUserDto buildKeycloakUser(String id, String email, String firstName, String lastName) {
        KeycloakUserDto dto = new KeycloakUserDto();
        dto.setId(id);
        dto.setEmail(email);
        dto.setFirstName(firstName);
        dto.setLastName(lastName);
        dto.setEnabled(true);
        dto.setEmailVerified(true);
        return dto;
    }

    // ===== GET USER PROFILE =====

    @Nested
    class GetUserProfile {

        @Test
        void whenKeycloakAndDbExist_thenMerges() {
            KeycloakUserDto kcUser = buildKeycloakUser("kc-1", "test@test.com", "John", "Doe");
            when(keycloakService.getUser("kc-1")).thenReturn(kcUser);

            User businessUser = new User();
            businessUser.setKeycloakId("kc-1");
            businessUser.setRole(UserRole.SUPER_ADMIN);
            businessUser.setStatus(UserStatus.ACTIVE);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(businessUser));

            UserProfileDto result = service.getUserProfile("kc-1");

            assertThat(result.getEmail()).isEqualTo("test@test.com");
            assertThat(result.getRole()).isEqualTo(UserRole.SUPER_ADMIN);
        }

        @Test
        void whenKeycloakFails_thenThrowsUserNotFound() {
            when(keycloakService.getUser("kc-unknown"))
                    .thenThrow(new UserNotFoundException("Not found"));

            assertThatThrownBy(() -> service.getUserProfile("kc-unknown"))
                    .isInstanceOf(UserNotFoundException.class);
        }
    }

    // ===== CREATE USER =====

    @Nested
    class CreateUser {

        @Test
        void whenValid_thenCreatesInKeycloakAndDb() {
            CreateUserDto createDto = new CreateUserDto();
            createDto.setEmail("new@test.com");
            createDto.setFirstName("Jane");
            createDto.setLastName("Smith");
            createDto.setPassword("secret123");
            createDto.setRole("HOST");

            when(keycloakService.createUser(createDto)).thenReturn("kc-new-1");
            when(userRepository.save(any(User.class))).thenAnswer(inv -> {
                User u = inv.getArgument(0);
                u.setId(1L);
                return u;
            });

            // Mock getUserProfile call
            KeycloakUserDto kcUser = buildKeycloakUser("kc-new-1", "new@test.com", "Jane", "Smith");
            when(keycloakService.getUser("kc-new-1")).thenReturn(kcUser);
            when(userRepository.findByKeycloakId("kc-new-1")).thenReturn(Optional.empty());

            UserProfileDto result = service.createUser(createDto);

            assertThat(result.getEmail()).isEqualTo("new@test.com");

            ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
            verify(userRepository).save(captor.capture());
            assertThat(captor.getValue().getKeycloakId()).isEqualTo("kc-new-1");
            assertThat(captor.getValue().getRole()).isEqualTo(UserRole.HOST);
        }
    }

    // ===== UPDATE USER =====

    @Nested
    class UpdateUser {

        @Test
        void whenRoleChanged_thenUpdatesInDb() {
            UpdateUserDto updateDto = new UpdateUserDto();
            updateDto.setRole("SUPER_ADMIN");

            User businessUser = new User();
            businessUser.setKeycloakId("kc-1");
            businessUser.setRole(UserRole.HOST);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(businessUser));

            KeycloakUserDto kcUser = buildKeycloakUser("kc-1", "test@test.com", "Test", "User");
            when(keycloakService.getUser("kc-1")).thenReturn(kcUser);

            service.updateUser("kc-1", updateDto);

            verify(keycloakService).updateUser("kc-1", updateDto);
            ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
            verify(userRepository).save(captor.capture());
            assertThat(captor.getValue().getRole()).isEqualTo(UserRole.SUPER_ADMIN);
        }
    }

    // ===== DELETE USER =====

    @Nested
    class DeleteUser {

        @Test
        void whenExists_thenDeletesFromBoth() {
            User businessUser = new User();
            businessUser.setKeycloakId("kc-1");
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(businessUser));

            service.deleteUser("kc-1");

            verify(keycloakService).deleteUser("kc-1");
            verify(userRepository).delete(any(User.class));
        }

        @Test
        void whenNoBusinessUser_thenOnlyDeletesFromKeycloak() {
            when(userRepository.findByKeycloakId("kc-2")).thenReturn(Optional.empty());

            service.deleteUser("kc-2");

            verify(keycloakService).deleteUser("kc-2");
            verify(userRepository, never()).delete(any(User.class));
        }
    }

    // ===== USER EXISTS =====

    @Nested
    class UserExists {

        @Test
        void whenDelegates_thenReturnsResult() {
            when(keycloakService.userExists("kc-1")).thenReturn(true);

            assertThat(service.userExists("kc-1")).isTrue();
        }
    }
}
