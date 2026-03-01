package com.clenzy.controller;

import com.clenzy.dto.AutomationTriggerDto;
import com.clenzy.model.ExternalAutomation.AutomationEvent;
import com.clenzy.model.ExternalAutomation.AutomationPlatform;
import com.clenzy.service.AutomationService;
import com.clenzy.tenant.TenantContext;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/automations")
public class AutomationController {

    private final AutomationService automationService;
    private final TenantContext tenantContext;

    public AutomationController(AutomationService automationService,
                                 TenantContext tenantContext) {
        this.automationService = automationService;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public List<AutomationTriggerDto> getAll() {
        return automationService.getAllTriggers(tenantContext.getOrganizationId());
    }

    @GetMapping("/{id}")
    public AutomationTriggerDto getById(@PathVariable Long id) {
        return automationService.getById(id, tenantContext.getOrganizationId());
    }

    @PostMapping
    public AutomationTriggerDto create(@RequestBody Map<String, String> body) {
        return automationService.createTrigger(
            body.get("triggerName"),
            AutomationPlatform.valueOf(body.get("platform")),
            AutomationEvent.valueOf(body.get("triggerEvent")),
            body.get("callbackUrl"),
            tenantContext.getOrganizationId()
        );
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable Long id) {
        automationService.deleteTrigger(id, tenantContext.getOrganizationId());
        return Map.of("status", "deleted");
    }

    @PutMapping("/{id}/toggle")
    public AutomationTriggerDto toggle(@PathVariable Long id) {
        return automationService.toggleTrigger(id, tenantContext.getOrganizationId());
    }

    @GetMapping("/events")
    public AutomationEvent[] listEvents() {
        return AutomationEvent.values();
    }

    @GetMapping("/platforms")
    public AutomationPlatform[] listPlatforms() {
        return AutomationPlatform.values();
    }
}
