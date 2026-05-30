package com.clenzy.service;

import com.clenzy.dto.CreateChannelCancellationPolicyRequest;
import com.clenzy.integration.channel.ChannelCapability;
import com.clenzy.integration.channel.ChannelConnector;
import com.clenzy.integration.channel.ChannelConnectorRegistry;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.SyncResult;
import com.clenzy.model.CancellationPolicyType;
import com.clenzy.model.ChannelCancellationPolicy;
import com.clenzy.repository.ChannelCancellationPolicyRepository;
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
class ChannelCancellationPolicyServiceTest {

    @Mock private ChannelCancellationPolicyRepository policyRepository;
    @Mock private ChannelConnectorRegistry connectorRegistry;
    @Mock private ChannelConnector connector;

    @InjectMocks
    private ChannelCancellationPolicyService service;

    private static final Long ORG_ID = 9L;
    private static final Long PROPERTY_ID = 250L;

    @BeforeEach
    void setUp() {
        when(policyRepository.save(any(ChannelCancellationPolicy.class))).thenAnswer(inv -> {
            ChannelCancellationPolicy p = inv.getArgument(0);
            if (p.getId() == null) p.setId(42L);
            return p;
        });
    }

    private ChannelCancellationPolicy samplePolicy() {
        ChannelCancellationPolicy p = new ChannelCancellationPolicy();
        p.setId(42L);
        p.setOrganizationId(ORG_ID);
        p.setPropertyId(PROPERTY_ID);
        p.setChannelName(ChannelName.AIRBNB);
        p.setPolicyType(CancellationPolicyType.FLEXIBLE);
        p.setName("Souple");
        p.setEnabled(true);
        return p;
    }

    private CreateChannelCancellationPolicyRequest fullRequest() {
        return new CreateChannelCancellationPolicyRequest(
            PROPERTY_ID, ChannelName.AIRBNB, CancellationPolicyType.STRICT,
            "Stricte", "Description stricte",
            List.of(Map.of("days", 30, "refund", "100%")),
            new BigDecimal("10.00"),
            Map.of("key", "value"));
    }

    private CreateChannelCancellationPolicyRequest minimalRequest() {
        return new CreateChannelCancellationPolicyRequest(
            PROPERTY_ID, ChannelName.AIRBNB, CancellationPolicyType.FLEXIBLE,
            null, null, null, null, null);
    }

    // ----- getAll / getByProperty -----

    @Test
    void getAll_delegatesToRepository() {
        ChannelCancellationPolicy p = samplePolicy();
        when(policyRepository.findAllByOrgId(ORG_ID)).thenReturn(List.of(p));

        assertThat(service.getAll(ORG_ID)).hasSize(1).contains(p);
    }

    @Test
    void getByProperty_delegatesToRepository() {
        ChannelCancellationPolicy p = samplePolicy();
        when(policyRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(List.of(p));

        assertThat(service.getByProperty(PROPERTY_ID, ORG_ID)).hasSize(1);
    }

    // ----- getById -----

    @Test
    void getById_found_returns() {
        ChannelCancellationPolicy p = samplePolicy();
        when(policyRepository.findByIdAndOrgId(42L, ORG_ID)).thenReturn(Optional.of(p));

        assertThat(service.getById(42L, ORG_ID)).isEqualTo(p);
    }

    @Test
    void getById_notFound_throws() {
        when(policyRepository.findByIdAndOrgId(999L, ORG_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getById(999L, ORG_ID))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Cancellation policy not found");
    }

    // ----- create -----

    @Test
    void create_setsAllFieldsAndPushes_noConnector() {
        when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.empty());

        ChannelCancellationPolicy result = service.create(fullRequest(), ORG_ID);

        assertThat(result.getOrganizationId()).isEqualTo(ORG_ID);
        assertThat(result.getPropertyId()).isEqualTo(PROPERTY_ID);
        assertThat(result.getChannelName()).isEqualTo(ChannelName.AIRBNB);
        assertThat(result.getPolicyType()).isEqualTo(CancellationPolicyType.STRICT);
        assertThat(result.getName()).isEqualTo("Stricte");
        assertThat(result.getDescription()).isEqualTo("Description stricte");
        assertThat(result.getCancellationRules()).hasSize(1);
        assertThat(result.getNonRefundableDiscount()).isEqualTo(new BigDecimal("10.00"));
        assertThat(result.getConfig()).containsEntry("key", "value");
        assertThat(result.getSyncStatus()).isEqualTo("PENDING");
    }

    @Test
    void create_minimal_doesNotOverrideNullRulesAndConfig() {
        when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.empty());

        ChannelCancellationPolicy result = service.create(minimalRequest(), ORG_ID);

        // Default JPA-initialized empty list/map preserved when request has null
        assertThat(result.getCancellationRules()).isNotNull();
        assertThat(result.getConfig()).isNotNull();
    }

    @Test
    void create_pushesAndMarksSynced_onSuccess() {
        when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(connector));
        when(connector.supports(ChannelCapability.CANCELLATION_POLICIES)).thenReturn(true);
        when(connector.pushCancellationPolicy(any(), eq(ORG_ID))).thenReturn(SyncResult.success(1, 100));

