package com.clenzy.dto.netatmo;

/**
 * Un module Netatmo decouvert (station meteo ou module rattache), pour le picker du
 * wizard d'ajout. {@code id} = identifiant Netatmo (_id) a stocker comme externalDeviceId.
 */
public record NetatmoModuleDto(
        String id,
        String name,
        String type,          // NAMain (station) | NAModule1 (ext) | NAModule4 (interieur add.) ...
        String stationName,
        boolean reachable
) {}
