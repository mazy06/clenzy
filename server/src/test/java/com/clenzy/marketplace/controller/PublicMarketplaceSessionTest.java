package com.clenzy.marketplace.controller;

import com.clenzy.marketplace.service.*;
import com.clenzy.service.LoginProtectionService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.hamcrest.Matchers.*;

/** Contrat HTTP du dossier public, sans service externe ni envoi de courriel. */
class PublicMarketplaceSessionTest {
    MarketplaceApplicationDocumentService documents;
    MarketplaceActivationService activation;
    MarketplacePublicRateLimiter limiter;
    MockMvc mvc;

    @BeforeEach
    void setup() {
        documents = mock(MarketplaceApplicationDocumentService.class);
        activation = mock(MarketplaceActivationService.class);
        limiter = mock(MarketplacePublicRateLimiter.class);
        mvc = MockMvcBuilders.standaloneSetup(new PublicMarketplaceController(
                mock(MarketplaceApplicationService.class), documents, mock(MarketplaceCatalogService.class),
                limiter, mock(LoginProtectionService.class), activation)).build();
    }

    @Test
    void legacyExchangeIssuesAnHttpOnlyCookieWithoutReturningTheSecretInJson() throws Exception {
        mvc.perform(post("/api/public/marketplace/applications/session")
                .header("X-Requested-With", "BaitlyApplication")
                .contentType("application/json").content("{\"token\":\"legacy-secret\"}"))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""))
                .andExpect(header().string("Set-Cookie", allOf(containsString("HttpOnly"),
                        containsString("Secure"), containsString("SameSite=None"),
                        containsString("Path=/api/public/marketplace/applications"))));
        verify(documents).describe("legacy-secret");
    }

    @Test
    void activationFailureReturnsAnActionableRecoveryResponse() throws Exception {
        when(limiter.tryAcquireUpload(any())).thenReturn(true);
        doThrow(new MarketplaceActivationService.ActivationRecoveryException(true))
                .when(activation).activate("secret", "valid-password");
        mvc.perform(post("/api/public/marketplace/activation")
                .contentType("application/json").content("{\"token\":\"secret\",\"password\":\"valid-password\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value("activation_recovery"))
                .andExpect(jsonPath("$.message").value(containsString("Un courriel")))
                .andExpect(content().string(not(containsString("valid-password"))));
    }

    @Test
    void aReusedActivationLinkIsRefusedAtTheHttpBoundary() throws Exception {
        when(limiter.tryAcquireUpload(any())).thenReturn(true);
        doThrow(new MarketplaceActivationService.InvalidActivationTokenException())
                .when(activation).activate("secret", "valid-password");
        mvc.perform(post("/api/public/marketplace/activation")
                .contentType("application/json").content("{\"token\":\"secret\",\"password\":\"valid-password\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value(containsString("Mot de passe oublié")));
    }

    @Test
    void invalidLegacyTokenDoesNotIssueACookie() throws Exception {
        when(documents.describe("expired")).thenThrow(new MarketplaceApplicationDocumentService.InvalidUploadTokenException());
        mvc.perform(post("/api/public/marketplace/applications/session")
                .header("X-Requested-With", "BaitlyApplication")
                .contentType("application/json").content("{\"token\":\"expired\"}"))
                .andExpect(status().isNotFound()).andExpect(header().doesNotExist("Set-Cookie"));
    }

    @Test
    void aCookieAloneCannotAuthorizeADeletion() throws Exception {
        mvc.perform(delete("/api/public/marketplace/applications/session")
                .cookie(new Cookie(MarketplaceApplicationSession.COOKIE, "secret")))
                .andExpect(status().isNotFound());
        verifyNoInteractions(documents);
    }

    @Test
    void withdrawalUsesCookieAndExpiresIt() throws Exception {
        mvc.perform(delete("/api/public/marketplace/applications/session")
                .header("X-Requested-With", "BaitlyApplication")
                .cookie(new Cookie(MarketplaceApplicationSession.COOKIE, "secret")))
                .andExpect(status().isNoContent())
                .andExpect(header().string("Set-Cookie", containsString("Max-Age=0")));
        verify(documents).withdraw("secret");
    }

    @Test
    void secretsInPathsAreNoLongerAcceptedEvenWithACookie() throws Exception {
        mvc.perform(delete("/api/public/marketplace/applications/secret")
                .header("X-Requested-With", "BaitlyApplication")
                .cookie(new Cookie(MarketplaceApplicationSession.COOKIE, "secret")))
                .andExpect(status().isNotFound());
        verifyNoInteractions(documents);
    }
}
