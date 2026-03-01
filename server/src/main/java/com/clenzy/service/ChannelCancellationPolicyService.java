package com.clenzy.service;

import com.clenzy.dto.CreateChannelCancellationPolicyRequest;
import com.clenzy.integration.channel.ChannelCapability;
import com.clenzy.integration.channel.ChannelConnector;
import com.clenzy.integration.channel.ChannelConnectorRegistry;
import com.clenzy.integration.channel.SyncResult;
import com.clenzy.model.ChannelCancellationPolicy;
import com.clenzy.repository.ChannelCancellationPolicyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class ChannelCancellationPolicyService {

    private static final Logger log = LoggerFactory.getLogger(ChannelCancellationPolicyService.class);

    private final ChannelCancellationPolicyRepository policyRepository;
    private final ChannelConnectorRegistry connectorRegistry;

    public ChannelCancellationPolicyService(ChannelCancellationPolicyRepository policyRepository,
                                             ChannelConnectorRegistry connectorRegistry) {
        this.policyRepository = policyRepository;
        this.connectorRegistry = connectorRegistry;
    }

    public List<ChannelCancellationPolicy> getAll(Long orgId) {
        return policyRepository.findAllByOrgId(orgId);
    }

    public List<ChannelCancellationPolicy> getByProperty(Long propertyId, Long orgId) {
        return policyRepository.findByPropertyId(propertyId, orgId);
    }

    public ChannelCancellationPolicy getById(Long id, Long orgId) {
        return policyRepository.findByIdAndOrgId(id, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Cancellation policy not found: " + id));
    }

    @Transactional
    public ChannelCancellationPolicy create(CreateChannelCancellationPolicyRequest request, Long orgId) {
        ChannelCancellationPolicy policy = new ChannelCancellationPolicy();
        policy.setOrganizationId(orgId);
        policy.setPropertyId(request.propertyId());
        policy.setChannelName(request.channelName());
        applyFields(policy, request);
        policy.setSyncStatus("PENDING");

        ChannelCancellationPolicy saved = policyRepository.save(policy);
        pushPolicyToChannel(saved, orgId);
        return saved;
    }

    @Transactional
    public ChannelCancellationPolicy update(Long id, Long orgId, CreateChannelCancellationPolicyRequest request) {
        ChannelCancellationPolicy policy = getById(id, orgId);
        applyFields(policy, request);

        ChannelCancellationPolicy saved = policyRepository.save(policy);
        if (policy.getEnabled()) {
            pushPolicyToChannel(saved, orgId);
        }
        return saved;
    }

    @Transactional
    public void delete(Long id, Long orgId) {
        ChannelCancellationPolicy policy = getById(id, orgId);
        policyRepository.delete(policy);
    }

    @Transactional
    public void pushPolicyToChannel(ChannelCancellationPolicy policy, Long orgId) {
        Optional<ChannelConnector> connectorOpt = connectorRegistry.getConnector(policy.getChannelName());
        if (connectorOpt.isEmpty()) return;

        ChannelConnector connector = connectorOpt.get();
        if (!connector.supports(ChannelCapability.CANCELLATION_POLICIES)) return;

        try {
            SyncResult result = connector.pushCancellationPolicy(policy, orgId);
            if (result.getStatus() == SyncResult.Status.SUCCESS) {
                policy.setSyncStatus("SYNCED");
                policy.setSyncedAt(Instant.now());
                policyRepository.save(policy);
                log.info("Cancellation policy {} pushed to {} successfully", policy.getId(), policy.getChannelName());
            } else if (result.isFailed()) {
                policy.setSyncStatus("FAILED");
                policyRepository.save(policy);
                log.error("Cancellation policy {} rejected by {}: {}", policy.getId(), policy.getChannelName(), result.getMessage());
            }
        } catch (Exception e) {
            log.error("Error pushing cancellation policy {} to {}: {}", policy.getId(), policy.getChannelName(), e.getMessage());
        }
    }

    private void applyFields(ChannelCancellationPolicy p, CreateChannelCancellationPolicyRequest r) {
        p.setPolicyType(r.policyType());
        p.setName(r.name());
        p.setDescription(r.description());
        if (r.cancellationRules() != null) p.setCancellationRules(r.cancellationRules());
        p.setNonRefundableDiscount(r.nonRefundableDiscount());
        if (r.config() != null) p.setConfig(r.config());
    }
}
