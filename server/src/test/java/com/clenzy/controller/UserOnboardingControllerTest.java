package com.clenzy.controller;

import com.clenzy.dto.OnboardingStatusDto;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.service.UserOnboardingService;
import com.clenzy.service.UserService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.MockedStatic;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserOnboardingControllerTest {

    @Mock private UserOnboardingService onboardingService;
    @Mock private UserService userService;
    @Mock private TenantContext tenantContext;
    @Mock private Jwt jwt;

    @InjectMocks
    private UserOnboardingController controller;

    private static final String KC_ID = "kc-user-123";
    private User user;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(42L);
        user.setKeycloakId(KC_ID);
        lenient().when(jwt.getSubject()).thenReturn(KC_ID);
        lenient().when(userService.findByKeycloakId(KC_ID)).thenReturn(user);
    }

    @Test
    void getMyStatus_returnsOnboardingDto() {
        OnboardingStatusDto dto = new OnboardingStatusDto("HOST", false, List.of());
        when(tenantContext.getOrganizationId()).thenReturn(7L);

        try (MockedStatic<com.clenzy.util.JwtRoleExtractor> roleMock =
                 mockStatic(com.clenzy.util.JwtRoleExtractor.class)) {
            roleMock.when(() -> com.clenzy.util.JwtRoleExtractor.extractUserRole(jwt))
                .thenReturn(UserRole.HOST);
            when(onboardingService.getStatus(42L, UserRole.HOST, 7L)).thenReturn(dto);

            ResponseEntity<OnboardingStatusDto> response = controller.getMyStatus(jwt);

            assertEquals(HttpStatus.OK, response.getStatusCode());
            assertEquals(dto, response.getBody());
        }
    }

    @Test
    void getMyStatus_userNotFound_throwsIllegalState() {
        when(userService.findByKeycloakId(KC_ID)).thenReturn(null);

        IllegalStateException ex = assertThrows(IllegalStateException.class,
            () -> controller.getMyStatus(jwt));
        assertTrue(ex.getMessage().contains(KC_ID));
    }

    @Test
    void completeStep_delegatesToService() {
        when(tenantContext.getOrganizationId()).thenReturn(5L);

        try (MockedStatic<com.clenzy.util.JwtRoleExtractor> roleMock =
                 mockStatic(com.clenzy.util.JwtRoleExtractor.class)) {
            roleMock.when(() -> com.clenzy.util.JwtRoleExtractor.extractUserRole(jwt))
                .thenReturn(UserRole.HOST);

            ResponseEntity<Void> response = controller.completeStep(jwt, "step.fiscal");

            assertEquals(HttpStatus.OK, response.getStatusCode());
            verify(onboardingService).completeStep(42L, UserRole.HOST, "step.fiscal", 5L);
        }
    }

    @Test
    void dismiss_delegatesToService() {
        try (MockedStatic<com.clenzy.util.JwtRoleExtractor> roleMock =
                 mockStatic(com.clenzy.util.JwtRoleExtractor.class)) {
            roleMock.when(() -> com.clenzy.util.JwtRoleExtractor.extractUserRole(jwt))
                .thenReturn(UserRole.SUPER_ADMIN);

            ResponseEntity<Void> response = controller.dismiss(jwt);

            assertEquals(HttpStatus.OK, response.getStatusCode());
            verify(onboardingService).dismiss(42L, UserRole.SUPER_ADMIN);
        }
    }

    @Test
    void reset_delegatesToService() {
        try (MockedStatic<com.clenzy.util.JwtRoleExtractor> roleMock =
                 mockStatic(com.clenzy.util.JwtRoleExtractor.class)) {
            roleMock.when(() -> com.clenzy.util.JwtRoleExtractor.extractUserRole(jwt))
                .thenReturn(UserRole.HOST);

            ResponseEntity<Void> response = controller.reset(jwt);

            assertEquals(HttpStatus.OK, response.getStatusCode());
            verify(onboardingService).reset(42L, UserRole.HOST);
        }
    }
}
