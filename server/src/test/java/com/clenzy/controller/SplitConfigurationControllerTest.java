package com.clenzy.controller;

import com.clenzy.dto.SplitConfigurationDto;
import com.clenzy.dto.SplitRatios;
import com.clenzy.model.SplitConfiguration;
import com.clenzy.repository.SplitConfigurationRepository;
import com.clenzy.service.SplitConfigurationService;
import com.clenzy.service.SplitPaymentService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SplitConfigurationControllerTest {

    @Mock private SplitConfigurationRepository repository;
    @Mock private SplitPaymentService splitPaymentService;
    @Mock private TenantContext tenantContext;

    private SplitConfigurationController controller;

    @BeforeEach
    void setUp() {
        // Service reel branche sur les mocks : les assertions existantes sur le
        // repository restent valables a travers la couche service.
        SplitConfigurationService splitConfigurationService =
                new SplitConfigurationService(repository, tenantContext);
        controller = new SplitConfigurationController(
                splitConfigurationService, splitPaymentService, tenantContext);
    }

    private SplitConfiguration sc(Long id, BigDecimal o, BigDecimal p, BigDecimal c) {
        SplitConfiguration s = new SplitConfiguration();
        s.setId(id);
        s.setOrganizationId(1L);
        s.setOwnerShare(o);
        s.setPlatformShare(p);
        s.setConciergeShare(c);
        s.setIsDefault(false);
        return s;
    }

    private SplitConfigurationDto dto(Long id, BigDecimal o, BigDecimal p, BigDecimal c) {
        return new SplitConfigurationDto(id, 1L, null, o, p, c, false, null, null, null);
    }

    @Test
    void list_returnsConfigs() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(repository.findByOrganizationId(1L)).thenReturn(List.of(
                sc(1L, new BigDecimal("0.8000"), new BigDecimal("0.0500"), new BigDecimal("0.1500"))));

        ResponseEntity<List<SplitConfigurationDto>> response = controller.listConfigs();
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).hasSize(1);
    }

    @Test
    void currentRatios_returnsRatios() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(splitPaymentService.resolveSplitRatios(1L)).thenReturn(SplitRatios.DEFAULT);

        ResponseEntity<SplitRatios> response = controller.getCurrentRatios();
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isEqualTo(SplitRatios.DEFAULT);
    }

    @Test
    void create_validShares_saves() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        SplitConfigurationDto request = dto(null, new BigDecimal("0.8000"), new BigDecimal("0.0500"), new BigDecimal("0.1500"));
        when(repository.save(any(SplitConfiguration.class))).thenAnswer(inv -> inv.getArgument(0));

        ResponseEntity<SplitConfigurationDto> response = controller.createConfig(request);
        assertThat(response.getStatusCode().value()).isEqualTo(200);

        ArgumentCaptor<SplitConfiguration> captor = ArgumentCaptor.forClass(SplitConfiguration.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getOrganizationId()).isEqualTo(1L);
        assertThat(captor.getValue().getId()).isNull();
    }

    @Test
    void create_invalidShareSum_throws() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        SplitConfigurationDto request = dto(null, new BigDecimal("0.6000"), new BigDecimal("0.0500"), new BigDecimal("0.1500"));

        assertThatThrownBy(() -> controller.createConfig(request))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Shares must sum to 1.0000");
    }

    @Test
    void create_missingShares_throws() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        SplitConfigurationDto request = dto(null, null, null, null);

        assertThatThrownBy(() -> controller.createConfig(request))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("required");
    }

    @Test
    void update_validShares_saves() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        SplitConfiguration existing = sc(5L, new BigDecimal("0.8000"), new BigDecimal("0.0500"), new BigDecimal("0.1500"));
        SplitConfigurationDto update = new SplitConfigurationDto(
                5L, 1L, "Updated",
                new BigDecimal("0.7000"), new BigDecimal("0.1000"), new BigDecimal("0.2000"),
                false, null, null, null);

        when(repository.findById(5L)).thenReturn(Optional.of(existing));
        when(repository.save(any(SplitConfiguration.class))).thenReturn(existing);

        ResponseEntity<SplitConfigurationDto> response = controller.updateConfig(5L, update);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(existing.getName()).isEqualTo("Updated");
        assertThat(existing.getOwnerShare()).isEqualByComparingTo("0.7000");
    }

    @Test
    void update_notFound_throws() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(repository.findById(99L)).thenReturn(Optional.empty());

        SplitConfigurationDto update = dto(99L, new BigDecimal("0.7"), new BigDecimal("0.1"), new BigDecimal("0.2"));
        assertThatThrownBy(() -> controller.updateConfig(99L, update))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("not found");
    }

    @Test
    void update_wrongOrg_accessDenied() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        SplitConfiguration existing = sc(5L, new BigDecimal("0.8"), new BigDecimal("0.05"), new BigDecimal("0.15"));
        existing.setOrganizationId(999L);
        when(repository.findById(5L)).thenReturn(Optional.of(existing));

        SplitConfigurationDto update = dto(5L, new BigDecimal("0.8"), new BigDecimal("0.05"), new BigDecimal("0.15"));
        assertThatThrownBy(() -> controller.updateConfig(5L, update))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Access denied");
    }

    @Test
    void delete_success_noContent() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        SplitConfiguration existing = sc(5L, new BigDecimal("0.8"), new BigDecimal("0.05"), new BigDecimal("0.15"));
        existing.setIsDefault(false);
        when(repository.findById(5L)).thenReturn(Optional.of(existing));

        ResponseEntity<Void> response = controller.deleteConfig(5L);
        assertThat(response.getStatusCode().value()).isEqualTo(204);
        verify(repository).delete(existing);
    }

    @Test
    void delete_notFound_throws() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(repository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> controller.deleteConfig(99L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("not found");
    }

    @Test
    void delete_wrongOrg_denied() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        SplitConfiguration existing = sc(5L, new BigDecimal("0.8"), new BigDecimal("0.05"), new BigDecimal("0.15"));
        existing.setOrganizationId(999L);
        when(repository.findById(5L)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> controller.deleteConfig(5L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Access denied");
    }

    @Test
    void delete_isDefault_throws() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        SplitConfiguration existing = sc(5L, new BigDecimal("0.8"), new BigDecimal("0.05"), new BigDecimal("0.15"));
        existing.setIsDefault(true);
        when(repository.findById(5L)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> controller.deleteConfig(5L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("default");
    }
}
