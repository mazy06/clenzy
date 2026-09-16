package com.clenzy.controller;

import com.clenzy.service.assignment.AssignmentRealtime;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@PreAuthorize("isAuthenticated()")
public class AssignmentStreamController {
    private final AssignmentRealtime realtime;
    private final TenantContext tenant;
    public AssignmentStreamController(AssignmentRealtime realtime,TenantContext tenant) {
        this.realtime=realtime; this.tenant=tenant;
    }
    @GetMapping(value="/api/service-assignments/stream",produces="text/event-stream")
    public SseEmitter stream() throws java.io.IOException {
        return realtime.subscribe(tenant.getRequiredOrganizationId());
    }
}
