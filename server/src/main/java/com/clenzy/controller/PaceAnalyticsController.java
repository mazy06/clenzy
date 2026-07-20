package com.clenzy.controller;

import com.clenzy.dto.BookingCurveDto;
import com.clenzy.dto.PaceSummaryDto;
import com.clenzy.model.UserRole;
import com.clenzy.service.PaceAnalyticsService;
import com.clenzy.tenant.TenantContext;
import com.clenzy.util.JwtRoleExtractor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.YearMonth;
import java.time.format.DateTimeParseException;

/**
 * Analytics on-the-books (pace / pickup / booking curve) — fondations RMS R1.
 *
 * <p>Org-scope strict : l'organisation vient du contexte tenant, jamais d'un
 * paramètre ; un HOST est restreint à ses logements (ownerKc). La propriété
 * optionnelle est filtrée en base par (propertyId AND organizationId) — une
 * propriété hors org renvoie simplement des agrégats vides, aucune fuite
 * possible. Controller mince : validation + délégation + DTO.</p>
 */
@RestController
@RequestMapping("/api/analytics/pace")
@PreAuthorize("isAuthenticated()")
public class PaceAnalyticsController {

    private static final int MAX_MONTHS = 12;

    private final PaceAnalyticsService paceAnalyticsService;
    private final TenantContext tenantContext;

    public PaceAnalyticsController(PaceAnalyticsService paceAnalyticsService,
                                   TenantContext tenantContext) {
        this.paceAnalyticsService = paceAnalyticsService;
        this.tenantContext = tenantContext;
    }

    @GetMapping("/summary")
    public PaceSummaryDto getSummary(
            @RequestParam(name = "months", defaultValue = "3") int months,
            @RequestParam(name = "propertyId", required = false) Long propertyId,
            @AuthenticationPrincipal Jwt jwt) {
        if (months < 1 || months > MAX_MONTHS) {
            throw new IllegalArgumentException("months doit être entre 1 et " + MAX_MONTHS);
        }
        return paceAnalyticsService.getSummary(
                tenantContext.getRequiredOrganizationId(), ownerScope(jwt), months, propertyId);
    }

    @GetMapping("/booking-curve")
    public BookingCurveDto getBookingCurve(
            @RequestParam(name = "month") String month,
            @RequestParam(name = "propertyId", required = false) Long propertyId,
            @AuthenticationPrincipal Jwt jwt) {
        final YearMonth stayMonth;
        try {
            stayMonth = YearMonth.parse(month);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("month invalide (attendu AAAA-MM): " + month);
        }
        return paceAnalyticsService.getBookingCurve(
                tenantContext.getRequiredOrganizationId(), ownerScope(jwt), stayMonth, propertyId);
    }

    /** HOST → restreint à ses logements ; autres rôles → périmètre org complet. */
    private static String ownerScope(Jwt jwt) {
        return JwtRoleExtractor.extractUserRole(jwt) == UserRole.HOST ? jwt.getSubject() : null;
    }
}
