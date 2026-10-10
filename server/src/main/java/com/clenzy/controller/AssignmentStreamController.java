package com.clenzy.controller;

import com.clenzy.service.assignment.AssignmentRealtime;
import com.clenzy.tenant.TenantContext;
import jakarta.servlet.http.HttpServletResponse;
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
    public SseEmitter stream(HttpServletResponse response) throws java.io.IOException {
        Long organization = tenant.getRequiredOrganizationId();
        // Transmettre immédiatement les événements Baitly, y compris les keepalive.
        response.setHeader("X-Accel-Buffering", "no");
        return realtime.subscribe(organization);
    }
}
