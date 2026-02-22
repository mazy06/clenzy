package com.clenzy.controller;

import com.clenzy.dto.ChangeOrgMemberRoleRequest;
import com.clenzy.dto.OrganizationMemberDto;
import com.clenzy.model.OrgMemberRole;
import com.clenzy.model.OrganizationMember;
import com.clenzy.model.User;
import com.clenzy.service.OrganizationService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrganizationMemberControllerTest {

    @Mock private OrganizationService organizationService;

    private OrganizationMemberController controller;

    private Jwt createJwt() {
        return Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "user-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    private OrganizationMember createMember(Long id, OrgMemberRole role) {
        OrganizationMember member = new OrganizationMember();
        member.setId(id);
        member.setRoleInOrg(role);
        member.setJoinedAt(LocalDateTime.now());
        User user = new User();
        user.setFirstName("Jean");
        user.setLastName("Dupont");
        user.setEmail("jean@test.com");
        member.setUser(user);
        return member;
    }

    @BeforeEach
    void setUp() {
        controller = new OrganizationMemberController(organizationService);
    }

    @Nested
    @DisplayName("listMembers")
    class ListMembers {
        @Test
        void whenSuccess_thenReturnsList() {
            OrganizationMember member = createMember(1L, OrgMemberRole.ADMIN);
            when(organizationService.getMembersWithUser(10L)).thenReturn(List.of(member));

            ResponseEntity<List<OrganizationMemberDto>> response = controller.listMembers(10L, createJwt());

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
            assertThat(response.getBody().get(0).getFirstName()).isEqualTo("Jean");
            verify(organizationService).validateOrgManagement("user-123", 10L);
        }
    }

    @Nested
    @DisplayName("changeMemberRole")
    class ChangeRole {
        @Test
        void whenValidRole_thenReturnsOk() {
            ChangeOrgMemberRoleRequest request = mock(ChangeOrgMemberRoleRequest.class);
            when(request.getRole()).thenReturn("ADMIN");
            OrganizationMember updated = createMember(1L, OrgMemberRole.ADMIN);
            when(organizationService.changeMemberRole(10L, 1L, OrgMemberRole.ADMIN)).thenReturn(updated);

            ResponseEntity<?> response = controller.changeMemberRole(10L, 1L, request, createJwt());

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenInvalidRole_thenBadRequest() {
            ChangeOrgMemberRoleRequest request = mock(ChangeOrgMemberRoleRequest.class);
            when(request.getRole()).thenReturn("INVALID_ROLE");

            ResponseEntity<?> response = controller.changeMemberRole(10L, 1L, request, createJwt());

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenIllegalState_thenBadRequest() {
            ChangeOrgMemberRoleRequest request = mock(ChangeOrgMemberRoleRequest.class);
            when(request.getRole()).thenReturn("ADMIN");
            when(organizationService.changeMemberRole(10L, 1L, OrgMemberRole.ADMIN))
                    .thenThrow(new IllegalStateException("Cannot change role"));

            ResponseEntity<?> response = controller.changeMemberRole(10L, 1L, request, createJwt());

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenNotFound_thenReturns404() {
            ChangeOrgMemberRoleRequest request = mock(ChangeOrgMemberRoleRequest.class);
            when(request.getRole()).thenReturn("ADMIN");
            when(organizationService.changeMemberRole(10L, 1L, OrgMemberRole.ADMIN))
                    .thenThrow(new RuntimeException("Member not found"));

            ResponseEntity<?> response = controller.changeMemberRole(10L, 1L, request, createJwt());

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }
    }

    @Nested
    @DisplayName("removeMember")
    class RemoveMember {
        @Test
        void whenSuccess_thenReturnsNoContent() {
            ResponseEntity<?> response = controller.removeMember(10L, 1L, createJwt());

            assertThat(response.getStatusCode().value()).isEqualTo(204);
            verify(organizationService).removeMemberById(10L, 1L);
        }

        @Test
        void whenIllegalState_thenBadRequest() {
            doThrow(new IllegalStateException("Cannot remove")).when(organizationService).removeMemberById(10L, 1L);

            ResponseEntity<?> response = controller.removeMember(10L, 1L, createJwt());

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenNotFound_thenReturns404() {
            doThrow(new RuntimeException("Not found")).when(organizationService).removeMemberById(10L, 1L);

            ResponseEntity<?> response = controller.removeMember(10L, 1L, createJwt());

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }
    }
}
