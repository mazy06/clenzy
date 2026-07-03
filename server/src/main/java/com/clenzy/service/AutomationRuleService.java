package com.clenzy.service;

import com.clenzy.dto.AutomationExecutionDto;
import com.clenzy.dto.AutomationRuleDto;
import com.clenzy.dto.CreateAutomationRuleRequest;
import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.MessageChannelType;
import com.clenzy.repository.AutomationExecutionRepository;
import com.clenzy.repository.AutomationRuleRepository;
import com.clenzy.repository.MessageTemplateRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * CRUD des regles d'automation de messages, scope organisation.
 * Logique deplacee depuis {@code AutomationRuleController}
 * (refactor T-ARCH-01 — controller mince).
 *
 * <h2>Securite</h2>
 * <p>Tout chargement par id passe par {@code findByIdAndOrganizationId} :
 * une regle d'une autre organisation est introuvable (pas de fuite cross-org).
 * Les templates references sont resolus avec le meme scope.</p>
 */
@Service
public class AutomationRuleService {

    private final AutomationRuleRepository ruleRepository;
    private final AutomationExecutionRepository executionRepository;
    private final MessageTemplateRepository templateRepository;
    private final TenantContext tenantContext;

    public AutomationRuleService(AutomationRuleRepository ruleRepository,
                                 AutomationExecutionRepository executionRepository,
                                 MessageTemplateRepository templateRepository,
                                 TenantContext tenantContext) {
        this.ruleRepository = ruleRepository;
        this.executionRepository = executionRepository;
        this.templateRepository = templateRepository;
        this.tenantContext = tenantContext;
    }

    @Transactional(readOnly = true)
    public List<AutomationRuleDto> getAll() {
        Long orgId = tenantContext.getOrganizationId();
        return ruleRepository.findByOrganizationIdOrderBySortOrderAsc(orgId)
            .stream().map(AutomationRuleDto::from).toList();
    }

    @Transactional(readOnly = true)
    public Optional<AutomationRuleDto> getById(Long id) {
        Long orgId = tenantContext.getOrganizationId();
        return ruleRepository.findByIdAndOrganizationId(id, orgId)
            .map(AutomationRuleDto::from);
    }

    @Transactional
    public AutomationRuleDto create(CreateAutomationRuleRequest request) {
        Long orgId = tenantContext.getOrganizationId();

        AutomationRule rule = new AutomationRule();
        rule.setOrganizationId(orgId);
        rule.setName(request.name());
        rule.setTriggerType(request.triggerType());
        rule.setTriggerOffsetDays(request.triggerOffsetDays());
        rule.setTriggerTime(request.triggerTime() != null ? request.triggerTime() : "09:00");
        rule.setConditions(request.conditions());
        rule.setActionType(request.actionType() != null ? request.actionType() : AutomationAction.SEND_MESSAGE);
        rule.setActionConfig(request.actionConfig());
        if (request.templateId() != null) {
            rule.setTemplate(templateRepository.findByIdAndOrganizationId(request.templateId(), orgId).orElse(null));
        }
        rule.setDeliveryChannel(request.deliveryChannel() != null ? request.deliveryChannel() : MessageChannelType.EMAIL);

        return AutomationRuleDto.from(ruleRepository.save(rule));
    }

    @Transactional
    public AutomationRuleDto update(Long id, CreateAutomationRuleRequest request) {
        Long orgId = tenantContext.getOrganizationId();
        AutomationRule rule = requireRule(id, orgId);

        rule.setName(request.name());
        rule.setTriggerType(request.triggerType());
        rule.setTriggerOffsetDays(request.triggerOffsetDays());
        if (request.triggerTime() != null) rule.setTriggerTime(request.triggerTime());
        rule.setConditions(request.conditions());
        if (request.actionType() != null) rule.setActionType(request.actionType());
        rule.setActionConfig(request.actionConfig());
        if (request.templateId() != null) {
            rule.setTemplate(templateRepository.findByIdAndOrganizationId(request.templateId(), orgId).orElse(null));
        }
        if (request.deliveryChannel() != null) rule.setDeliveryChannel(request.deliveryChannel());

        return AutomationRuleDto.from(ruleRepository.save(rule));
    }

    @Transactional
    public void delete(Long id) {
        Long orgId = tenantContext.getOrganizationId();
        AutomationRule rule = requireRule(id, orgId);
        ruleRepository.delete(rule);
    }

    @Transactional
    public AutomationRuleDto toggle(Long id) {
        Long orgId = tenantContext.getOrganizationId();
        AutomationRule rule = requireRule(id, orgId);
        rule.setEnabled(!rule.isEnabled());
        return AutomationRuleDto.from(ruleRepository.save(rule));
    }

    @Transactional(readOnly = true)
    public Page<AutomationExecutionDto> getExecutions(Long id, int page, int size) {
        Long orgId = tenantContext.getOrganizationId();
        return executionRepository
            .findByAutomationRuleIdAndOrganizationIdOrderByCreatedAtDesc(id, orgId, PageRequest.of(page, size))
            .map(AutomationExecutionDto::from);
    }

    private AutomationRule requireRule(Long id, Long orgId) {
        return ruleRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Rule introuvable: " + id));
    }
}
