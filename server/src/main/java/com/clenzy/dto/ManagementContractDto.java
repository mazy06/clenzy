package com.clenzy.dto;

import com.clenzy.model.ManagementContract;
import com.clenzy.model.ManagementContract.CommissionBase;
import com.clenzy.model.ManagementContract.ObligationBearer;
import com.clenzy.model.ManagementContract.OtaFeeBearer;
import com.clenzy.model.ManagementContract.ContractStatus;
import com.clenzy.model.ManagementContract.ContractType;
import com.clenzy.model.ManagementContract.PaymentModel;

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
    Instant createdAt,
    BigDecimal upsellCommissionRate,
    PaymentModel paymentModel,
    CommissionBase commissionBase,
    /** Qui supporte les frais prélevés par l'OTA : AGENCY (défaut) ou OWNER. */
    OtaFeeBearer otaFeeBorneBy,
    /** Mandat DÉCLARATIF — qui porte chaque obligation : AGENCY (défaut) ou OWNER. */
    ObligationBearer policeDeclarationBy,
    ObligationBearer touristTaxBy,
    ObligationBearer licenceHeldBy,
    /** Statut de la demande de signature électronique : PENDING | SIGNED | EXPIRED | CANCELLED | null. */
    String signatureStatus
) {
    public static ManagementContractDto from(ManagementContract c) {
        return from(c, null);
    }

    public static ManagementContractDto from(ManagementContract c, String signatureStatus) {
        return new ManagementContractDto(
            c.getId(), c.getPropertyId(), c.getOwnerId(),
            c.getContractNumber(), c.getContractType(), c.getStatus(),
            c.getStartDate(), c.getEndDate(), c.getCommissionRate(),
            c.getMinimumStayNights(), c.getAutoRenew(), c.getNoticePeriodDays(),
            c.getCleaningFeeIncluded(), c.getMaintenanceIncluded(),
            c.getNotes(), c.getSignedAt(), c.getTerminatedAt(),
            c.getTerminationReason(), c.getCreatedAt(),
            c.getUpsellCommissionRate(),
            c.getPaymentModel(), c.getCommissionBase(), c.getOtaFeeBorneBy(),
            c.getPoliceDeclarationBy(), c.getTouristTaxBy(), c.getLicenceHeldBy(),
            signatureStatus
        );
    }
}
