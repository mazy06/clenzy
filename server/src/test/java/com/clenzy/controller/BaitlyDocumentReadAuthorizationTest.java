package com.clenzy.controller;

import com.clenzy.dto.DocumentGenerationDto;
import com.clenzy.model.DocumentGeneration;
import com.clenzy.model.ReferenceType;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.service.*;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.service.messaging.GuestMessagingQueryService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.access.ExceptionTranslationFilter;
import org.springframework.security.web.authentication.Http403ForbiddenEntryPoint;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class BaitlyDocumentReadAuthorizationTest {
    final TenantContext tenant = mock(TenantContext.class);
    final InterventionRepository interventions = mock(InterventionRepository.class);
    final DocumentGeneratorService documents = mock(DocumentGeneratorService.class);
    final DocumentStorageService storage = mock(DocumentStorageService.class);
    final DocumentAccessService access = new DocumentAccessService(interventions, new OrganizationAccessGuard(tenant));
    final DocumentController controller = new DocumentController(documents, storage,
            mock(DocumentComplianceService.class), access, mock(PropertyService.class),
            mock(GuestMessagingQueryService.class), tenant);
    MockMvc mvc;

    @BeforeEach void prepare() {
        when(tenant.getOrganizationId()).thenReturn(10L);
        mvc = MockMvcBuilders.standaloneSetup(controller)
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .addFilters(new ExceptionTranslationFilter(new Http403ForbiddenEntryPoint())).build();
    }
    @AfterEach void clearIdentity() { SecurityContextHolder.clearContext(); }

    Jwt identity(String role, String email) {
        var builder = Jwt.withTokenValue("synthetic").header("alg", "none").subject("technician-fixture");
        if (role != null) builder.claim("realm_access", Map.of("roles", List.of(role)));
        if (email != null) builder.claim("email", email);
        Jwt jwt = builder.build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt, List.of()));
        return jwt;
    }
    DocumentGeneration document(Long org, String recipient) {
        var doc = new DocumentGeneration();
        doc.setOrganizationId(org);
        doc.setEmailTo(recipient);
        doc.setFilePath("fixture/private.pdf");
        doc.setFileName("fixture.pdf");
        return doc;
    }

    @Test void directMetadataAndPdfCannotBypassTheRecipientRestriction() throws Exception {
        identity("TECHNICIAN", "self@example.invalid");
        when(documents.getGeneration(1L)).thenReturn(document(10L, "another@example.invalid"));
        mvc.perform(get("/api/documents/generations/1")).andExpect(status().isForbidden());
        mvc.perform(get("/api/documents/generations/1/download")).andExpect(status().isForbidden());
        verify(documents, never()).getGenerationDto(anyLong());
        verifyNoInteractions(storage);
    }

    @Test void matchingEmailNeverBypassesAnotherOrUnknownOrganization() throws Exception {
        identity("TECHNICIAN", "self@example.invalid");
        for (Long org : new Long[]{20L, null}) {
            when(documents.getGeneration(1L)).thenReturn(document(org, "self@example.invalid"));
            mvc.perform(get("/api/documents/generations/1/download")).andExpect(status().isForbidden());
        }
        verifyNoInteractions(storage);
    }

    @Test void missingEmailDoesNotExposeReferenceResultsOrBinary() throws Exception {
        Jwt jwt = identity("HOUSEKEEPER", null);
        var doc = document(10L, "another@example.invalid");
        when(documents.getGeneration(1L)).thenReturn(doc);
        when(documents.getGenerationsByReference(ReferenceType.RESERVATION, 7L))
                .thenReturn(List.of(DocumentGenerationDto.fromEntity(doc)));
        mvc.perform(get("/api/documents/generations/1/download")).andExpect(status().isForbidden());
        assertThat(controller.getGenerationsByReference(jwt, "RESERVATION", 7L).getBody()).isEmpty();
        verifyNoInteractions(storage);
    }

    @Test void missingUnknownOrTechnicalOnlyRolesNeverInheritHostAccess() throws Exception {
        when(documents.getGeneration(1L)).thenReturn(document(10L, "self@example.invalid"));
        for (String role : new String[]{null, "UNKNOWN_ROLE", "offline_access"}) {
            Jwt jwt = identity(role, "self@example.invalid");
            mvc.perform(get("/api/documents/generations/1/download")).andExpect(status().isForbidden());
            assertThatThrownBy(() -> controller.getGenerationsByReference(jwt, "RESERVATION", 7L))
                    .isInstanceOf(AccessDeniedException.class);
        }
        verify(documents, never()).getGenerationsByReference(any(), anyLong());
        verifyNoInteractions(storage);
    }

    @Test void assignedRecipientReadsPrivatePdfWithoutBrowserCaching() throws Exception {
        identity("TECHNICIAN", "self@example.invalid");
        var doc = document(10L, "SELF@example.invalid");
        doc.setReferenceType(ReferenceType.INTERVENTION);
        doc.setReferenceId(70L);
        when(documents.getGeneration(1L)).thenReturn(doc);
        when(interventions.findAssignedUserKeycloakIdById(70L)).thenReturn("technician-fixture");
        when(storage.load("fixture/private.pdf")).thenReturn(new ByteArrayResource(new byte[]{1,2,3}));
        mvc.perform(get("/api/documents/generations/1/download"))
                .andExpect(status().isOk()).andExpect(content().bytes(new byte[]{1,2,3}))
                .andExpect(header().string("Cache-Control", "no-cache, no-store, must-revalidate"));
    }

    @Test void addressedButUnassignedWorkerCannotReadInterventionPdf() throws Exception {
        identity("TECHNICIAN", "self@example.invalid");
        var doc = document(10L, "self@example.invalid");
        doc.setReferenceType(ReferenceType.INTERVENTION);
        doc.setReferenceId(70L);
        when(documents.getGeneration(1L)).thenReturn(doc);
        when(interventions.findAssignedUserKeycloakIdById(70L)).thenReturn("another-fixture");
        mvc.perform(get("/api/documents/generations/1/download")).andExpect(status().isForbidden());
        verifyNoInteractions(storage);
    }

    @Test void managerAndSupervisorAccessWithinOrganizationIsPreserved() throws Exception {
        when(documents.getGeneration(1L)).thenReturn(document(10L, "another@example.invalid"));
        when(storage.load("fixture/private.pdf")).thenReturn(new ByteArrayResource(new byte[]{1}));
        for (String role : List.of("HOST", "SUPERVISOR")) {
            identity(role, null);
            mvc.perform(get("/api/documents/generations/1/download")).andExpect(status().isOk());
        }
    }

    @Test void unknownRoleWithMalformedRealmCannotTriggerAHostFallback() {
        Jwt jwt = Jwt.withTokenValue("synthetic").header("alg", "none").subject("fixture")
                .claim("realm_access", "invalid-fixture").build();
        assertThatThrownBy(() -> access.requireReader(jwt)).isInstanceOf(AccessDeniedException.class);
    }
}
