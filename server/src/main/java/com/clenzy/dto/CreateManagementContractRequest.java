package com.clenzy.dto;

import com.clenzy.model.ManagementContract.CommissionBase;
import com.clenzy.model.ManagementContract.ContractType;
import com.clenzy.model.ManagementContract.ObligationBearer;
import com.clenzy.model.ManagementContract.OtaFeeBearer;
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
    /** Modèle de flux/répartition (null = DIRECT par défaut côté service). */
    PaymentModel paymentModel,
    /** Base de commission brut/net OTA (null = GROSS par défaut côté service). */
    CommissionBase commissionBase,
    /** Qui supporte les frais OTA (null = AGENCY par défaut côté service). */
    OtaFeeBearer otaFeeBorneBy,
    /**
     * Mandat DÉCLARATIF (null = AGENCY par défaut côté service) : qui
     * télédéclare la fiche de police, qui dépose la taxe de séjour, au nom de
     * qui la licence est détenue.
     */
    ObligationBearer policeDeclarationBy,
    ObligationBearer touristTaxBy,
    ObligationBearer licenceHeldBy
) {}
