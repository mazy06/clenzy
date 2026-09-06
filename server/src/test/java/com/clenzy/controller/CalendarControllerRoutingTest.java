package com.clenzy.controller;

import com.clenzy.integration.channel.AirbnbChannelAdapter;
import com.clenzy.service.CalendarEngine;
import com.clenzy.service.PlanningPricingService;
import com.clenzy.service.PriceEngine;
import com.clenzy.service.ReservationService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.core.MethodParameter;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Routage des endpoints du calendrier.
 *
 * <p>Les autres tests de ce controller appellent ses methodes EN DIRECT : ils
 * ne passent jamais par la resolution d'URL de Spring. Or {@code /api/calendar}
 * expose a la fois {@code /{propertyId}} et des segments litteraux
 * ({@code /blocked}, et desormais {@code /pricing}). Si le litteral se faisait
 * happer par le gabarit, l'URL partirait vers {@code getAvailability} avec
 * {@code propertyId = "pricing"} et echouerait a la conversion — un 400 en
 * production que pas un seul test d'appel direct n'aurait vu.</p>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("CalendarController — resolution des URL")
class CalendarControllerRoutingTest {

    @Mock private CalendarEngine calendarEngine;
    @Mock private ReservationService reservationService;
    @Mock private TenantContext tenantContext;
    @Mock private PriceEngine priceEngine;
    @Mock private AirbnbChannelAdapter airbnbChannelAdapter;
    @Mock private PlanningPricingService planningPricingService;

    private MockMvc mockMvc;

    /** Le controller lit le porteur via {@code @AuthenticationPrincipal}. */
    private static class JwtArgumentResolver implements HandlerMethodArgumentResolver {
        @Override
        public boolean supportsParameter(MethodParameter parameter) {
            return parameter.hasParameterAnnotation(AuthenticationPrincipal.class);
        }

        @Override
        public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mav,
                                      NativeWebRequest request, WebDataBinderFactory binder) {
            return Jwt.withTokenValue("token")
                    .header("alg", "RS256")
                    .claim("sub", "user-123")
                    .issuedAt(Instant.now())
                    .expiresAt(Instant.now().plusSeconds(3600))
                    .build();
        }
    }

    @BeforeEach
    void setUp() {
        CalendarController controller = new CalendarController(calendarEngine,
                reservationService, tenantContext, priceEngine, airbnbChannelAdapter,
                planningPricingService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setCustomArgumentResolvers(new JwtArgumentResolver())
                .build();

        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(planningPricingService.pricingRows(any(), any(), any(), anyLong(), anyBoolean()))
                .thenReturn(List.of());
        when(calendarEngine.getDays(anyLong(), any(), any(), anyLong())).thenReturn(List.of());
        when(calendarEngine.getBlockedOrMaintenanceDays(any(), any(), any(), anyLong()))
                .thenReturn(List.of());
    }

    @Test
    void pricingBatchUrlReachesTheBatchHandler_notThePropertyIdTemplate() throws Exception {
        mockMvc.perform(get("/api/calendar/pricing")
                        .param("propertyIds", "1,2")
                        .param("from", "2026-09-01")
                        .param("to", "2026-09-05"))
                .andExpect(status().isOk());

        // La preuve que le segment litteral gagne : le lot a bien recu les DEUX
        // logements. Si l'URL avait ete happee par /{propertyId}, on aurait eu
        // une erreur de conversion, jamais cet appel.
        verify(planningPricingService).pricingRows(eq(List.of(1L, 2L)), any(LocalDate.class),
                any(LocalDate.class), eq(1L), eq(true));
    }

    @Test
    void singlePropertyPricingUrlStillReachesItsOwnHandler() throws Exception {
        mockMvc.perform(get("/api/calendar/7/pricing")
                        .param("from", "2026-09-01")
                        .param("to", "2026-09-05"))
                .andExpect(status().isOk());

        verify(planningPricingService).pricingRows(eq(List.of(7L)), any(LocalDate.class),
                any(LocalDate.class), eq(1L), eq(false));
    }

    @Test
    void blockedUrlIsUnaffectedByTheNewLiteralSegment() throws Exception {
        mockMvc.perform(get("/api/calendar/blocked")
                        .param("propertyIds", "1")
                        .param("from", "2026-09-01")
                        .param("to", "2026-09-05"))
                .andExpect(status().isOk());

        verify(planningPricingService, never()).pricingRows(any(), any(), any(), anyLong(), anyBoolean());
    }

    @Test
    void availabilityUrlStillResolvesForANumericSegment() throws Exception {
        mockMvc.perform(get("/api/calendar/42")
                        .param("from", "2026-09-01")
                        .param("to", "2026-09-05"))
                .andExpect(status().isOk());

        verify(calendarEngine).getDays(eq(42L), any(LocalDate.class), any(LocalDate.class), eq(1L));
    }
}
