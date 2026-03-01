package com.clenzy.dto;

import com.clenzy.model.FiscalProfile;
import com.clenzy.model.FiscalRegime;

/**
 * DTO pour l'API FiscalProfile.
 * Expose les champs editables du profil fiscal d'une organisation.
 */
public record FiscalProfileDto(
    Long id,
    Long organizationId,
    String countryCode,
    String defaultCurrency,
    String taxIdNumber,
    String vatNumber,
    FiscalRegime fiscalRegime,
    boolean vatRegistered,
    String vatDeclarationFrequency,
    String invoiceLanguage,
    String invoicePrefix,
    String legalMentions,
    String legalEntityName,
    String legalAddress
) {

    /**
     * Factory method : FiscalProfile entity -> DTO.
     */
    public static FiscalProfileDto from(FiscalProfile fp) {
        return new FiscalProfileDto(
            fp.getId(),
            fp.getOrganizationId(),
            fp.getCountryCode(),
            fp.getDefaultCurrency(),
            fp.getTaxIdNumber(),
            fp.getVatNumber(),
            fp.getFiscalRegime(),
            fp.isVatRegistered(),
            fp.getVatDeclarationFrequency(),
            fp.getInvoiceLanguage(),
            fp.getInvoicePrefix(),
            fp.getLegalMentions(),
            fp.getLegalEntityName(),
            fp.getLegalAddress()
        );
    }

    /**
     * Applique les valeurs du DTO sur une entite existante.
     */
    public void applyTo(FiscalProfile fp) {
        fp.setCountryCode(countryCode);
        fp.setDefaultCurrency(defaultCurrency);
        fp.setTaxIdNumber(taxIdNumber);
        fp.setVatNumber(vatNumber);
        fp.setFiscalRegime(fiscalRegime);
        fp.setVatRegistered(vatRegistered);
        fp.setVatDeclarationFrequency(vatDeclarationFrequency);
        fp.setInvoiceLanguage(invoiceLanguage);
        fp.setInvoicePrefix(invoicePrefix);
        fp.setLegalMentions(legalMentions);
        fp.setLegalEntityName(legalEntityName);
        fp.setLegalAddress(legalAddress);
    }
}
