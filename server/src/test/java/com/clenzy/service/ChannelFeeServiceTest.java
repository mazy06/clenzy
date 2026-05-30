package com.clenzy.service;

import com.clenzy.dto.CreateChannelFeeRequest;
import com.clenzy.integration.channel.ChannelCapability;
import com.clenzy.integration.channel.ChannelConnector;
import com.clenzy.integration.channel.ChannelConnectorRegistry;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.SyncResult;
import com.clenzy.model.ChannelFee;
import com.clenzy.model.ChargeType;
import com.clenzy.model.FeeType;
import com.clenzy.repository.ChannelFeeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ChannelFeeServiceTest {

    @Mock private ChannelFeeRepository feeRepository;
    @Mock private ChannelConnectorRegistry connectorRegistry;
    @Mock private ChannelConnector connector;

    @InjectMocks
    private ChannelFeeService service;

    private static final Long ORG_ID = 7L;
    private static final Long PROPERTY_ID = 50L;

    @BeforeEach
    void setUp() {
        when(feeRepository.save(any(ChannelFee.class))).thenAnswer(inv -> {
            ChannelFee f = inv.getArgument(0);
            if (f.getId() == null) f.setId(99L);
            return f;
        });
    }

    private ChannelFee sample() {
        ChannelFee f = new ChannelFee();
        f.setId(1L);
        f.setOrganizationId(ORG_ID);
        f.setPropertyId(PROPERTY_ID);
        f.setChannelName(ChannelName.AIRBNB);
        f.setFeeType(FeeType.CLEANING);
        f.setName("Menage");
        f.setAmount(new BigDecimal("50.00"));
        f.setCurrency("EUR");
        f.setChargeType(ChargeType.PER_STAY);
        f.setEnabled(true);
        return f;
    }

    private CreateChannelFeeRequest fullRequest() {
        return new CreateChannelFeeRequest(
            PROPERTY_ID, ChannelName.AIRBNB, FeeType.CLEANING, "Menage",
            new BigDecimal("60.00"), "USD", ChargeType.PER_NIGHT,
            false, true, Map.of("note", "v2"));
    }

    private CreateChannelFeeRequest minimalRequest() {
        return new CreateChannelFeeRequest(
            PROPERTY_ID, ChannelName.AIRBNB, FeeType.PET, "Pet fee",
            new BigDecimal("10.00"), null, null, null, null, null);
    }

    // ---- getAll / getByProperty ----

    @Test
    void getAll_delegatesToRepository() {
        ChannelFee fee = sample();
        when(feeRepository.findAllByOrgId(ORG_ID)).thenReturn(List.of(fee));

        assertThat(service.getAll(ORG_ID)).hasSize(1).contains(fee);
    }

    @Test
    void getByProperty_delegatesToRepository() {
        ChannelFee fee = sample();
        when(feeRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(List.of(fee));

        assertThat(service.getByProperty(PROPERTY_ID, ORG_ID)).hasSize(1);
    }

    // ---- getById ----

    @Test
    void getById_found_returns() {
        ChannelFee fee = sample();
        when(feeRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(fee));

        assertThat(service.getById(1L, ORG_ID)).isEqualTo(fee);
    }

    @Test
    void getById_notFound_throws() {
        when(feeRepository.findByIdAndOrgId(999L, ORG_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getById(999L, ORG_ID))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Fee not found");
    }

    // ---- create ----

    @Test
    void create_setsFieldsAndAttemptsPush_noConnector() {
        when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.empty());

        ChannelFee result = service.create(fullRequest(), ORG_ID);

        assertThat(result.getOrganizationId()).isEqualTo(ORG_ID);
        assertThat(result.getPropertyId()).isEqualTo(PROPERTY_ID);
        assertThat(result.getChannelName()).isEqualTo(ChannelName.AIRBNB);
        assertThat(result.getFeeType()).isEqualTo(FeeType.CLEANING);
        assertThat(result.getName()).isEqualTo("Menage");
        assertThat(result.getCurrency()).isEqualTo("USD");
        assertThat(result.getChargeType()).isEqualTo(ChargeType.PER_NIGHT);
        assertThat(result.getIsMandatory()).isFalse();
        assertThat(result.getIsTaxable()).isTrue();
        assertThat(result.getSyncStatus()).isEqualTo("PENDING");
    }

    @Test
    void create_minimalRequest_appliesDefaults() {
        when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.empty());

        ChannelFee result = service.create(minimalRequest(), ORG_ID);

        assertThat(result.getCurrency()).isEqualTo("EUR");
        assertThat(result.getChargeType()).isEqualTo(ChargeType.PER_STAY);
        assertThat(result.getIsMandatory()).isTrue();
        assertThat(result.getIsTaxable()).isFalse();
    }

    @Test
    void create_pushesToChannel_success() {
        when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(connector));
        when(connector.supports(ChannelCapability.FEES)).thenReturn(true);

        ChannelFee saved = sample();
        when(feeRepository.findByPropertyIdAndChannelName(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
            .thenReturn(List.of(saved));
        when(connector.pushFees(any(), eq(ORG_ID))).thenReturn(SyncResult.success(1, 100));

        service.create(minimalRequest(), ORG_ID);

        // Saved with SYNCED status
        verify(feeRepository, atLeast(2)).save(any(ChannelFee.class));
    }

    // ---- update ----

    @Test
    void update_appliesFieldsAndSaves() {
        ChannelFee existing = sample();
        when(feeRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(existing));
        when(connectorRegistry.getConnector(any())).thenReturn(Optional.empty());

        ChannelFee result = service.update(1L, ORG_ID, fullRequest());

        assertThat(result.getName()).isEqualTo("Menage");
        assertThat(result.getCurrency()).isEqualTo("USD");
    }

    @Test
    void update_doesNotPush_whenFeeDisabled() {
        ChannelFee existing = sample();
        existing.setEnabled(false);
        when(feeRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(existing));

        service.update(1L, ORG_ID, fullRequest());

        verify(connectorRegistry, never()).getConnector(any());
    }

    @Test
    void update_pushes_whenFeeEnabled() {
        ChannelFee existing = sample();
        existing.setEnabled(true);
        when(feeRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(existing));
        when(connectorRegistry.getConnector(any())).thenReturn(Optional.empty());

        service.update(1L, ORG_ID, fullRequest());

        verify(connectorRegistry).getConnector(any());
    }

    // ---- delete ----

    @Test
    void delete_removesEntity() {
        ChannelFee existing = sample();
        when(feeRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(existing));

        service.delete(1L, ORG_ID);

        verify(feeRepository).delete(existing);
    }

    // ---- pushFeeToChannel ----

    @Test
    void pushFeeToChannel_noConnector_returnsEarly() {
        ChannelFee fee = sample();
        when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.empty());

        service.pushFeeToChannel(fee, ORG_ID);

        verify(feeRepository, never()).findByPropertyIdAndChannelName(any(), any(), any());
    }

    @Test
    void pushFeeToChannel_connectorNoFeesCapability_returnsEarly() {
        ChannelFee fee = sample();
        when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(connector));
        when(connector.supports(ChannelCapability.FEES)).thenReturn(false);

        service.pushFeeToChannel(fee, ORG_ID);

        verify(connector, never()).pushFees(any(), any());
    }

    @Test
    void pushFeeToChannel_success_marksSynced() {
        ChannelFee fee = sample();
        when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(connector));
        when(connector.supports(ChannelCapability.FEES)).thenReturn(true);
        when(feeRepository.findByPropertyIdAndChannelName(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
            .thenReturn(List.of(fee));
        when(connector.pushFees(any(), eq(ORG_ID))).thenReturn(SyncResult.success(1, 100));

        service.pushFeeToChannel(fee, ORG_ID);

        assertThat(fee.getSyncStatus()).isEqualTo("SYNCED");
        assertThat(fee.getSyncedAt()).isNotNull();
    }

    @Test
    void pushFeeToChannel_failed_marksFailed() {
        ChannelFee fee = sample();
        when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(connector));
        when(connector.supports(ChannelCapability.FEES)).thenReturn(true);
        when(feeRepository.findByPropertyIdAndChannelName(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
            .thenReturn(List.of(fee));
        when(connector.pushFees(any(), eq(ORG_ID))).thenReturn(SyncResult.failed("boom"));

        service.pushFeeToChannel(fee, ORG_ID);

        assertThat(fee.getSyncStatus()).isEqualTo("FAILED");
    }

    @Test
    void pushFeeToChannel_throwingConnector_logsAndContinues() {
        ChannelFee fee = sample();
        when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(connector));
        when(connector.supports(ChannelCapability.FEES)).thenReturn(true);
        when(feeRepository.findByPropertyIdAndChannelName(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
            .thenReturn(List.of(fee));
        when(connector.pushFees(any(), eq(ORG_ID))).thenThrow(new RuntimeException("nope"));

        // Should not throw
        service.pushFeeToChannel(fee, ORG_ID);
    }

    @Test
    void pushFeeToChannel_filtersDisabledFees() {
        ChannelFee enabled = sample();
        enabled.setEnabled(true);
        ChannelFee disabled = sample();
        disabled.setId(2L);
        disabled.setEnabled(false);

        when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(connector));
        when(connector.supports(ChannelCapability.FEES)).thenReturn(true);
        when(feeRepository.findByPropertyIdAndChannelName(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
            .thenReturn(List.of(enabled, disabled));
        when(connector.pushFees(any(), eq(ORG_ID))).thenReturn(SyncResult.success(1, 100));

        service.pushFeeToChannel(enabled, ORG_ID);

        // Only enabled gets SYNCED status; disabled is filtered out before push
        assertThat(enabled.getSyncStatus()).isEqualTo("SYNCED");
        assertThat(disabled.getSyncStatus()).isEqualTo("PENDING");
    }
}
