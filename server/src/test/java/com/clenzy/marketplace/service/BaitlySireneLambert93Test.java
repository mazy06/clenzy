package com.clenzy.marketplace.service;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class BaitlySireneLambert93Test {
    @Test void projectionOriginAndIgnNumericalExampleMatchKnownCoordinates() {
        var origin=BaitlySireneLambert93.point("700000","6600000","18000");
        assertThat(origin[0]).isCloseTo(46.5,within(.0000001));assertThat(origin[1]).isEqualTo(3);
        // IGN, Les représentations planes de l’ellipsoïde, page 33, inverse example.
        var example=BaitlySireneLambert93.point("857582","6435415","05000");
        assertThat(example[0]).isCloseTo(Math.toDegrees(.7853982026),within(.00001));
        assertThat(example[1]).isCloseTo(Math.toDegrees(.0872664863),within(.00001));
    }
    @Test void rejectsOverseasUnknownAndInvalidCoordinates() {
        assertThat(BaitlySireneLambert93.point("700000","6600000","97400")).isNull();
        assertThat(BaitlySireneLambert93.point("NaN","6600000","75001")).isNull();
        assertThat(BaitlySireneLambert93.point("0","0","75001")).isNull();
        assertThat(BaitlySireneLambert93.point("","","75001")).isNull();
    }
}
