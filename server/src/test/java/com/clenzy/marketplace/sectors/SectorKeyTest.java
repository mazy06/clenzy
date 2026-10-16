package com.clenzy.marketplace.sectors;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SectorKeyTest {

    @Test
    void whenAnArrondissementIsGiven_thenItTakesPrecedenceOverItsDepartment() {
        assertThat(SectorKey.of("FR", "75", "75111", null)).isEqualTo("FR-A-75111");
        assertThat(SectorKey.of("FR", "75", "10e", null)).isEqualTo("FR-A-75110");
        assertThat(SectorKey.of("FR", "69", "69003", null)).isEqualTo("FR-A-69383");
        assertThat(SectorKey.of("FR", "75", "21e", null)).isNull();
    }

    @Test
    void whenOnlyADepartmentIsGiven_thenTheKeyIsUppercased() {
        assertThat(SectorKey.of("FR", "2a", null, null)).isEqualTo("FR-D-2A");
    }

    @Test
    void whenACityIsGiven_thenAccentsSpacesAndCaseAreNormalized() {
        assertThat(SectorKey.of("FR", "92", null, " Courbevoie ")).isEqualTo("FR-C-92-courbevoie");
        assertThat(SectorKey.of("FR", "92", null, "Châtenay-Malabry")).isEqualTo("FR-C-92-chatenay-malabry");
        assertThat(SectorKey.of("FR", "75", "75110", "Paris")).isEqualTo("FR-A-75110");
        assertThat(SectorKey.of("sa", null, null, " Khamis  Mushait ")).isEqualTo("SA-C-khamis-mushait");
        assertThat(SectorKey.of("MA", null, null, "Fès")).isEqualTo("MA-C-fes");
    }

    @Test
    void whenNothingDrawableIsGiven_thenThereIsNoKey() {
        assertThat(SectorKey.of("MA", null, null, " ")).isNull();
    }
}
