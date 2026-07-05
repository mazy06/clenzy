package com.clenzy.service;

import com.clenzy.dto.AutomationExecutionDto;
import com.clenzy.dto.AutomationRuleDto;
import com.clenzy.dto.CreateAutomationRuleRequest;
import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.AutomationTrigger;
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
import java.util.Set;
import java.util.stream.Collectors;

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

    /**
     * Jeu de regles recommandees (chantier B) : sur, sans doublon avec les flux
     * existants. On exclut volontairement le menage (deja genere par le flux
     * reservation) et les envois guest (dependants d'un template). Toutes les
     * actions ici sont soit des notifications internes, soit des suggestions HITL
     * (aucun effet argent auto), soit une relance de facture bornee.
     */
    private record RecommendedRule(String name, AutomationTrigger trigger, AutomationAction action, int offsetDays) {}

    private static final List<RecommendedRule> RECOMMENDED = List.of(
        new RecommendedRule("Alerte bruit → notifier l'equipe", AutomationTrigger.NOISE_ALERT, AutomationAction.NOTIFY_STAFF, 0),
        new RecommendedRule("Paiement echoue → notifier l'equipe", AutomationTrigger.PAYMENT_FAILED, AutomationAction.NOTIFY_STAFF, 0),
        new RecommendedRule("Capteur hors ligne → notifier l'equipe", AutomationTrigger.IOT_DEVICE_OFFLINE, AutomationAction.NOTIFY_STAFF, 0),
        new RecommendedRule("Batterie serrure critique → intervention preventive", AutomationTrigger.LOCK_BATTERY_CRITICAL, AutomationAction.CREATE_MAINTENANCE_INTERVENTION, 0),
        new RecommendedRule("Facture impayee → relance", AutomationTrigger.INVOICE_OVERDUE, AutomationAction.SEND_INVOICE_REMINDER, 0),
        new RecommendedRule("Annulation → suggerer un remboursement de caution", AutomationTrigger.RESERVATION_CANCELLED, AutomationAction.SUGGEST_DEPOSIT_REFUND, 0),
        new RecommendedRule("Check-out J+2 → suggerer une liberation de caution", AutomationTrigger.CHECK_OUT_PASSED, AutomationAction.SUGGEST_DEPOSIT_RELEASE, 2)
    );

    /**
     * Crée les règles recommandées absentes pour une organisation. Idempotent :
     * une règle déjà présente pour un couple (déclencheur, action) n'est pas
     * dupliquée. Appelé automatiquement à la création d'une organisation
     * (les règles recommandées sont actives par défaut) ; les orgs existantes
     * sont amorcées par le changeset de migration correspondant.
     *
     * @return le nombre de règles créées
     */
    @Transactional
    public int seedRecommendedForOrg(Long orgId) {
        List<AutomationRule> existing = ruleRepository.findByOrganizationIdOrderBySortOrderAsc(orgId);
        Set<String> present = existing.stream()
            .map(r -> r.getTriggerType() + "|" + r.getActionType())
            .collect(Collectors.toSet());
        int sortOrder = existing.stream().mapToInt(AutomationRule::getSortOrder).max().orElse(0);

        int created = 0;
        for (RecommendedRule rec : RECOMMENDED) {
            if (present.contains(rec.trigger() + "|" + rec.action())) {
                continue; // idempotent
            }
            AutomationRule rule = new AutomationRule();
            rule.setOrganizationId(orgId);
            rule.setName(rec.name());
            rule.setTriggerType(rec.trigger());
            rule.setTriggerOffsetDays(rec.offsetDays());
            rule.setTriggerTime("09:00");
            rule.setActionType(rec.action());
            rule.setEnabled(true);
            rule.setSortOrder(++sortOrder);
            rule.setDeliveryChannel(MessageChannelType.EMAIL);
            ruleRepository.save(rule);
            created++;
        }
        return created;
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
