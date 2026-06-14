package com.clenzy.controller;

import com.clenzy.dto.BulkCalendarRequest;
import com.clenzy.dto.BulkCalendarResult;
import com.clenzy.service.BulkCalendarService;
import com.clenzy.service.ReservationService;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Édition groupée du calendrier (CLZ-P0-10) — controller mince (audit #4) : validation
 * d'ownership par propriété puis délégation au {@link BulkCalendarService}.
 */
@RestController
@RequestMapping("/api/calendar/bulk")
@PreAuthorize("isAuthenticated()")
public class BulkCalendarController {

    private final BulkCalendarService bulkCalendarService;
    private final ReservationService reservationService;
    private final TenantContext tenantContext;

    public BulkCalendarController(BulkCalendarService bulkCalendarService,
                                  ReservationService reservationService,
                                  TenantContext tenantContext) {
        this.bulkCalendarService = bulkCalendarService;
        this.reservationService = reservationService;
        this.tenantContext = tenantContext;
    }

    @PostMapping
    public ResponseEntity<BulkCalendarResult> apply(@RequestBody BulkCalendarRequest request,
                                                    @AuthenticationPrincipal Jwt jwt) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        // Ownership par propriete (anti-IDOR) avant le lot ; chaque item revalide aussi l'org dans CalendarEngine.
        if (request.propertyIds() != null) {
            for (Long propertyId : request.propertyIds()) {
                reservationService.validatePropertyAccess(propertyId, jwt.getSubject());
            }
        }
        return ResponseEntity.ok(bulkCalendarService.apply(request, orgId, jwt.getSubject()));
    }
}
