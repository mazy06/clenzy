package com.clenzy.controller;

import com.clenzy.dto.MessageTemplateDto;
import com.clenzy.model.MessageTemplate;
import com.clenzy.model.MessageTemplateType;
import com.clenzy.repository.MessageTemplateRepository;
import com.clenzy.service.messaging.TemplateInterpolationService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MessageTemplateControllerTest {

    @Mock private MessageTemplateRepository templateRepository;

    private TenantContext tenantContext;
    private MessageTemplateController controller;

    private MessageTemplate template;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(1L);
        controller = new MessageTemplateController(templateRepository, tenantContext);

        template = new MessageTemplate();
        template.setId(10L);
        template.setOrganizationId(1L);
        template.setName("Check-In Template");
        template.setType(MessageTemplateType.CHECK_IN);
        template.setSubject("Bienvenue {guestName}");
        template.setBody("Bonjour {guestFirstName}");
        template.setLanguage("fr");
        template.setActive(true);
    }

    @Test
    void whenGetAll_thenReturnsMappedList() {
        when(templateRepository.findByOrganizationIdOrderByNameAsc(1L))
            .thenReturn(List.of(template));

        List<MessageTemplateDto> result = controller.getAll();

        assertEquals(1, result.size());
        assertEquals("Check-In Template", result.get(0).name());
        assertEquals("CHECK_IN", result.get(0).type());
    }

    @Test
    void whenGetById_existing_thenReturnsOk() {
        when(templateRepository.findByIdAndOrganizationId(10L, 1L))
            .thenReturn(Optional.of(template));

        var response = controller.getById(10L);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("Check-In Template", response.getBody().name());
    }

    @Test
    void whenGetById_notFound_thenReturns404() {
        when(templateRepository.findByIdAndOrganizationId(999L, 1L))
            .thenReturn(Optional.empty());

        var response = controller.getById(999L);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
    }

    @Test
    void whenCreate_thenSavesAndReturns() {
        when(templateRepository.save(any())).thenAnswer(inv -> {
            MessageTemplate saved = inv.getArgument(0);
            saved.setId(20L);
            return saved;
        });

        var dto = new MessageTemplateDto(
            null, "New Template", "CHECK_OUT", "Depart", "Au revoir", "fr", true, null, null);

        var response = controller.create(dto);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("New Template", response.getBody().name());
        assertEquals("CHECK_OUT", response.getBody().type());
        verify(templateRepository).save(any(MessageTemplate.class));
    }

    @Test
    void whenCreate_withNullLanguage_thenDefaultsToFr() {
        when(templateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var dto = new MessageTemplateDto(
            null, "Test", "CUSTOM", "Subject", "Body", null, true, null, null);

        controller.create(dto);

        verify(templateRepository).save(argThat(t -> "fr".equals(t.getLanguage())));
    }

    @Test
    void whenUpdate_existing_thenUpdatesFields() {
        when(templateRepository.findByIdAndOrganizationId(10L, 1L))
            .thenReturn(Optional.of(template));
        when(templateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var dto = new MessageTemplateDto(
            10L, "Updated Name", null, "New Subject", null, "en", true, null, null);

        var response = controller.update(10L, dto);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("Updated Name", response.getBody().name());
        assertEquals("New Subject", response.getBody().subject());
        assertEquals("en", response.getBody().language());
        // type not updated (null in dto)
        assertEquals("CHECK_IN", response.getBody().type());
    }

    @Test
    void whenUpdate_notFound_thenReturns404() {
        when(templateRepository.findByIdAndOrganizationId(999L, 1L))
            .thenReturn(Optional.empty());

        var dto = new MessageTemplateDto(
            999L, "X", "CUSTOM", "X", "X", "fr", true, null, null);

        var response = controller.update(999L, dto);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
    }

    @Test
    void whenDelete_existing_thenSetsInactiveAndReturns204() {
        when(templateRepository.findByIdAndOrganizationId(10L, 1L))
            .thenReturn(Optional.of(template));
        when(templateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var response = controller.delete(10L);

        assertEquals(HttpStatus.NO_CONTENT, response.getStatusCode());
        assertFalse(template.isActive());
        verify(templateRepository).save(template);
    }

    @Test
    void whenDelete_notFound_thenReturns404() {
        when(templateRepository.findByIdAndOrganizationId(999L, 1L))
            .thenReturn(Optional.empty());

        var response = controller.delete(999L);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
    }

    @Test
    void whenGetVariables_thenReturnsSupportedVariables() {
        var result = controller.getVariables();

        assertNotNull(result);
        assertFalse(result.isEmpty());
        assertTrue(result.stream().anyMatch(v -> "guestName".equals(v.key())));
    }
}
