package com.clenzy.service;

import com.clenzy.dto.MaintenanceRequestDto;
import com.clenzy.dto.QuoteRequestDto;
import com.clenzy.dto.ReceivedFormDto;
import com.clenzy.model.ReceivedForm;
import com.clenzy.repository.ReceivedFormRepository;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.hibernate.Session;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReceivedFormServiceTest {

    @Mock private ReceivedFormRepository receivedFormRepository;
    @Mock private ObjectMapper objectMapper;
    @Mock private EntityManager entityManager;
    @Mock private Session hibernateSession;
    @Mock private TenantContext tenantContext;

    private ReceivedFormService service;

    @BeforeEach
    void setUp() {
        // Stub la chaine entityManager.unwrap(Session.class) → session.disableFilter(...)
        // utilisee par disableTenantFilter(). Lenient car les methodes d'enregistrement
        // public et les tests AccessDenied ne passent pas par ce code.
        lenient().when(entityManager.unwrap(Session.class)).thenReturn(hibernateSession);
        service = new ReceivedFormService(receivedFormRepository, objectMapper, entityManager, tenantContext);
    }

    private void stubPlatformStaff() {
        when(tenantContext.isSuperAdmin()).thenReturn(true);
    }

    private void stubSaveReturningId(long id) {
        when(receivedFormRepository.save(any(ReceivedForm.class))).thenAnswer(inv -> {
            ReceivedForm form = inv.getArgument(0);
            form.setId(id);
            return form;
        });
    }

    // ─── Enregistrement (endpoints publics) ─────────────────────────────────

    @Nested
    @DisplayName("recordQuoteForm")
    class RecordQuoteForm {

        private QuoteRequestDto quoteDto() {
            QuoteRequestDto dto = mock(QuoteRequestDto.class);
            when(dto.getFullName()).thenReturn("Jean Dupont");
            when(dto.getEmail()).thenReturn("jean@test.com");
            when(dto.getPhone()).thenReturn("0600000000");
            when(dto.getCity()).thenReturn("Paris");
            when(dto.getPostalCode()).thenReturn("75001");
            return dto;
        }

        @Test
        void whenValidDto_thenSavesDevisFormAndReturnsId() throws Exception {
            QuoteRequestDto dto = quoteDto();
            when(objectMapper.writeValueAsString(dto)).thenReturn("{\"fullName\":\"Jean Dupont\"}");
            stubSaveReturningId(42L);

            Long id = service.recordQuoteForm(dto, "10.0.0.1");

            assertThat(id).isEqualTo(42L);
            ArgumentCaptor<ReceivedForm> captor = ArgumentCaptor.forClass(ReceivedForm.class);
            verify(receivedFormRepository).save(captor.capture());
            ReceivedForm form = captor.getValue();
            assertThat(form.getFormType()).isEqualTo("DEVIS");
            assertThat(form.getFullName()).isEqualTo("Jean Dupont");
            assertThat(form.getEmail()).isEqualTo("jean@test.com");
            assertThat(form.getSubject()).isEqualTo("Demande de devis — Jean Dupont — Paris");
            assertThat(form.getPayload()).isEqualTo("{\"fullName\":\"Jean Dupont\"}");
            assertThat(form.getIpAddress()).isEqualTo("10.0.0.1");
        }

        @Test
        void whenPayloadSerializationFails_thenThrowsIllegalState() throws Exception {
            QuoteRequestDto dto = quoteDto();
            when(objectMapper.writeValueAsString(dto))
                    .thenThrow(new JsonProcessingException("boom") {});

            assertThatThrownBy(() -> service.recordQuoteForm(dto, "10.0.0.1"))
                    .isInstanceOf(IllegalStateException.class);
            verify(receivedFormRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("recordMaintenanceForm")
    class RecordMaintenanceForm {

        @Test
        void whenCityPresent_thenSubjectIncludesCity() throws Exception {
            MaintenanceRequestDto dto = mock(MaintenanceRequestDto.class);
            when(dto.getFullName()).thenReturn("Jean");
            when(dto.getCity()).thenReturn("Lyon");
            when(objectMapper.writeValueAsString(dto)).thenReturn("{}");
            stubSaveReturningId(7L);

            Long id = service.recordMaintenanceForm(dto, "127.0.0.1");

            assertThat(id).isEqualTo(7L);
            ArgumentCaptor<ReceivedForm> captor = ArgumentCaptor.forClass(ReceivedForm.class);
            verify(receivedFormRepository).save(captor.capture());
            assertThat(captor.getValue().getFormType()).isEqualTo("MAINTENANCE");
            assertThat(captor.getValue().getSubject()).isEqualTo("Maintenance — Jean — Lyon");
        }

        @Test
        void whenCityNull_thenSubjectOmitsCity() throws Exception {
            MaintenanceRequestDto dto = mock(MaintenanceRequestDto.class);
            when(dto.getFullName()).thenReturn("Jean");
            when(dto.getCity()).thenReturn(null);
            when(objectMapper.writeValueAsString(dto)).thenReturn("{}");
            stubSaveReturningId(8L);

            service.recordMaintenanceForm(dto, "127.0.0.1");

            ArgumentCaptor<ReceivedForm> captor = ArgumentCaptor.forClass(ReceivedForm.class);
            verify(receivedFormRepository).save(captor.capture());
            assertThat(captor.getValue().getSubject()).isEqualTo("Maintenance — Jean");
        }
    }

    @Nested
    @DisplayName("recordSupportForm")
    class RecordSupportForm {

        @Test
        void whenValid_thenSavesSupportFormWithLabelInSubject() throws Exception {
            Map<String, String> body = Map.of("name", "Jean", "email", "jean@test.com");
            when(objectMapper.writeValueAsString(body)).thenReturn("{}");
            stubSaveReturningId(9L);

            Long id = service.recordSupportForm("Jean", "jean@test.com", "0600000000",
                    "Probleme technique", body, "127.0.0.1");

            assertThat(id).isEqualTo(9L);
            ArgumentCaptor<ReceivedForm> captor = ArgumentCaptor.forClass(ReceivedForm.class);
            verify(receivedFormRepository).save(captor.capture());
            ReceivedForm form = captor.getValue();
            assertThat(form.getFormType()).isEqualTo("SUPPORT");
            assertThat(form.getSubject()).isEqualTo("Support — Probleme technique — Jean");
            assertThat(form.getPhone()).isEqualTo("0600000000");
        }

        @Test
        void whenPhoneEmpty_thenStoredAsNull() throws Exception {
            Map<String, String> body = Map.of();
            when(objectMapper.writeValueAsString(body)).thenReturn("{}");
            stubSaveReturningId(10L);

            service.recordSupportForm("Jean", "jean@test.com", "", "Autre", body, "127.0.0.1");

            ArgumentCaptor<ReceivedForm> captor = ArgumentCaptor.forClass(ReceivedForm.class);
            verify(receivedFormRepository).save(captor.capture());
            assertThat(captor.getValue().getPhone()).isNull();
        }
    }

    // ─── Administration (staff plateforme) ──────────────────────────────────

    @Nested
    @DisplayName("listForms")
    class ListForms {

        @Test
        void whenNoFilters_thenExcludesArchived() {
            stubPlatformStaff();
            when(receivedFormRepository.findByStatusNotOrderByCreatedAtDesc(eq("ARCHIVED"), any(PageRequest.class)))
                    .thenReturn(new PageImpl<>(List.of(new ReceivedForm())));

            Page<ReceivedFormDto> result = service.listForms(0, 20, null, null);

            assertThat(result.getContent()).hasSize(1);
            verify(hibernateSession).disableFilter("organizationFilter");
        }

        @Test
        void whenTypeGiven_thenFiltersByUppercasedType() {
            stubPlatformStaff();
            when(receivedFormRepository.findByFormTypeAndStatusNotOrderByCreatedAtDesc(
                    eq("DEVIS"), eq("ARCHIVED"), any(PageRequest.class)))
                    .thenReturn(new PageImpl<>(List.of()));

            service.listForms(0, 20, "devis", null);

            verify(receivedFormRepository).findByFormTypeAndStatusNotOrderByCreatedAtDesc(
                    eq("DEVIS"), eq("ARCHIVED"), any(PageRequest.class));
        }

        @Test
        void whenStatusArchived_thenReturnsArchivedOnly() {
            stubPlatformStaff();
            when(receivedFormRepository.findByStatusOrderByCreatedAtDesc(eq("ARCHIVED"), any(PageRequest.class)))
                    .thenReturn(new PageImpl<>(List.of()));

            service.listForms(0, 20, null, "ARCHIVED");

            verify(receivedFormRepository).findByStatusOrderByCreatedAtDesc(eq("ARCHIVED"), any(PageRequest.class));
        }

        @Test
        void whenStatusArchivedWithType_thenCombinesFilters() {
            stubPlatformStaff();
            when(receivedFormRepository.findByFormTypeAndStatusOrderByCreatedAtDesc(
                    eq("SUPPORT"), eq("ARCHIVED"), any(PageRequest.class)))
                    .thenReturn(new PageImpl<>(List.of()));

            service.listForms(0, 20, "support", "archived");

            verify(receivedFormRepository).findByFormTypeAndStatusOrderByCreatedAtDesc(
                    eq("SUPPORT"), eq("ARCHIVED"), any(PageRequest.class));
        }

        @Test
        void whenNotPlatformStaff_thenAccessDenied() {
            when(tenantContext.isSuperAdmin()).thenReturn(false);

            assertThatThrownBy(() -> service.listForms(0, 20, null, null))
                    .isInstanceOf(AccessDeniedException.class);
            verifyNoInteractions(receivedFormRepository);
        }
    }

    @Nested
    @DisplayName("getForm")
    class GetForm {

        @Test
        void whenFound_thenReturnsDto() {
            stubPlatformStaff();
            ReceivedForm form = new ReceivedForm();
            form.setId(1L);
            form.setFormType("DEVIS");
            when(receivedFormRepository.findById(1L)).thenReturn(Optional.of(form));

            Optional<ReceivedFormDto> result = service.getForm(1L);

            assertThat(result).isPresent();
            assertThat(result.get().id()).isEqualTo(1L);
            assertThat(result.get().formType()).isEqualTo("DEVIS");
        }

        @Test
        void whenNotFound_thenEmpty() {
            stubPlatformStaff();
            when(receivedFormRepository.findById(1L)).thenReturn(Optional.empty());

            assertThat(service.getForm(1L)).isEmpty();
        }

        @Test
        void whenNotPlatformStaff_thenAccessDenied() {
            when(tenantContext.isSuperAdmin()).thenReturn(false);

            assertThatThrownBy(() -> service.getForm(1L))
                    .isInstanceOf(AccessDeniedException.class);
            verifyNoInteractions(receivedFormRepository);
        }
    }

    @Nested
    @DisplayName("updateStatus")
    class UpdateStatus {

        @Test
        void whenStatusRead_thenSetsReadAtOnce() {
            stubPlatformStaff();
            ReceivedForm form = new ReceivedForm();
            when(receivedFormRepository.findById(1L)).thenReturn(Optional.of(form));
            when(receivedFormRepository.save(form)).thenReturn(form);

            Optional<ReceivedFormDto> result = service.updateStatus(1L, "READ");

            assertThat(result).isPresent();
            assertThat(form.getStatus()).isEqualTo("READ");
            assertThat(form.getReadAt()).isNotNull();
        }

        @Test
        void whenReadAtAlreadySet_thenPreservesIt() {
            stubPlatformStaff();
            ReceivedForm form = new ReceivedForm();
            LocalDateTime firstRead = LocalDateTime.of(2026, 1, 1, 10, 0);
            form.setReadAt(firstRead);
            when(receivedFormRepository.findById(1L)).thenReturn(Optional.of(form));
            when(receivedFormRepository.save(form)).thenReturn(form);

            service.updateStatus(1L, "READ");

            assertThat(form.getReadAt()).isEqualTo(firstRead);
        }

        @Test
        void whenStatusProcessed_thenSetsProcessedAt() {
            stubPlatformStaff();
            ReceivedForm form = new ReceivedForm();
            when(receivedFormRepository.findById(1L)).thenReturn(Optional.of(form));
            when(receivedFormRepository.save(form)).thenReturn(form);

            service.updateStatus(1L, "PROCESSED");

            assertThat(form.getStatus()).isEqualTo("PROCESSED");
            assertThat(form.getProcessedAt()).isNotNull();
        }

        @Test
        void whenFormNotFound_thenEmpty() {
            stubPlatformStaff();
            when(receivedFormRepository.findById(1L)).thenReturn(Optional.empty());

            assertThat(service.updateStatus(1L, "READ")).isEmpty();
        }

        @Test
        void whenNotPlatformStaff_thenAccessDenied() {
            when(tenantContext.isSuperAdmin()).thenReturn(false);

            assertThatThrownBy(() -> service.updateStatus(1L, "READ"))
                    .isInstanceOf(AccessDeniedException.class);
            verifyNoInteractions(receivedFormRepository);
        }
    }

    @Nested
    @DisplayName("getStats")
    class GetStats {

        @Test
        void whenPlatformStaff_thenReturnsCounters() {
            stubPlatformStaff();
            when(receivedFormRepository.countByStatus("NEW")).thenReturn(3L);
            when(receivedFormRepository.countByStatus("READ")).thenReturn(2L);
            when(receivedFormRepository.countByStatus("PROCESSED")).thenReturn(5L);
            when(receivedFormRepository.countByStatus("ARCHIVED")).thenReturn(1L);
            when(receivedFormRepository.countByFormType("DEVIS")).thenReturn(4L);
            when(receivedFormRepository.countByFormType("MAINTENANCE")).thenReturn(3L);
            when(receivedFormRepository.countByFormType("SUPPORT")).thenReturn(2L);

            ReceivedFormService.ReceivedFormStats stats = service.getStats();

            assertThat(stats.totalNew()).isEqualTo(3L);
            assertThat(stats.totalRead()).isEqualTo(2L);
            assertThat(stats.totalProcessed()).isEqualTo(5L);
            assertThat(stats.totalArchived()).isEqualTo(1L);
            assertThat(stats.devisCount()).isEqualTo(4L);
            assertThat(stats.maintenanceCount()).isEqualTo(3L);
            assertThat(stats.supportCount()).isEqualTo(2L);
        }

        @Test
        void whenNotPlatformStaff_thenAccessDenied() {
            when(tenantContext.isSuperAdmin()).thenReturn(false);

            assertThatThrownBy(() -> service.getStats())
                    .isInstanceOf(AccessDeniedException.class);
            verifyNoInteractions(receivedFormRepository);
        }
    }
}