        ChannelCancellationPolicy result = service.create(fullRequest(), ORG_ID);

        assertThat(result.getSyncStatus()).isEqualTo("SYNCED");
        assertThat(result.getSyncedAt()).isNotNull();
    }

    // ----- update -----

    @Test
    void update_modifiesFields() {
        ChannelCancellationPolicy existing = samplePolicy();
        when(policyRepository.findByIdAndOrgId(42L, ORG_ID)).thenReturn(Optional.of(existing));
        when(connectorRegistry.getConnector(any())).thenReturn(Optional.empty());

        ChannelCancellationPolicy result = service.update(42L, ORG_ID, fullRequest());

        assertThat(result.getPolicyType()).isEqualTo(CancellationPolicyType.STRICT);
        assertThat(result.getName()).isEqualTo("Stricte");
    }

    @Test
    void update_disabledPolicy_doesNotPush() {
        ChannelCancellationPolicy existing = samplePolicy();
        existing.setEnabled(false);
        when(policyRepository.findByIdAndOrgId(42L, ORG_ID)).thenReturn(Optional.of(existing));

        service.update(42L, ORG_ID, fullRequest());

        verify(connectorRegistry, never()).getConnector(any());
    }

    @Test
    void update_enabledPolicy_pushes() {
        ChannelCancellationPolicy existing = samplePolicy();
        existing.setEnabled(true);
        when(policyRepository.findByIdAndOrgId(42L, ORG_ID)).thenReturn(Optional.of(existing));
        when(connectorRegistry.getConnector(any())).thenReturn(Optional.empty());

        service.update(42L, ORG_ID, fullRequest());

        verify(connectorRegistry).getConnector(any());
    }

    // ----- delete -----

    @Test
    void delete_removesEntity() {
        ChannelCancellationPolicy existing = samplePolicy();
        when(policyRepository.findByIdAndOrgId(42L, ORG_ID)).thenReturn(Optional.of(existing));

        service.delete(42L, ORG_ID);

        verify(policyRepository).delete(existing);
    }

    // ----- pushPolicyToChannel -----

    @Test
    void pushPolicyToChannel_noConnector_returnsEarly() {
        when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.empty());

        service.pushPolicyToChannel(samplePolicy(), ORG_ID);

        verify(connector, never()).pushCancellationPolicy(any(), any());
    }

    @Test
    void pushPolicyToChannel_noCapability_returnsEarly() {
        when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(connector));
        when(connector.supports(ChannelCapability.CANCELLATION_POLICIES)).thenReturn(false);

        service.pushPolicyToChannel(samplePolicy(), ORG_ID);

        verify(connector, never()).pushCancellationPolicy(any(), any());
    }

    @Test
    void pushPolicyToChannel_success_marksSynced() {
        ChannelCancellationPolicy p = samplePolicy();
        when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(connector));
        when(connector.supports(ChannelCapability.CANCELLATION_POLICIES)).thenReturn(true);
        when(connector.pushCancellationPolicy(p, ORG_ID)).thenReturn(SyncResult.success(1, 100));

        service.pushPolicyToChannel(p, ORG_ID);

        assertThat(p.getSyncStatus()).isEqualTo("SYNCED");
        assertThat(p.getSyncedAt()).isNotNull();
    }

    @Test
    void pushPolicyToChannel_failed_marksFailed() {
        ChannelCancellationPolicy p = samplePolicy();
        when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(connector));
        when(connector.supports(ChannelCapability.CANCELLATION_POLICIES)).thenReturn(true);
        when(connector.pushCancellationPolicy(p, ORG_ID)).thenReturn(SyncResult.failed("nope"));

        service.pushPolicyToChannel(p, ORG_ID);

        assertThat(p.getSyncStatus()).isEqualTo("FAILED");
    }

    @Test
    void pushPolicyToChannel_exception_doesNotPropagate() {
        ChannelCancellationPolicy p = samplePolicy();
        when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(connector));
        when(connector.supports(ChannelCapability.CANCELLATION_POLICIES)).thenReturn(true);
        when(connector.pushCancellationPolicy(p, ORG_ID)).thenThrow(new RuntimeException("network down"));

        // Should not throw
        service.pushPolicyToChannel(p, ORG_ID);
    }

    @Test
    void pushPolicyToChannel_unsupportedStatus_doesNotChangeStatus() {
        ChannelCancellationPolicy p = samplePolicy();
        p.setSyncStatus("PENDING");
        when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(connector));
        when(connector.supports(ChannelCapability.CANCELLATION_POLICIES)).thenReturn(true);
        when(connector.pushCancellationPolicy(p, ORG_ID)).thenReturn(SyncResult.unsupported("not available"));

        service.pushPolicyToChannel(p, ORG_ID);

        // Neither SUCCESS nor FAILED → keeps original status
        assertThat(p.getSyncStatus()).isEqualTo("PENDING");
    }
}
