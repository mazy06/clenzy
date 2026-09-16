package com.clenzy.controller;

import com.clenzy.service.assignment.*;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@RestController
@RequestMapping("/api/service-assignments")
@PreAuthorize("isAuthenticated()")
public class ServiceAssignmentController {
    private final ServiceAssignmentService service;
    private final AssignmentProposalStore proposals;
    private final AssignmentPolicyStore policies;
    private final TenantContext tenant;
    private final AssignmentQuoteService quotes;
    private final AssignmentContactPreferences contacts;
    private final AssignmentCardQuery cards;
    public ServiceAssignmentController(ServiceAssignmentService service, AssignmentProposalStore proposals,
            AssignmentPolicyStore policies, TenantContext tenant,AssignmentQuoteService quotes,AssignmentContactPreferences contacts,AssignmentCardQuery cards) {
        this.service=service; this.proposals=proposals; this.policies=policies; this.tenant=tenant;
        this.quotes=quotes; this.contacts=contacts; this.cards=cards;
    }
    @GetMapping("/cards")
    public List<AssignmentCardQuery.Card> cards(@AuthenticationPrincipal Jwt jwt,@RequestParam List<Long> ids) {
        return cards.cards(service.currentUser(jwt),ids);
    }
    @GetMapping("/contact-preferences")
    public AssignmentContactPreferences.Preferences contacts(@AuthenticationPrincipal Jwt jwt) {
        return contacts.get(service.currentUser(jwt));
    }
    @PutMapping("/contact-preferences")
    @Transactional
    public AssignmentContactPreferences.Preferences contacts(@AuthenticationPrincipal Jwt jwt,
            @RequestBody AssignmentContactPreferences.Preferences preferences) {
        return contacts.save(service.currentUser(jwt),preferences);
    }
    @GetMapping("/inbox")
    public List<ServiceAssignmentService.InboxItem> inbox(@AuthenticationPrincipal Jwt jwt,@RequestParam(defaultValue="0") int page) {
        if (page<0 || page>10000) throw new IllegalArgumentException("Page invalide");
        return service.inbox(jwt,page);
    }
    public record Reply(boolean accept, String reason) {}
    @GetMapping("/requests/{id}/quotes")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
    public List<ServiceQuoteController.ServiceQuoteDto> quotes(@PathVariable Long id,@AuthenticationPrincipal Jwt jwt) {
        return quotes.list(id,tenant.getRequiredOrganizationId(),jwt).stream().map(ServiceQuoteController.ServiceQuoteDto::from).toList();
    }
    @PostMapping("/requests/{id}/proposals/{proposalId}/quote")
    public Long quote(@PathVariable Long id,@PathVariable Long proposalId,@RequestBody AssignmentQuoteService.Offer offer,
            @AuthenticationPrincipal Jwt jwt) {
        return quotes.submit(id,proposalId,offer,jwt);
    }
    @PostMapping("/requests/{id}/proposals/{proposalId}/response")
    public ServiceAssignmentService.Decision respond(@PathVariable Long id,@PathVariable Long proposalId,
            @RequestBody Reply body,@AuthenticationPrincipal Jwt jwt) {
        return service.respond(id,proposalId,body.accept(),body.reason(),jwt);
    }
    @GetMapping("/requests/{id}/history")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
    @Transactional(readOnly=true)
    public List<AssignmentProposalStore.Proposal> history(@PathVariable Long id,@AuthenticationPrincipal Jwt jwt) {
        service.requireManager(id,tenant.getRequiredOrganizationId(),jwt);
        return proposals.history(id);
    }
    @PostMapping("/requests/{id}/resume")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
    @Transactional
    public void resume(@PathVariable Long id,@AuthenticationPrincipal Jwt jwt) {
        service.requireManager(id,tenant.getRequiredOrganizationId(),jwt);
        service.resume(id,tenant.getRequiredOrganizationId());
    }
    @GetMapping("/policy")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
    public AssignmentPolicyStore.Policy policy() { return policies.get(tenant.getRequiredOrganizationId()); }
    @PutMapping("/policy")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    @Transactional
    public AssignmentPolicyStore.Policy policy(@RequestBody AssignmentPolicyStore.Policy policy) {
        return policies.save(tenant.getRequiredOrganizationId(),policy);
    }
}
