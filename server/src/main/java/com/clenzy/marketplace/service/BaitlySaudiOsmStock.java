package com.clenzy.marketplace.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/** Baitly Saudi public edition, retaining the existing configuration contract. */
@Component
public class BaitlySaudiOsmStock extends BaitlyPublicCountryStock {
    public BaitlySaudiOsmStock(Environment config,ObjectMapper json){super(config,json,"SA");}
}
