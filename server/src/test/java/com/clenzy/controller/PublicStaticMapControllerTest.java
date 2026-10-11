package com.clenzy.controller;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PublicStaticMapControllerTest {

    @Test
    void whenTileInsideTheGrid_thenItIsServed() {
        assertThat(PublicStaticMapController.isValidTile(15, 16597, 11272)).isTrue();
        assertThat(PublicStaticMapController.isValidTile(0, 0, 0)).isTrue();
    }

    @Test
    void whenTileOutsideTheGridOrTooDeep_thenItIsRefused() {
        assertThat(PublicStaticMapController.isValidTile(2, 4, 0)).isFalse();
        assertThat(PublicStaticMapController.isValidTile(3, -1, 0)).isFalse();
        assertThat(PublicStaticMapController.isValidTile(19, 0, 0)).isFalse();
    }
}
