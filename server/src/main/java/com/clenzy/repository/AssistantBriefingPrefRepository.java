package com.clenzy.repository;

import com.clenzy.model.AssistantBriefingPref;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AssistantBriefingPrefRepository extends JpaRepository<AssistantBriefingPref, Long> {

    /** Resolution par user — utilise par les endpoints prefs CRUD. */
    Optional<AssistantBriefingPref> findByKeycloakId(String keycloakId);

    /**
     * Liste toutes les prefs activees — utilise par le scheduler horaire qui
     * filtrera ensuite par timezone + time_local. On evite un filtre SQL sur
     * la timezone pour rester portable et garder la logique au meme endroit.
     */
    @Query("SELECT p FROM AssistantBriefingPref p WHERE p.enabled = true")
    List<AssistantBriefingPref> findAllEnabled();
}
