package com.clenzy.dto;

import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.MessageChannelType;
import com.clenzy.model.MessageTemplate;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class AutomationRuleDtoTest {

    @Test
    void recordAccessors_returnAllConstructorValues() {
        LocalDateTime createdAt = LocalDateTime.of(2026, 1, 1, 12, 0);
        AutomationRuleDto dto = new AutomationRuleDto(
                1L,
                "Pre check-in reminder",
                true,
                10,
                AutomationTrigger.CHECK_IN_APPROACHING,
                -1,
                "09:00",
                "{\"channel\":[\"AIRBNB\"]}",
                AutomationAction.SEND_MESSAGE,
                100L,
                "tpl-pre-checkin",
                MessageChannelType.EMAIL,
                createdAt
        );

        assertEquals(1L, dto.id());
        assertEquals("Pre check-in reminder", dto.name());
        assertTrue(dto.enabled());
        assertEquals(10, dto.sortOrder());
        assertEquals(AutomationTrigger.CHECK_IN_APPROACHING, dto.triggerType());
        assertEquals(-1, dto.triggerOffsetDays());
        assertEquals("09:00", dto.triggerTime());
        assertEquals("{\"channel\":[\"AIRBNB\"]}", dto.conditions());
        assertEquals(AutomationAction.SEND_MESSAGE, dto.actionType());
        assertEquals(100L, dto.templateId());
        assertEquals("tpl-pre-checkin", dto.templateName());
        assertEquals(MessageChannelType.EMAIL, dto.deliveryChannel());
        assertEquals(createdAt, dto.createdAt());
    }

    @Test
    void from_withTemplate_mapsTemplateIdAndName() {
        MessageTemplate template = new MessageTemplate();
        template.setId(50L);
        template.setName("template-name");

        AutomationRule rule = new AutomationRule();
        rule.setId(7L);
        rule.setName("Rule A");
        rule.setEnabled(false);
        rule.setSortOrder(3);
        rule.setTriggerType(AutomationTrigger.RESERVATION_CONFIRMED);
        rule.setTriggerOffsetDays(0);
        rule.setTriggerTime("10:30");
        rule.setConditions(null);
        rule.setActionType(AutomationAction.SEND_GUIDE);
        rule.setTemplate(template);
        rule.setDeliveryChannel(MessageChannelType.WHATSAPP);

        AutomationRuleDto dto = AutomationRuleDto.from(rule);

        assertEquals(7L, dto.id());
        assertEquals("Rule A", dto.name());
        assertFalse(dto.enabled());
        assertEquals(3, dto.sortOrder());
        assertEquals(AutomationTrigger.RESERVATION_CONFIRMED, dto.triggerType());
        assertEquals(0, dto.triggerOffsetDays());
        assertEquals("10:30", dto.triggerTime());
        assertNull(dto.conditions());
        assertEquals(AutomationAction.SEND_GUIDE, dto.actionType());
        assertEquals(50L, dto.templateId());
        assertEquals("template-name", dto.templateName());
        assertEquals(MessageChannelType.WHATSAPP, dto.deliveryChannel());
    }

    @Test
    void from_withoutTemplate_returnsNullTemplateFields() {
        AutomationRule rule = new AutomationRule();
        rule.setName("No template");
        rule.setEnabled(true);
        rule.setTriggerType(AutomationTrigger.CHECK_OUT_PASSED);
        rule.setActionType(AutomationAction.SEND_CHECKIN_LINK);
        rule.setTemplate(null);
        rule.setDeliveryChannel(MessageChannelType.SMS);

        AutomationRuleDto dto = AutomationRuleDto.from(rule);

        assertNull(dto.templateId());
        assertNull(dto.templateName());
        assertEquals(MessageChannelType.SMS, dto.deliveryChannel());
        assertEquals(AutomationAction.SEND_CHECKIN_LINK, dto.actionType());
    }
}
