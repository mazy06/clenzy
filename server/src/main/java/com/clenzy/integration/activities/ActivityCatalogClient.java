package com.clenzy.integration.activities;

import com.clenzy.dto.ActivityDto;
import com.clenzy.model.ActivityAffiliateConfig;
import com.clenzy.model.ActivityProvider;

import java.util.List;

/**
 * Client de catalogue d'activites pour un provider donne. Une implementation
 * par provider ({@link com.clenzy.model.ActivityProvider}). Les implementations
 * DOIVENT renvoyer une liste vide (jamais d'exception propagee) si la config est
 * absente / sans cle, ou en cas d'echec reseau.
 */
public interface ActivityCatalogClient {

    ActivityProvider provider();

    List<ActivityDto> search(ActivitySearchQuery query, ActivityAffiliateConfig config);
}
