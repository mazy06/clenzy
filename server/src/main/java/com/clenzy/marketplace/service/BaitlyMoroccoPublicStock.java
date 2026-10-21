package com.clenzy.marketplace.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/** Baitly public Moroccan edition: same checksum and licence checks as the Saudi source. */
@Component
public final class BaitlyMoroccoPublicStock extends BaitlyPublicCountryStock {
    public BaitlyMoroccoPublicStock(Environment config,ObjectMapper json){super(config,json,"MA");}
}
