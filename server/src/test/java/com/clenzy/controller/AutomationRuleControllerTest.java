package com.clenzy.controller;

import com.clenzy.dto.AutomationExecutionDto;
import com.clenzy.dto.AutomationRuleDto;
import com.clenzy.dto.CreateAutomationRuleRequest;
import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationExecution;
import com.clenzy.model.AutomationExecutionStatus;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.MessageChannelType;
import com.clenzy.model.MessageTemplate;
import com.clenzy.model.Reservation;
import com.clenzy.repository.AutomationExecutionRepository;
import com.clenzy.repository.AutomationRuleRepository;
import com.clenzy.repository.MessageTemplateRepository;
import com.clenzy.service.AutomationRuleService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AutomationRuleControllerTest {

    @Mock private AutomationRuleRepository ruleRepository;
    @Mock private AutomationExecutionRepository executionRepository;
    @Mock private MessageTemplateRepository templateRepository;
    @Mock private TenantContext tenantContext;

    private AutomationRuleController controller;

    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        // Service REEL construit au-dessus des repositories mockes (pattern Vague A)
        controller = new AutomationRuleController(new AutomationRuleService(
            ruleRepository, executionRepository, templateRepository, tenantContext));
    }

    private AutomationRule buildRule(Long id, String name, boolean enabled) {
        AutomationRule r = new AutomationRule();
        r.setId(id);
        r.setOrganizationId(ORG_ID);
        r.setName(name);
        r.setEnabled(enabled);
        r.setSortOrder(0);
        r.setTriggerType(AutomationTrigger.CHECK_IN_DAY);
        r.setTriggerOffsetDays(1);
        r.setTriggerTime("10:00");
        r.setConditions("{\"k\":\"v\"}");
        r.setActionType(AutomationAction.SEND_MESSAGE);
        r.setDeliveryChannel(MessageChannelType.EMAIL);
        return r;
    }

    @Nested
    @DisplayName("getAll")
    class GetAll {
        @Test
        void returnsListOfRulesForOrg() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            AutomationRule r1 = buildRule(1L, "Rule 1", true);
            AutomationRule r2 = buildRule(2L, "Rule 2", false);
            when(ruleRepository.findByOrganizationIdOrderBySortOrderAsc(ORG_ID))
                .thenReturn(List.of(r1, r2));

            ResponseEntity<List<AutomationRuleDto>> response = controller.getAll();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(2);
            assertThat(response.getBody().get(0).name()).isEqualTo("Rule 1");
        }

        @Test
        void emptyListReturnsOk() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(ruleRepository.findByOrganizationIdOrderBySortOrderAsc(ORG_ID))
                .thenReturn(List.of());

            ResponseEntity<List<AutomationRuleDto>> response = controller.getAll();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).isEmpty();
        }
    }

    @Nested
    @DisplayName("getById")
    class GetById {
        @Test
        void whenFound_returnsRule() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            AutomationRule r = buildRule(7L, "Found", true);
            when(ruleRepository.findByIdAndOrganizationId(7L, ORG_ID)).thenReturn(Optional.of(r));

            ResponseEntity<AutomationRuleDto> response = controller.getById(7L);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().id()).isEqualTo(7L);
        }

        @Test
        void whenNotFound_returns404() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(ruleRepository.findByIdAndOrganizationId(99L, ORG_ID)).thenReturn(Optional.empty());

            ResponseEntity<AutomationRuleDto> response = controller.getById(99L);

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }
    }

    @Nested
    @DisplayName("create")
    class Create {
        @Test
        void createMinimalRule_savesAndReturnsDto() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            CreateAutomationRuleRequest request = new CreateAutomationRuleRequest(
                "New rule", AutomationTrigger.RESERVATION_CONFIRMED, 0, null,
                null, null, null, null);

            when(ruleRepository.save(any(AutomationRule.class))).thenAnswer(inv -> {
                AutomationRule r = inv.getArgument(0);
                r.setId(100L);
                return r;
            });

            ResponseEntity<AutomationRuleDto> response = controller.create(request);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().id()).isEqualTo(100L);
            assertThat(response.getBody().name()).isEqualTo("New rule");
            assertThat(response.getBody().triggerTime()).isEqualTo("09:00"); // default
            assertThat(response.getBody().actionType()).isEqualTo(AutomationAction.SEND_MESSAGE);
            assertThat(response.getBody().deliveryChannel()).isEqualTo(MessageChannelType.EMAIL);
            verify(templateRepository, never()).findByIdAndOrganizationId(any(), any());
        }

        @Test
        void createWithAllFields_savesProperly() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            MessageTemplate template = new MessageTemplate();
            template.setId(50L);
            template.setName("My template");
            when(templateRepository.findByIdAndOrganizationId(50L, ORG_ID))
                .thenReturn(Optional.of(template));

            CreateAutomationRuleRequest request = new CreateAutomationRuleRequest(
                "Full rule", AutomationTrigger.CHECK_OUT_DAY, 2, "12:30",
                "{\"propertyId\":1}", AutomationAction.SEND_CHECKIN_LINK, 50L,
                MessageChannelType.WHATSAPP);

            when(ruleRepository.save(any(AutomationRule.class))).thenAnswer(inv -> {
                AutomationRule r = inv.getArgument(0);
                r.setId(200L);
                return r;
            });

            ResponseEntity<AutomationRuleDto> response = controller.create(request);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().triggerTime()).isEqualTo("12:30");
            assertThat(response.getBody().actionType()).isEqualTo(AutomationAction.SEND_CHECKIN_LINK);
            assertThat(response.getBody().deliveryChannel()).isEqualTo(MessageChannelType.WHATSAPP);
            assertThat(response.getBody().templateId()).isEqualTo(50L);
            assertThat(response.getBody().templateName()).isEqualTo("My template");
        }

        @Test
        void createWithTemplateNotFound_setsNullTemplate() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(templateRepository.findByIdAndOrganizationId(999L, ORG_ID))
                .thenReturn(Optional.empty());

            CreateAutomationRuleRequest request = new CreateAutomationRuleRequest(
                "Rule", AutomationTrigger.RESERVATION_CONFIRMED, 0, null,
                null, null, 999L, null);

            when(ruleRepository.save(any())).thenAnswer(inv -> {
                AutomationRule r = inv.getArgument(0);
                r.setId(1L);
                return r;
            });

            ResponseEntity<AutomationRuleDto> response = controller.create(request);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().templateId()).isNull();
        }
    }

    @Nested
    @DisplayName("update")
    class Update {
        @Test
        void whenFound_updatesAndReturnsDto() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            AutomationRule existing = buildRule(10L, "Old", true);
            when(ruleRepository.findByIdAndOrganizationId(10L, ORG_ID))
                .thenReturn(Optional.of(existing));

            CreateAutomationRuleRequest request = new CreateAutomationRuleRequest(
                "Updated", AutomationTrigger.CHECK_OUT_PASSED, 5, "08:00",
                "{}", AutomationAction.SEND_GUIDE, null, MessageChannelType.SMS);

            when(ruleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            ResponseEntity<AutomationRuleDto> response = controller.update(10L, request);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().name()).isEqualTo("Updated");
            assertThat(response.getBody().triggerType()).isEqualTo(AutomationTrigger.CHECK_OUT_PASSED);
            assertThat(response.getBody().triggerOffsetDays()).isEqualTo(5);
            assertThat(response.getBody().triggerTime()).isEqualTo("08:00");
            assertThat(response.getBody().actionType()).isEqualTo(AutomationAction.SEND_GUIDE);
            assertThat(response.getBody().deliveryChannel()).isEqualTo(MessageChannelType.SMS);
        }

        @Test
        void whenNotFound_throws() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(ruleRepository.findByIdAndOrganizationId(99L, ORG_ID))
                .thenReturn(Optional.empty());

            CreateAutomationRuleRequest request = new CreateAutomationRuleRequest(
                "Updated", AutomationTrigger.RESERVATION_CONFIRMED, 0, null,
                null, null, null, null);

            assertThatThrownBy(() -> controller.update(99L, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Rule introuvable");
        }

        @Test
        void updateWithTemplate_resolvesTemplate() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            AutomationRule existing = buildRule(10L, "Old", true);
            when(ruleRepository.findByIdAndOrganizationId(10L, ORG_ID))
                .thenReturn(Optional.of(existing));
            MessageTemplate tpl = new MessageTemplate();
            tpl.setId(7L);
            tpl.setName("Tpl");
            when(templateRepository.findByIdAndOrganizationId(7L, ORG_ID))
                .thenReturn(Optional.of(tpl));

            CreateAutomationRuleRequest request = new CreateAutomationRuleRequest(
                "Updated", AutomationTrigger.RESERVATION_CONFIRMED, 0, null,
                null, null, 7L, null);

            when(ruleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            ResponseEntity<AutomationRuleDto> response = controller.update(10L, request);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().templateId()).isEqualTo(7L);
        }

        @Test
        void updateWithNullOptionals_preservesExisting() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            AutomationRule existing = buildRule(10L, "Old", true);
            existing.setTriggerTime("23:00");
            existing.setActionType(AutomationAction.SEND_CHECKIN_LINK);
            existing.setDeliveryChannel(MessageChannelType.WHATSAPP);
            when(ruleRepository.findByIdAndOrganizationId(10L, ORG_ID))
                .thenReturn(Optional.of(existing));

            CreateAutomationRuleRequest request = new CreateAutomationRuleRequest(
                "Updated", AutomationTrigger.RESERVATION_CONFIRMED, 0, null,
                null, null, null, null);

            when(ruleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            ResponseEntity<AutomationRuleDto> response = controller.update(10L, request);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            // Triggertime preserved
            assertThat(response.getBody().triggerTime()).isEqualTo("23:00");
            assertThat(response.getBody().actionType()).isEqualTo(AutomationAction.SEND_CHECKIN_LINK);
            assertThat(response.getBody().deliveryChannel()).isEqualTo(MessageChannelType.WHATSAPP);
        }
    }

    @Nested
    @DisplayName("delete")
    class Delete {
        @Test
        void whenFound_deletes() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            AutomationRule existing = buildRule(5L, "Doomed", true);
            when(ruleRepository.findByIdAndOrganizationId(5L, ORG_ID))
                .thenReturn(Optional.of(existing));

            ResponseEntity<Void> response = controller.delete(5L);

            assertThat(response.getStatusCode().value()).isEqualTo(204);
            verify(ruleRepository).delete(existing);
        }

        @Test
        void whenNotFound_throws() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(ruleRepository.findByIdAndOrganizationId(99L, ORG_ID))
                .thenReturn(Optional.empty());

            assertThatThrownBy(() -> controller.delete(99L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Rule introuvable");
        }
    }

    @Nested
    @DisplayName("toggle")
    class Toggle {
        @Test
        void enabledToDisabled() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            AutomationRule existing = buildRule(3L, "Toggle me", true);
            when(ruleRepository.findByIdAndOrganizationId(3L, ORG_ID))
                .thenReturn(Optional.of(existing));
            when(ruleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            ResponseEntity<AutomationRuleDto> response = controller.toggle(3L);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().enabled()).isFalse();
        }

        @Test
        void disabledToEnabled() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            AutomationRule existing = buildRule(3L, "Toggle me", false);
            when(ruleRepository.findByIdAndOrganizationId(3L, ORG_ID))
                .thenReturn(Optional.of(existing));
            when(ruleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            ResponseEntity<AutomationRuleDto> response = controller.toggle(3L);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().enabled()).isTrue();
        }

        @Test
        void notFound_throws() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(ruleRepository.findByIdAndOrganizationId(99L, ORG_ID))
                .thenReturn(Optional.empty());

            assertThatThrownBy(() -> controller.toggle(99L))
                .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Nested
    @DisplayName("getExecutions")
    class GetExecutions {
        @Test
        void returnsPagedExecutions() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            AutomationRule r = buildRule(1L, "Rule", true);
            Reservation res = new Reservation();
            res.setId(42L);
            AutomationExecution exec = new AutomationExecution();
            exec.setId(1L);
            exec.setOrganizationId(ORG_ID);
            exec.setAutomationRule(r);
            exec.setReservation(res);
            exec.setStatus(AutomationExecutionStatus.EXECUTED);
            exec.setScheduledAt(LocalDateTime.now());
            Page<AutomationExecution> page = new PageImpl<>(List.of(exec));
            when(executionRepository
                .findByAutomationRuleIdAndOrganizationIdOrderByCreatedAtDesc(
                    eq(1L), eq(ORG_ID), any(PageRequest.class)))
                .thenReturn(page);

            ResponseEntity<Page<AutomationExecutionDto>> response = controller.getExecutions(1L, 0, 20);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().getContent()).hasSize(1);
            assertThat(response.getBody().getContent().get(0).reservationId()).isEqualTo(42L);
        }

        @Test
        void emptyPage_returnsOk() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(executionRepository
                .findByAutomationRuleIdAndOrganizationIdOrderByCreatedAtDesc(
                    eq(1L), eq(ORG_ID), any(PageRequest.class)))
                .thenReturn(Page.empty());

            ResponseEntity<Page<AutomationExecutionDto>> response = controller.getExecutions(1L, 0, 20);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().getContent()).isEmpty();
        }
    }
}
