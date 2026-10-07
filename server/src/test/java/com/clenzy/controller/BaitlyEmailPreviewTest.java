package com.clenzy.controller;

import com.clenzy.service.messaging.*;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringJUnitConfig(BaitlyEmailPreviewTest.Config.class)
class BaitlyEmailPreviewTest {
    @Configuration @EnableMethodSecurity static class Config {
        @Bean TenantContext tenant() { return mock(TenantContext.class); }
        @Bean BaitlyEmailPreviewService previews() { return new BaitlyEmailPreviewService(new EmailWrapperService(), new TemplateInterpolationService(null)); }
        @Bean BaitlyEmailPreviewController controller(BaitlyEmailPreviewService previews, TenantContext tenant) { return new BaitlyEmailPreviewController(previews, tenant); }
    }
    @Autowired BaitlyEmailPreviewController controller;
    @Autowired BaitlyEmailPreviewService previews;
    @Autowired TenantContext tenant;
    MockMvc mvc;
    @BeforeEach void setup() { reset(tenant); when(tenant.getRequiredOrganizationId()).thenReturn(2L); mvc=MockMvcBuilders.standaloneSetup(controller).build(); }

    @Test void anonymousCannotGeneratePreview() {
        assertThatThrownBy(() -> controller.preview(new BaitlyEmailPreviewController.Request("Test", "Test", null, null)))
            .isInstanceOf(org.springframework.security.core.AuthenticationException.class);
        verifyNoInteractions(tenant);
    }
    @Test @WithMockUser void contextIsRequiredEvenForReadOnlyRendering() {
        doThrow(new org.springframework.security.access.AccessDeniedException("Organisation requise")).when(tenant).getRequiredOrganizationId();
        assertThatThrownBy(() -> controller.preview(new BaitlyEmailPreviewController.Request("Test", "Test", null, null)))
            .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }
    @Test @WithMockUser void httpRendersFictionalDataAndRejectsUnboundedContent() throws Exception {
        mvc.perform(post("/api/document-previews/email").contentType("application/json")
                .content("{\"subject\":\"Bienvenue {guestName}\",\"body\":\"Logement : {propertyName}\",\"language\":\"fr\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.subject").value("Bienvenue Camille Exemple"))
            .andExpect(jsonPath("$.html").value(org.hamcrest.Matchers.containsString("Appartement Les Étoiles (exemple)")));
        mvc.perform(post("/api/document-previews/email").contentType("application/json")
                .content("{\"subject\":\""+"A".repeat(256)+"\",\"body\":\"Test\"}"))
            .andExpect(status().isBadRequest());
        mvc.perform(post("/api/document-previews/email").contentType("application/json")
                .content("{\"subject\":\"Test\",\"body\":\"Test\",\"wrapperStyle\":\"INVALID\"}"))
            .andExpect(status().isBadRequest());
    }
    @ParameterizedTest @ValueSource(strings={"NOTIFICATION_GUEST","NOTIFICATION_OWNER","INVITATION","INTERNAL_FORM","INTERNAL_URGENT"})
    void sameShellAndFictionalDetailsForEveryEmailFamily(String style) throws Exception {
        var preview = previews.render("Exemple {guestName}", "Bonjour *{guestFirstName}*,\n\n{arrivalInstructions}\n\n{detailsHtml}\n\n[Consulter → {invitationLink}]\n\n{unknownCustomTag}", style, "fr");
        var html = org.jsoup.Jsoup.parse(preview.html());
        assertThat(html.text()).contains("Camille", "Appartement Les Étoiles", "Exemple fictif", "AUCUN ENVOI");
        assertThat(html.select("a[href],script,iframe,form")).isEmpty();
        assertThat(preview.html()).contains("#193d67", "Arial,sans-serif", "max-width:600px").doesNotContain("{guest", "{unknown");
        java.nio.file.Path output=java.nio.file.Path.of("target/email-preview-review"); java.nio.file.Files.createDirectories(output);
        java.nio.file.Files.writeString(output.resolve(style+".html"), preview.html());
    }
    @Test void maliciousMarkupAndRemoteImagesCannotExecuteOrTrackInPreview() {
        var html = org.jsoup.Jsoup.parse(previews.render("Exemple", "<script>alert(1)</script><a href='https://example.invalid'>Lien</a><img src='https://example.invalid/tracker' onerror='alert(1)'>", "NOTIFICATION_GUEST", "ar").html());
        assertThat(html.select("script,a[href],img[src],*[onerror]")).isEmpty();
        assertThat(html.body().attr("dir")).isEqualTo("rtl");
        assertThat(html.selectFirst("meta[http-equiv=Content-Security-Policy]").attr("content")).contains("default-src 'none'");
    }
}
