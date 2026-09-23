package com.clenzy.dto;

import com.clenzy.model.PropertyLicense;
import com.clenzy.service.property.TourismLicense;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

class PropertyLicenseDtoTest {

    private PropertyLicense license(PropertyLicense.LicenseType type, String number) {
        PropertyLicense license = new PropertyLicense();
        license.setLicenseType(type);
        license.setLicenseNumber(number);
        license.setRenewalLeadDays(60);
        return license;
    }

    @Test
    void whenTourismLicenceIsSaudiAndWellFormed_thenVerdictIsValid() {
        var dto = PropertyLicenseDto.from(
                license(PropertyLicense.LicenseType.TOURISM_REGISTRATION, "50123456"), "SA", "Asia/Riyadh");

        assertThat(dto.formatVerdict()).isEqualTo(TourismLicense.Verdict.VALID.name());
    }

    @Test
    void whenTourismLicenceIsSaudiAndMalformed_thenVerdictSaysSo() {
        var dto = PropertyLicenseDto.from(
                license(PropertyLicense.LicenseType.TOURISM_REGISTRATION, "12345"), "SA", "Asia/Riyadh");

        assertThat(dto.formatVerdict()).isEqualTo(TourismLicense.Verdict.MALFORMED.name());
    }

    @Test
    void whenLicenceIsNotATourismRegistration_thenNeverChecked() {
        // Un certificat de securite n'a pas de format national : le controler
        // contre la regle saoudienne le declarerait faux a tort.
        var dto = PropertyLicenseDto.from(
                license(PropertyLicense.LicenseType.SAFETY_CERT, "12345"), "SA", "Asia/Riyadh");

        assertThat(dto.formatVerdict()).isEqualTo(TourismLicense.Verdict.UNCHECKED.name());
    }

    @Test
    void whenPropertyIsNotSaudi_thenUncheckedRatherThanMalformed() {
        var dto = PropertyLicenseDto.from(
                license(PropertyLicense.LicenseType.TOURISM_REGISTRATION, "MA-2026-001"), "MA", "Africa/Casablanca");

        assertThat(dto.formatVerdict()).isEqualTo(TourismLicense.Verdict.UNCHECKED.name());
    }

    @Test
    void whenExpiryFallsInsideTheRenewalLeadTime_thenFlaggedAsExpiringSoon() {
        PropertyLicense license = license(PropertyLicense.LicenseType.TOURISM_REGISTRATION, "50123456");
        license.setExpiresAt(LocalDate.now(ZoneId.of("Asia/Riyadh")).plusDays(30));

        var dto = PropertyLicenseDto.from(license, "SA", "Asia/Riyadh");

        assertThat(dto.expiringSoon()).isTrue();
    }

    @Test
    void whenExpiryIsBeyondTheRenewalLeadTime_thenNotFlagged() {
        PropertyLicense license = license(PropertyLicense.LicenseType.TOURISM_REGISTRATION, "50123456");
        license.setExpiresAt(LocalDate.now(ZoneId.of("Asia/Riyadh")).plusDays(200));

        var dto = PropertyLicenseDto.from(license, "SA", "Asia/Riyadh");

        assertThat(dto.expiringSoon()).isFalse();
    }

    @Test
    void whenPropertyContextIsUnknown_thenStillMapsWithoutThrowing() {
        var dto = PropertyLicenseDto.from(
                license(PropertyLicense.LicenseType.TOURISM_REGISTRATION, "50123456"), null, null);

        assertThat(dto.formatVerdict()).isEqualTo(TourismLicense.Verdict.UNCHECKED.name());
        assertThat(dto.expiringSoon()).isFalse();
    }
}
