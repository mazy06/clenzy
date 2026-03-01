package com.clenzy.dto;

import com.clenzy.model.ManagementContract.ContractType;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateManagementContractRequest(
    @NotNull Long propertyId,
    @NotNull Long ownerId,
    @NotNull ContractType contractType,
    @NotNull LocalDate startDate,
    LocalDate endDate,
    @NotNull BigDecimal commissionRate,
    Integer minimumStayNights,
    Boolean autoRenew,
    Integer noticePeriodDays,
    Boolean cleaningFeeIncluded,
    Boolean maintenanceIncluded,
    String notes
) {}
