package com.clenzy.controller;

import com.clenzy.dto.ActivityConfigDto;
import com.clenzy.dto.UpsertActivityConfigRequest;
import com.clenzy.model.ActivityProvider;
import com.clenzy.service.ActivityService;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Gestion (cote hote) des connexions aux providers d'activites affiliees.
 * La cle API n'est jamais renvoyee (cf. {@link ActivityConfigDto}).
 */
@RestController
@RequestMapping("/api/activities")
@PreAuthorize("hasAnyRole('HOST','SUPER_ADMIN','SUPER_MANAGER')")
public class ActivityAffiliateController {

    private final ActivityService activityService;
    private final TenantContext tenantContext;

    public ActivityAffiliateController(ActivityService activityService, TenantContext tenantContext) {
        this.activityService = activityService;
        this.tenantContext = tenantContext;
    }

    @GetMapping("/configs")
    public ResponseEntity<List<ActivityConfigDto>> listConfigs() {
        return ResponseEntity.ok(activityService.listConfigs(tenantContext.getOrganizationId()));
    }

    @PutMapping("/configs/{provider}")
    public ResponseEntity<ActivityConfigDto> upsertConfig(@PathVariable ActivityProvider provider,
                                                          @RequestBody UpsertActivityConfigRequest request) {
        ActivityConfigDto dto = activityService.upsertConfig(
            tenantContext.getOrganizationId(), provider,
            request.apiKey(), request.affiliateId(), request.enabled());
        return ResponseEntity.ok(dto);
    }
}
