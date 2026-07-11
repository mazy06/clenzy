package com.clenzy.controller;

import com.clenzy.dto.IssueDtos.CreateIssueRequest;
import com.clenzy.dto.IssueDtos.IssueDto;
import com.clenzy.dto.IssueDtos.QualifyIssueRequest;
import com.clenzy.model.Issue.IssueSeverity;
import com.clenzy.model.Issue.IssueStatus;
import com.clenzy.service.IssueService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.jwt.Jwt;

import java.lang.reflect.Method;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Moteur Ménage 3C (P10) — gardes de rôle du controller anomalies.
 * L'exécution des @PreAuthorize est couverte par les tests d'intégration Spring
 * Security ; ici on fige le CONTRAT d'autorisation (annotations classe + méthodes
 * gestionnaires) et l'ownership structurel : le signaleur/converteur est TOUJOURS
 * le porteur du JWT, jamais un id fourni par le client.
 */
@ExtendWith(MockitoExtension.class)
class IssueControllerTest {

    @Mock private IssueService issueService;

    private IssueController controller;

    @BeforeEach
    void setUp() {
        controller = new IssueController(issueService);
    }

    private Jwt jwtFor(String subject) {
        return Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", subject)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    private static IssueDto dto(IssueStatus status) {
        return new IssueDto(55L, 3L, "P3", null, 9L, "Jane Doe", "Fuite", null,
                "PLUMBING_REPAIR", IssueSeverity.HIGH, status,
                null, null, null, null, null);
    }

    @Test
    @DisplayName("Classe : isAuthenticated() — aucun endpoint anonyme")
    void classRequiresAuthentication() {
        PreAuthorize annotation = IssueController.class.getAnnotation(PreAuthorize.class);
        assertThat(annotation).isNotNull();
        assertThat(annotation.value()).isEqualTo("isAuthenticated()");
    }

    @Test
    @DisplayName("qualify/convert/dismiss : réservés aux gestionnaires (SUPER_ADMIN/SUPER_MANAGER/HOST)")
    void managerEndpointsCarryRoleGuard() throws Exception {
        for (String action : new String[]{"qualify", "convert", "dismiss"}) {
            Method method = findMethod(action);
            PreAuthorize annotation = method.getAnnotation(PreAuthorize.class);
            assertThat(annotation)
                    .as("@PreAuthorize manquant sur %s", action)
                    .isNotNull();
            assertThat(annotation.value())
                    .contains("SUPER_ADMIN")
                    .contains("SUPER_MANAGER")
                    .contains("HOST");
        }
    }

    @Test
    @DisplayName("create/list/get : pas de garde de rôle supplémentaire (terrain autorisé)")
    void fieldEndpointsHaveNoExtraRoleGuard() throws Exception {
        for (String action : new String[]{"create", "list", "get"}) {
            Method method = findMethod(action);
            assertThat(method.getAnnotation(PreAuthorize.class))
                    .as("%s doit rester accessible aux rôles terrain", action)
                    .isNull();
        }
    }

    @Test
    @DisplayName("POST : le signaleur est le sujet du JWT — jamais un id client")
    void whenCreate_thenReporterIsJwtSubject() {
        CreateIssueRequest request = new CreateIssueRequest(
                3L, null, "Fuite", null, "PLUMBING_REPAIR", IssueSeverity.HIGH);
        when(issueService.create(request, "kc-housekeeper")).thenReturn(dto(IssueStatus.OPEN));

        var response = controller.create(request, jwtFor("kc-housekeeper"));

        assertThat(response.getStatusCode().value()).isEqualTo(201);
        verify(issueService).create(request, "kc-housekeeper");
    }

    @Test
    @DisplayName("PUT /convert : le converteur est le sujet du JWT")
    void whenConvert_thenConverterIsJwtSubject() {
        when(issueService.convert(55L, "kc-manager")).thenReturn(dto(IssueStatus.CONVERTED));

        var response = controller.convert(55L, jwtFor("kc-manager"));

        assertThat(response.getBody().status()).isEqualTo(IssueStatus.CONVERTED);
        verify(issueService).convert(55L, "kc-manager");
    }

    @Test
    @DisplayName("PUT /qualify : délégation au service")
    void whenQualify_thenDelegates() {
        QualifyIssueRequest request = new QualifyIssueRequest(null, IssueSeverity.CRITICAL, null);
        when(issueService.qualify(55L, request)).thenReturn(dto(IssueStatus.QUALIFIED));

        var response = controller.qualify(55L, request);

        assertThat(response.getBody().status()).isEqualTo(IssueStatus.QUALIFIED);
        verify(issueService).qualify(55L, request);
    }

    private static Method findMethod(String name) {
        for (Method method : IssueController.class.getDeclaredMethods()) {
            if (method.getName().equals(name)) {
                return method;
            }
        }
        throw new AssertionError("Méthode introuvable: " + name);
    }
}
