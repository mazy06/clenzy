package com.clenzy.controller;

import com.clenzy.service.BaitlyMobileWorkService;
import com.clenzy.dto.InterventionResponse;
import org.springframework.data.domain.Page;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/mobile") @PreAuthorize("isAuthenticated()")
public class BaitlyMobileWorkController {
    private final BaitlyMobileWorkService service;
    private final com.clenzy.service.BaitlyMobileIssueService issues;
    private final com.clenzy.tenant.TenantContext tenant;
    private final com.clenzy.service.BaitlyMissionRestockService restock;
    private final com.clenzy.service.BaitlyMissionEvidenceService evidence;
    @GetMapping("/missions/{id}/restock") public com.clenzy.service.BaitlyMissionRestockService.Overview stock(@PathVariable Long id,@AuthenticationPrincipal Jwt jwt){return restock.list(id,jwt);}
    @PostMapping("/missions/{id}/restock") public com.clenzy.service.BaitlyMissionRestockService.Receipt restock(@PathVariable Long id,@RequestBody com.clenzy.service.BaitlyMissionRestockService.Request body,@AuthenticationPrincipal Jwt jwt){return restock.record(id,body,jwt);}
    public BaitlyMobileWorkController(BaitlyMobileWorkService service,com.clenzy.tenant.TenantContext tenant,com.clenzy.service.BaitlyMobileIssueService issues,com.clenzy.service.BaitlyMissionRestockService restock,com.clenzy.service.BaitlyMissionEvidenceService evidence){this.service=service;this.tenant=tenant;this.issues=issues;this.restock=restock;this.evidence=evidence;}
    @PutMapping("/missions/{id}/diagnostic") public void diagnostic(@PathVariable Long id,@RequestBody com.clenzy.service.BaitlyMissionEvidenceService.Diagnostic body,@AuthenticationPrincipal Jwt jwt){evidence.recordDiagnostic(id,body,jwt);}
    @PutMapping("/missions/{id}/signature") public void signature(@PathVariable Long id,@RequestBody com.clenzy.service.BaitlyMissionEvidenceService.Signature body,@AuthenticationPrincipal Jwt jwt){evidence.recordSignature(id,body,jwt);}
    public record IssueBody(String title,String description){}
    @PostMapping("/missions/{id}/issues") public java.util.Map<String,Long> issue(@PathVariable Long id,@RequestBody IssueBody issue,@AuthenticationPrincipal Jwt jwt){return issues.report(id,issue.title(),issue.description(),jwt);}
    public record Report(String notes,String completedSteps,Long version){}
    @GetMapping("/capabilities") public BaitlyMobileWorkService.Capabilities capabilities(@AuthenticationPrincipal Jwt jwt){return service.capabilities(jwt);}
    @GetMapping("/owner-missions") public Page<InterventionResponse> owner(@RequestParam(defaultValue="0") int page,@RequestParam(required=false) String status,@AuthenticationPrincipal Jwt jwt){return service.ownerMissions(jwt,page,status,tenant.getRequiredOrganizationId());}
    @GetMapping("/missions") public Page<InterventionResponse> assigned(@RequestParam(defaultValue="0") int page,@AuthenticationPrincipal Jwt jwt){return service.assigned(jwt,page);}
    @GetMapping("/missions/{id}") public BaitlyMobileWorkService.Work detail(@PathVariable Long id,@AuthenticationPrincipal Jwt jwt){return service.detail(id,jwt);}
    @PostMapping("/missions/{id}/{action:accept|decline|start|submit}") public InterventionResponse action(@PathVariable Long id,@PathVariable String action,@AuthenticationPrincipal Jwt jwt){return service.action(id,action,jwt);}
    @PutMapping("/missions/{id}/report") public InterventionResponse report(@PathVariable Long id,@RequestBody Report report,@AuthenticationPrincipal Jwt jwt){return service.report(id,report.notes(),report.completedSteps(),report.version(),jwt);}
}
