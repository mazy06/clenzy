package com.clenzy.controller;

import com.clenzy.dto.GuestbookEntryDto;
import com.clenzy.dto.WelcomeGuideDto;
import com.clenzy.dto.WelcomeGuideRequest;
import com.clenzy.model.Property;
import com.clenzy.model.WelcomeGuide;
import com.clenzy.model.WelcomeGuideToken;
import com.clenzy.service.WelcomeGuideService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WelcomeGuideControllerTest {

    @Mock private WelcomeGuideService guideService;
    @Mock private com.clenzy.service.WelcomeGuideEntryService entryService;
    @Mock private TenantContext tenantContext;

    private WelcomeGuideController controller;

    @BeforeEach
    void setUp() {
        controller = new WelcomeGuideController(guideService, entryService, tenantContext);
    }

    private WelcomeGuide guide(Long id) {
        WelcomeGuide g = new WelcomeGuide();
        g.setId(id);
        g.setTitle("Welcome");
        g.setOrganizationId(7L);
        g.setSections("[]");
        g.setBrandingColor("#000000");
        g.setLanguage("fr");
        Property p = new Property();
        p.setId(99L);
        p.setName("Apt Paris");
        g.setProperty(p);
        return g;
    }

    private WelcomeGuideToken token(Long id) {
        WelcomeGuideToken t = new WelcomeGuideToken();
        t.setId(id);
        t.setToken(UUID.fromString("00000000-0000-0000-0000-000000000001"));
        return t;
    }

    @Test
    void getAll_returnsMappedDtos() {
        when(tenantContext.getOrganizationId()).thenReturn(7L);
        when(guideService.getAll(7L)).thenReturn(List.of(guide(1L), guide(2L)));

        ResponseEntity<List<WelcomeGuideDto>> response = controller.getAll();

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).hasSize(2);
    }

    @Nested
    @DisplayName("getById")
    class GetById {
        @Test
        void found_returnsDto() {
            when(tenantContext.getOrganizationId()).thenReturn(7L);
            when(guideService.getById(1L, 7L)).thenReturn(Optional.of(guide(1L)));

            ResponseEntity<WelcomeGuideDto> response = controller.getById(1L);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void missing_returns404() {
            when(tenantContext.getOrganizationId()).thenReturn(7L);
            when(guideService.getById(99L, 7L)).thenReturn(Optional.empty());

            ResponseEntity<WelcomeGuideDto> response = controller.getById(99L);

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }
    }

    @Test
    void create_delegatesToService() {
        when(tenantContext.getOrganizationId()).thenReturn(7L);
        WelcomeGuideRequest req = new WelcomeGuideRequest(99L, "Welcome", "fr",
                "[]", "#000000", "https://logo", false);
        when(guideService.createGuide(eq(7L), eq(99L), eq("Welcome"), eq("fr"), eq("[]"),
                eq("#000000"), eq("https://logo"))).thenReturn(guide(1L));

        ResponseEntity<WelcomeGuideDto> response = controller.create(req);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().id()).isEqualTo(1L);
    }

    @Test
    void update_delegatesToService() {
        when(tenantContext.getOrganizationId()).thenReturn(7L);
        WelcomeGuideRequest req = new WelcomeGuideRequest(99L, "Updated", "fr",
                "[]", "#ffffff", "https://logo", true);
        when(guideService.updateGuide(eq(1L), eq(7L), eq("Updated"), eq("[]"),
                eq("#ffffff"), eq("https://logo"), eq(true))).thenReturn(guide(1L));

        ResponseEntity<WelcomeGuideDto> response = controller.update(1L, req);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void delete_returns204() {
        when(tenantContext.getOrganizationId()).thenReturn(7L);

        ResponseEntity<Void> response = controller.delete(1L);

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        verify(guideService).deleteGuide(1L, 7L);
    }

    @Test
    void generateToken_returnsTokenAndLink() {
        when(tenantContext.getOrganizationId()).thenReturn(7L);
        WelcomeGuideToken tok = token(1L);
        when(guideService.generateToken(1L, 7L, null)).thenReturn(tok);
        when(guideService.generateGuideLink(tok)).thenReturn("https://app.clenzy.fr/guide/abc");

        ResponseEntity<Map<String, String>> response = controller.generateToken(1L);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsEntry("token", "00000000-0000-0000-0000-000000000001");
        assertThat(response.getBody()).containsEntry("link", "https://app.clenzy.fr/guide/abc");
    }

    @Test
    void getQrCode_returnsPngBytes() {
        when(tenantContext.getOrganizationId()).thenReturn(7L);
        WelcomeGuideToken tok = token(1L);
        when(guideService.generateToken(1L, 7L, null)).thenReturn(tok);
        when(guideService.generateGuideLink(tok)).thenReturn("https://link");
        byte[] png = new byte[] {1, 2, 3, 4};
        when(guideService.generateQrCode(anyString(), anyInt(), anyInt())).thenReturn(png);

        ResponseEntity<byte[]> response = controller.getQrCode(1L);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getHeaders().getContentType()).isEqualTo(MediaType.IMAGE_PNG);
        assertThat(response.getBody()).isEqualTo(png);
    }

    @Test
    void getGuestbook_returnsEntries() {
        when(tenantContext.getOrganizationId()).thenReturn(7L);
        when(entryService.listForGuide(1L, 7L)).thenReturn(List.of(
            new GuestbookEntryDto(1L, "Alice", "Merci pour le séjour !", 5, null)));

        ResponseEntity<List<GuestbookEntryDto>> response = controller.getGuestbook(1L);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).hasSize(1);
    }

    @Test
    void share_returnsLinkAndQrCode() {
        when(tenantContext.getOrganizationId()).thenReturn(7L);
        WelcomeGuideToken tok = token(1L);
        when(guideService.generateToken(1L, 7L, null)).thenReturn(tok);
        when(guideService.generateGuideLink(tok)).thenReturn("https://app.clenzy.fr/guide/abc");
        when(guideService.generateQrCode(anyString(), anyInt(), anyInt())).thenReturn(new byte[]{1, 2, 3});

        ResponseEntity<Map<String, String>> response = controller.share(1L);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsEntry("link", "https://app.clenzy.fr/guide/abc");
        assertThat(response.getBody().get("qrCode")).startsWith("data:image/png;base64,");
    }
}
