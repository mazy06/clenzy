package com.clenzy.service;

import com.clenzy.dto.CreateChannelFeeRequest;
import com.clenzy.integration.channel.ChannelCapability;
import com.clenzy.integration.channel.ChannelConnector;
import com.clenzy.integration.channel.ChannelConnectorRegistry;
import com.clenzy.integration.channel.SyncResult;
import com.clenzy.model.ChannelFee;
import com.clenzy.repository.ChannelFeeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class ChannelFeeService {

    private static final Logger log = LoggerFactory.getLogger(ChannelFeeService.class);

    private final ChannelFeeRepository feeRepository;
    private final ChannelConnectorRegistry connectorRegistry;

    public ChannelFeeService(ChannelFeeRepository feeRepository,
                              ChannelConnectorRegistry connectorRegistry) {
        this.feeRepository = feeRepository;
        this.connectorRegistry = connectorRegistry;
    }

    public List<ChannelFee> getAll(Long orgId) {
        return feeRepository.findAllByOrgId(orgId);
    }

    public List<ChannelFee> getByProperty(Long propertyId, Long orgId) {
        return feeRepository.findByPropertyId(propertyId, orgId);
    }

    public ChannelFee getById(Long id, Long orgId) {
        return feeRepository.findByIdAndOrgId(id, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Fee not found: " + id));
    }

    @Transactional
    public ChannelFee create(CreateChannelFeeRequest request, Long orgId) {
        ChannelFee fee = new ChannelFee();
        fee.setOrganizationId(orgId);
        fee.setPropertyId(request.propertyId());
        fee.setChannelName(request.channelName());
        applyFields(fee, request);
        fee.setSyncStatus("PENDING");

        ChannelFee saved = feeRepository.save(fee);
        pushFeeToChannel(saved, orgId);
        return saved;
    }

    @Transactional
    public ChannelFee update(Long id, Long orgId, CreateChannelFeeRequest request) {
        ChannelFee fee = getById(id, orgId);
        applyFields(fee, request);

        ChannelFee saved = feeRepository.save(fee);
        if (fee.getEnabled()) {
            pushFeeToChannel(saved, orgId);
        }
        return saved;
    }

    @Transactional
    public void delete(Long id, Long orgId) {
        ChannelFee fee = getById(id, orgId);
        feeRepository.delete(fee);
    }

    @Transactional
    public void pushFeeToChannel(ChannelFee fee, Long orgId) {
        Optional<ChannelConnector> connectorOpt = connectorRegistry.getConnector(fee.getChannelName());
        if (connectorOpt.isEmpty()) return;

        ChannelConnector connector = connectorOpt.get();
        if (!connector.supports(ChannelCapability.FEES)) return;

        try {
            // Push all fees for this property+channel together
            List<ChannelFee> allFees = feeRepository.findByPropertyIdAndChannelName(
                fee.getPropertyId(), fee.getChannelName(), orgId);
            List<ChannelFee> enabledFees = allFees.stream().filter(ChannelFee::getEnabled).toList();

            SyncResult result = connector.pushFees(enabledFees, orgId);
            if (result.getStatus() == SyncResult.Status.SUCCESS) {
                for (ChannelFee f : enabledFees) {
                    f.setSyncStatus("SYNCED");
                    f.setSyncedAt(Instant.now());
                    feeRepository.save(f);
                }
                log.info("Fees pushed to {} for property {} ({} fees)", fee.getChannelName(), fee.getPropertyId(), enabledFees.size());
            } else if (result.isFailed()) {
                fee.setSyncStatus("FAILED");
                feeRepository.save(fee);
                log.error("Fees rejected by {}: {}", fee.getChannelName(), result.getMessage());
            }
        } catch (Exception e) {
            log.error("Error pushing fees to {}: {}", fee.getChannelName(), e.getMessage());
        }
    }

    private void applyFields(ChannelFee f, CreateChannelFeeRequest r) {
        f.setFeeType(r.feeType());
        f.setName(r.name());
        f.setAmount(r.amount());
        f.setCurrency(r.currency() != null ? r.currency() : "EUR");
        f.setChargeType(r.chargeType() != null ? r.chargeType() : com.clenzy.model.ChargeType.PER_STAY);
        f.setIsMandatory(r.isMandatory() != null ? r.isMandatory() : true);
        f.setIsTaxable(r.isTaxable() != null ? r.isTaxable() : false);
        if (r.config() != null) f.setConfig(r.config());
    }
}
