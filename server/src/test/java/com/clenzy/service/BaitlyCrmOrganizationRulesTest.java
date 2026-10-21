package com.clenzy.service;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import static org.assertj.core.api.Assertions.assertThat;

class BaitlyCrmOrganizationRulesTest {
    @ParameterizedTest
    @CsvSource({"CONCIERGE,false,true,true","INDIVIDUAL,false,false,true","CLEANING_COMPANY,false,false,false",
        "SYSTEM,false,false,false","SYSTEM,true,true,true"})
    void onlyStaffCanUseInternalOrganizationForms(String type,boolean staff,boolean concierge,boolean recruitment) {
        assertThat(BaitlyCrmOrganizationRules.concierge(type,staff)).isEqualTo(concierge);
        assertThat(BaitlyCrmOrganizationRules.recruitment(type,staff)).isEqualTo(recruitment);
    }
}
