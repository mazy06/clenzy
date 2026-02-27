package com.clenzy.controller;

import com.clenzy.dto.AutomationExecutionDto;
import com.clenzy.dto.AutomationRuleDto;
import com.clenzy.dto.CreateAutomationRuleRequest;
import com.clenzy.model.AutomationRule;
import com.clenzy.repository.AutomationExecutionRepository;
import com.clenzy.repository.AutomationRuleRepository;
import com.clenzy.repository.MessageTemplateRepository;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/automation-rules")
@PreAuthorize("isAuthenticated()")
public class AutomationRuleController {

    private final AutomationRuleRepository ruleRepository;
    private final AutomationExecutionRepository executionRepository;
    private final MessageTemplateRepository templateRepository;
    private final TenantContext tenantContext;

    public AutomationRuleController(AutomationRuleRepository ruleRepository,
                                     AutomationExecutionRepository executionRepository,
                                     MessageTemplateRepository templateRepository,
                                     TenantContext tenantContext) {
        this.ruleRepository = ruleRepository;
        this.executionRepository = executionRepository;
        this.templateRepository = templateRepository;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public ResponseEntity<List<AutomationRuleDto>> getAll() {
        Long orgId = tenantContext.getOrganizationId();
        List<AutomationRuleDto> rules = ruleRepository.findByOrganizationIdOrderBySortOrderAsc(orgId)
            .stream().map(AutomationRuleDto::from).toList();
        return ResponseEntity.ok(rules);
    }

    @GetMapping("/{id}")
    public ResponseEntity<AutomationRuleDto> getById(@PathVariable Long id) {
        Long orgId = tenantContext.getOrganizationId();
        return ruleRepository.findByIdAndOrganizationId(id, orgId)
            .map(AutomationRuleDto::from)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<AutomationRuleDto> create(@Valid @RequestBody CreateAutomationRuleRequest request) {
        Long orgId = tenantContext.getOrganizationId();

        AutomationRule rule = new AutomationRule();
        rule.setOrganizationId(orgId);
        rule.setName(request.name());
        rule.setTriggerType(request.triggerType());
        rule.setTriggerOffsetDays(request.triggerOffsetDays());
        rule.setTriggerTime(request.triggerTime() != null ? request.triggerTime() : "09:00");
        rule.setConditions(request.conditions());
        rule.setActionType(request.actionType() != null ? request.actionType() : com.clenzy.model.AutomationAction.SEND_MESSAGE);
        if (request.templateId() != null) {
            rule.setTemplate(templateRepository.findByIdAndOrganizationId(request.templateId(), orgId).orElse(null));
        }
        rule.setDeliveryChannel(request.deliveryChannel() != null ? request.deliveryChannel() : com.clenzy.model.MessageChannelType.EMAIL);

        rule = ruleRepository.save(rule);
        return ResponseEntity.ok(AutomationRuleDto.from(rule));
    }

    @PutMapping("/{id}")
    public ResponseEntity<AutomationRuleDto> update(@PathVariable Long id,
                                                      @Valid @RequestBody CreateAutomationRuleRequest request) {
        Long orgId = tenantContext.getOrganizationId();
        AutomationRule rule = ruleRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Rule introuvable: " + id));

        rule.setName(request.name());
        rule.setTriggerType(request.triggerType());
        rule.setTriggerOffsetDays(request.triggerOffsetDays());
        if (request.triggerTime() != null) rule.setTriggerTime(request.triggerTime());
        rule.setConditions(request.conditions());
        if (request.actionType() != null) rule.setActionType(request.actionType());
        if (request.templateId() != null) {
            rule.setTemplate(templateRepository.findByIdAndOrganizationId(request.templateId(), orgId).orElse(null));
        }
        if (request.deliveryChannel() != null) rule.setDeliveryChannel(request.deliveryChannel());

        rule = ruleRepository.save(rule);
        return ResponseEntity.ok(AutomationRuleDto.from(rule));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        Long orgId = tenantContext.getOrganizationId();
        AutomationRule rule = ruleRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Rule introuvable: " + id));
        ruleRepository.delete(rule);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/toggle")
    public ResponseEntity<AutomationRuleDto> toggle(@PathVariable Long id) {
        Long orgId = tenantContext.getOrganizationId();
        AutomationRule rule = ruleRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Rule introuvable: " + id));
        rule.setEnabled(!rule.isEnabled());
        rule = ruleRepository.save(rule);
        return ResponseEntity.ok(AutomationRuleDto.from(rule));
    }

    @GetMapping("/{id}/executions")
    public ResponseEntity<Page<AutomationExecutionDto>> getExecutions(
            @PathVariable Long id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Long orgId = tenantContext.getOrganizationId();
        Page<AutomationExecutionDto> result = executionRepository
            .findByAutomationRuleIdAndOrganizationIdOrderByCreatedAtDesc(id, orgId, PageRequest.of(page, size))
            .map(AutomationExecutionDto::from);
        return ResponseEntity.ok(result);
    }
}
