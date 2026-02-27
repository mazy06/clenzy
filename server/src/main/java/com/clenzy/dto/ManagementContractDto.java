package com.clenzy.dto;

import com.clenzy.model.ManagementContract;
import com.clenzy.model.ManagementContract.ContractStatus;
import com.clenzy.model.ManagementContract.ContractType;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record ManagementContractDto(
    Long id,
    Long propertyId,
    Long ownerId,
    String contractNumber,
    ContractType contractType,
    ContractStatus status,
    LocalDate startDate,
    LocalDate endDate,
    BigDecimal commissionRate,
    Integer minimumStayNights,
    Boolean autoRenew,
    Integer noticePeriodDays,
    Boolean cleaningFeeIncluded,
    Boolean maintenanceIncluded,
    String notes,
    Instant signedAt,
    Instant terminatedAt,
    String terminationReason,
    Instant createdAt
) {
    public static ManagementContractDto from(ManagementContract c) {
        return new ManagementContractDto(
            c.getId(), c.getPropertyId(), c.getOwnerId(),
            c.getContractNumber(), c.getContractType(), c.getStatus(),
            c.getStartDate(), c.getEndDate(), c.getCommissionRate(),
            c.getMinimumStayNights(), c.getAutoRenew(), c.getNoticePeriodDays(),
            c.getCleaningFeeIncluded(), c.getMaintenanceIncluded(),
            c.getNotes(), c.getSignedAt(), c.getTerminatedAt(),
            c.getTerminationReason(), c.getCreatedAt()
        );
    }
}
