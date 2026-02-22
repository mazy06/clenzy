package com.clenzy.controller;

import com.clenzy.dto.AssignmentRequest;
import com.clenzy.dto.ManagerAssociationsDto;
import com.clenzy.dto.TeamUserAssignmentRequest;
import com.clenzy.dto.manager.AssignmentResultDto;
import com.clenzy.dto.manager.ManagerTeamSummaryDto;
import com.clenzy.dto.manager.ManagerUserSummaryDto;
import com.clenzy.dto.manager.PropertyAssignmentResultDto;
import com.clenzy.dto.manager.PropertyByClientDto;
import com.clenzy.dto.manager.TeamUserAssignmentResultDto;
import com.clenzy.dto.manager.UnassignmentResultDto;
import com.clenzy.service.ManagerService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ManagerControllerTest {

    @Mock
    private ManagerService managerService;

    private ManagerController managerController;

    private Jwt adminJwt;

    @BeforeEach
    void setUp() {
        managerController = new ManagerController(managerService);

        adminJwt = Jwt.withTokenValue("mock-token")
                .header("alg", "RS256")
                .subject("kc-admin-1")
                .claim("realm_access", Map.of("roles", List.of("SUPER_ADMIN")))
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    @Test
    void whenGetAllManagers_thenReturnsManagerList() {
        // Arrange
        List<ManagerUserSummaryDto> managers = List.of(
                new ManagerUserSummaryDto(1L, "Admin", "User", "admin@clenzy.fr", "SUPER_ADMIN", true),
                new ManagerUserSummaryDto(2L, "Manager", "Un", "manager1@clenzy.fr", "SUPER_MANAGER", true)
        );
        when(managerService.getAllManagersAndAdmins()).thenReturn(managers);

        // Act
        ResponseEntity<List<ManagerUserSummaryDto>> response = managerController.getAllManagersAndAdmins();

        // Assert
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(2, response.getBody().size());
        assertEquals("Admin", response.getBody().get(0).firstName());
        verify(managerService).getAllManagersAndAdmins();
    }

    @Test
    void whenGetAllHosts_thenReturnsHostList() {
        // Arrange
        List<ManagerUserSummaryDto> hosts = List.of(
                new ManagerUserSummaryDto(10L, "Host", "One", "host1@test.com", "HOST", true)
        );
        when(managerService.getAvailableHostSummaries()).thenReturn(hosts);

        // Act
        ResponseEntity<List<ManagerUserSummaryDto>> response = managerController.getAllHostUsers();

        // Assert
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(1, response.getBody().size());
        verify(managerService).getAvailableHostSummaries();
    }

    @Test
    void whenGetPropertiesByClients_thenReturnsPropertyList() {
        // Arrange
        List<Long> clientIds = List.of(10L, 20L);
        List<PropertyByClientDto> properties = List.of(
                new PropertyByClientDto(1L, "Apt Paris", "1 rue de la Paix", "Paris", "APARTMENT", "ACTIVE", 10L, "Host One", true)
        );
        when(managerService.getPropertiesByClients(clientIds)).thenReturn(properties);

        // Act
        ResponseEntity<List<PropertyByClientDto>> response = managerController.getPropertiesByClients(clientIds);

        // Assert
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(1, response.getBody().size());
        assertEquals("Apt Paris", response.getBody().get(0).name());
        verify(managerService).getPropertiesByClients(clientIds);
    }

    @Test
    void whenGetManagerClients_thenReturnsOk() {
        // Act — stub endpoint, just returns empty OK
        ResponseEntity<?> response = managerController.getManagerClients(5L, adminJwt);

        // Assert
        assertEquals(HttpStatus.OK, response.getStatusCode());
    }

    @Test
    void whenGetManagerAssociationsAsAdmin_thenReturnsAssociations() {
        // Arrange
        ManagerAssociationsDto associations = new ManagerAssociationsDto(
                Collections.emptyList(), Collections.emptyList(),
                Collections.emptyList(), Collections.emptyList()
        );
        when(managerService.resolveManagerId("5")).thenReturn(Optional.of(5L));
        when(managerService.getManagerAssociations(5L)).thenReturn(associations);

        // Act
        ResponseEntity<ManagerAssociationsDto> response =
                managerController.getManagerAssociations("5", adminJwt);

        // Assert
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        verify(managerService).resolveManagerId("5");
        verify(managerService).validateManagerOwnership(adminJwt, 5L);
        verify(managerService).getManagerAssociations(5L);
    }

    @Test
    void whenGetManagerAssociationsUserNotFound_thenReturnsEmptyAssociations() {
        // Arrange — UUID that does not resolve
        when(managerService.resolveManagerId("unknown-uuid")).thenReturn(Optional.empty());

        // Act
        ResponseEntity<ManagerAssociationsDto> response =
                managerController.getManagerAssociations("unknown-uuid", adminJwt);

        // Assert
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody().getClients().isEmpty());
        assertTrue(response.getBody().getProperties().isEmpty());
        assertTrue(response.getBody().getTeams().isEmpty());
        assertTrue(response.getBody().getUsers().isEmpty());
        verify(managerService, never()).getManagerAssociations(anyLong());
    }

    @Test
    void whenAssignClientsAndProperties_thenDelegatesToService() {
        // Arrange
        AssignmentRequest request = new AssignmentRequest(List.of(10L), List.of(100L));
        AssignmentResultDto result = new AssignmentResultDto("Assignation reussie", 1, 1, 42L);
        when(managerService.assignClientsAndProperties(5L, request)).thenReturn(result);

        // Act
        ResponseEntity<AssignmentResultDto> response =
                managerController.assignClientsAndProperties(5L, request);

        // Assert
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(1, response.getBody().clientsAssigned());
        assertEquals(1, response.getBody().propertiesAssigned());
        verify(managerService).assignClientsAndProperties(5L, request);
    }

    @Test
    void whenAssignTeamsAndUsers_thenDelegatesToService() {
        // Arrange
        TeamUserAssignmentRequest request = new TeamUserAssignmentRequest(5L, List.of(1L), List.of(2L));
        TeamUserAssignmentResultDto result = new TeamUserAssignmentResultDto("Assignation reussie", 1, 1);
        when(managerService.assignTeamsAndUsers(5L, request)).thenReturn(result);

        // Act
        ResponseEntity<TeamUserAssignmentResultDto> response =
                managerController.assignTeamsAndUsers(5L, request);

        // Assert
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(1, response.getBody().teamsAssigned());
        assertEquals(1, response.getBody().usersAssigned());
        verify(managerService).assignTeamsAndUsers(5L, request);
    }

    @Test
    void whenGetOperationalUsers_thenDelegatesToService() {
        // Arrange
        List<ManagerUserSummaryDto> users = List.of(
                new ManagerUserSummaryDto(20L, "Tech", "One", "tech@test.com", "TECHNICIAN", true)
        );
        when(managerService.getOperationalUsers()).thenReturn(users);

        // Act
        ResponseEntity<List<ManagerUserSummaryDto>> response = managerController.getOperationalUsers();

        // Assert
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(1, response.getBody().size());
        verify(managerService).getOperationalUsers();
    }

    @Test
    void whenGetAllTeams_thenDelegatesToService() {
        // Arrange
        List<ManagerTeamSummaryDto> teams = List.of(
                new ManagerTeamSummaryDto(1L, "Equipe Nettoyage", "Nettoyage general", "CLEANING", 3, true)
        );
        when(managerService.getAllTeamSummaries()).thenReturn(teams);

        // Act
        ResponseEntity<List<ManagerTeamSummaryDto>> response = managerController.getAllTeams();

        // Assert
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(1, response.getBody().size());
        assertEquals("Equipe Nettoyage", response.getBody().get(0).name());
        verify(managerService).getAllTeamSummaries();
    }

    @Test
    void whenUnassignClient_thenDelegatesToService() {
        // Arrange
        when(managerService.resolveManagerId("5")).thenReturn(Optional.of(5L));
        when(managerService.unassignClient(5L, 10L))
                .thenReturn(new UnassignmentResultDto("Client desassigne avec succes", 1));

        // Act
        ResponseEntity<UnassignmentResultDto> response = managerController.unassignClient("5", 10L);

        // Assert
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(1, response.getBody().removedCount());
        verify(managerService).unassignClient(5L, 10L);
    }

    @Test
    void whenUnassignClientWithUnknownManager_thenReturnsBadRequest() {
        // Arrange
        when(managerService.resolveManagerId("unknown")).thenReturn(Optional.empty());

        // Act
        ResponseEntity<UnassignmentResultDto> response = managerController.unassignClient("unknown", 10L);

        // Assert
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(managerService, never()).unassignClient(anyLong(), anyLong());
    }

    @Test
    void whenUnassignTeam_thenDelegatesToService() {
        // Arrange
        when(managerService.resolveManagerId("5")).thenReturn(Optional.of(5L));
        when(managerService.unassignTeam(5L, 3L))
                .thenReturn(new UnassignmentResultDto("Equipe desassignee avec succes", 1));

        // Act
        ResponseEntity<UnassignmentResultDto> response = managerController.unassignTeam("5", 3L);

        // Assert
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(1, response.getBody().removedCount());
        verify(managerService).unassignTeam(5L, 3L);
    }

    @Test
    void whenUnassignUser_thenDelegatesToService() {
        // Arrange
        when(managerService.resolveManagerId("5")).thenReturn(Optional.of(5L));
        when(managerService.unassignUser(5L, 20L))
                .thenReturn(new UnassignmentResultDto("Utilisateur desassigne avec succes", 1));

        // Act
        ResponseEntity<UnassignmentResultDto> response = managerController.unassignUser("5", 20L);

        // Assert
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(1, response.getBody().removedCount());
        verify(managerService).unassignUser(5L, 20L);
    }

    @Test
    void whenAssignPropertyToManager_thenDelegatesToService() {
        // Arrange
        when(managerService.resolveManagerId("5")).thenReturn(Optional.of(5L));
        when(managerService.assignPropertyToManager(5L, 100L))
                .thenReturn(new PropertyAssignmentResultDto("Propriete reassignee avec succes", 100L));

        // Act
        ResponseEntity<PropertyAssignmentResultDto> response =
                managerController.assignPropertyToManager("5", 100L);

        // Assert
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(100L, response.getBody().propertyId());
        verify(managerService).assignPropertyToManager(5L, 100L);
    }

    @Test
    void whenUnassignPropertyFromManager_thenDelegatesToService() {
        // Arrange
        when(managerService.resolveManagerId("5")).thenReturn(Optional.of(5L));
        when(managerService.unassignPropertyFromManager(5L, 100L))
                .thenReturn(new PropertyAssignmentResultDto("Propriete desassignee avec succes", 100L));

        // Act
        ResponseEntity<PropertyAssignmentResultDto> response =
                managerController.unassignPropertyFromManager("5", 100L);

        // Assert
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(100L, response.getBody().propertyId());
        verify(managerService).unassignPropertyFromManager(5L, 100L);
    }
}
