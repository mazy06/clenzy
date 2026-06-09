package com.clenzy.dto;

import com.clenzy.model.ManagementContract.CommissionBase;
import com.clenzy.model.ManagementContract.ContractType;
import com.clenzy.model.ManagementContract.PaymentModel;
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
    String notes,
    BigDecimal upsellCommissionRate,
    BigDecimal activityCommissionRate,
    /** Modèle de flux/répartition (null = DIRECT par défaut côté service). */
    PaymentModel paymentModel,
    /** Base de commission brut/net OTA (null = GROSS par défaut côté service). */
    CommissionBase commissionBase
) {}
