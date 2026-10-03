-- Taxe de séjour MAROC — Marrakech VÉRIFIÉE sur l'arrêté fiscal officiel.
--
-- Source : Commune de Marrakech, arrêté fiscal local n° 109 du 17/02/2021 (version consolidée
-- publiée sur ville-marrakech.ma), chapitre 14 « الرسم على الإقامة بالمؤسسات السياحية وأشكال
-- الإيواء السياحي الأخرى » (20.30.10.11), tarifs modifiés par la délibération du 14/01/2021.
-- Tarifs par personne et par nuit, relevés sur le tableau du chapitre 14 :
--   palais des congrès et hôtels de luxe 30 ; hôtel 5* 15 ; 4* 7 ; 3* 5 ; 2* 4 ; 1* 4 ;
--   clubs hôteliers 15 ; riads 15 ; maisons d'hôtes 15 ; maisons louées aux touristes 20 ;
--   villages de vacances 7 ; résidences touristiques 5 ; autres formes d'hébergement 4.
-- RIAD_MAISON couvre le logement loué aux touristes (appartement, maison, riad non classé) :
-- on retient la ligne « maisons louées aux touristes » (20), pas celle des riads classés (15).
-- Les deux lignes non officielles de 0489 sont remplacées (MAISON_HOTES passe de 15 non
-- vérifié à 15 vérifié ; RIAD_MAISON passe de 10 à 20).
INSERT INTO ma_tourist_tax_rates (city_key, city_label, category, rate, source_label, source_url, as_of, verified) VALUES
('marrakech', 'Marrakech', 'MAISON_HOTES',          15, 'Commune de Marrakech — arrêté fiscal n° 109 du 17/02/2021 (consolidé), chap. 14 : maisons d''hôtes', 'https://www.ville-marrakech.ma/ar/blog/%D8%A7%D9%84%D9%82%D8%B1%D8%A7%D8%B1%20%D8%A7%D9%84%D8%AC%D8%A8%D8%A7%D8%A6%D9%8A%20%D8%A7%D9%84%D9%85%D8%AD%D9%84%D9%8A/1690/', '2021-01-14', TRUE),
('marrakech', 'Marrakech', 'HOTEL_5',               15, 'Commune de Marrakech — arrêté fiscal n° 109 du 17/02/2021 (consolidé), chap. 14 : hôtel 5 étoiles', 'https://www.ville-marrakech.ma/ar/blog/%D8%A7%D9%84%D9%82%D8%B1%D8%A7%D8%B1%20%D8%A7%D9%84%D8%AC%D8%A8%D8%A7%D8%A6%D9%8A%20%D8%A7%D9%84%D9%85%D8%AD%D9%84%D9%8A/1690/', '2021-01-14', TRUE),
('marrakech', 'Marrakech', 'HOTEL_4',                7, 'Commune de Marrakech — arrêté fiscal n° 109 du 17/02/2021 (consolidé), chap. 14 : hôtel 4 étoiles', 'https://www.ville-marrakech.ma/ar/blog/%D8%A7%D9%84%D9%82%D8%B1%D8%A7%D8%B1%20%D8%A7%D9%84%D8%AC%D8%A8%D8%A7%D8%A6%D9%8A%20%D8%A7%D9%84%D9%85%D8%AD%D9%84%D9%8A/1690/', '2021-01-14', TRUE),
('marrakech', 'Marrakech', 'HOTEL_3',                5, 'Commune de Marrakech — arrêté fiscal n° 109 du 17/02/2021 (consolidé), chap. 14 : hôtel 3 étoiles', 'https://www.ville-marrakech.ma/ar/blog/%D8%A7%D9%84%D9%82%D8%B1%D8%A7%D8%B1%20%D8%A7%D9%84%D8%AC%D8%A8%D8%A7%D8%A6%D9%8A%20%D8%A7%D9%84%D9%85%D8%AD%D9%84%D9%8A/1690/', '2021-01-14', TRUE),
('marrakech', 'Marrakech', 'HOTEL_1_2',              4, 'Commune de Marrakech — arrêté fiscal n° 109 du 17/02/2021 (consolidé), chap. 14 : hôtel 1 ou 2 étoiles', 'https://www.ville-marrakech.ma/ar/blog/%D8%A7%D9%84%D9%82%D8%B1%D8%A7%D8%B1%20%D8%A7%D9%84%D8%AC%D8%A8%D8%A7%D8%A6%D9%8A%20%D8%A7%D9%84%D9%85%D8%AD%D9%84%D9%8A/1690/', '2021-01-14', TRUE),
('marrakech', 'Marrakech', 'CLUB',                  15, 'Commune de Marrakech — arrêté fiscal n° 109 du 17/02/2021 (consolidé), chap. 14 : clubs hôteliers', 'https://www.ville-marrakech.ma/ar/blog/%D8%A7%D9%84%D9%82%D8%B1%D8%A7%D8%B1%20%D8%A7%D9%84%D8%AC%D8%A8%D8%A7%D8%A6%D9%8A%20%D8%A7%D9%84%D9%85%D8%AD%D9%84%D9%8A/1690/', '2021-01-14', TRUE),
('marrakech', 'Marrakech', 'RIAD_MAISON',           20, 'Commune de Marrakech — arrêté fiscal n° 109 du 17/02/2021 (consolidé), chap. 14 : maisons louées aux touristes (riads classés : 15)', 'https://www.ville-marrakech.ma/ar/blog/%D8%A7%D9%84%D9%82%D8%B1%D8%A7%D8%B1%20%D8%A7%D9%84%D8%AC%D8%A8%D8%A7%D8%A6%D9%8A%20%D8%A7%D9%84%D9%85%D8%AD%D9%84%D9%8A/1690/', '2021-01-14', TRUE),
('marrakech', 'Marrakech', 'VILLAGE_VACANCES',       7, 'Commune de Marrakech — arrêté fiscal n° 109 du 17/02/2021 (consolidé), chap. 14 : villages de vacances', 'https://www.ville-marrakech.ma/ar/blog/%D8%A7%D9%84%D9%82%D8%B1%D8%A7%D8%B1%20%D8%A7%D9%84%D8%AC%D8%A8%D8%A7%D8%A6%D9%8A%20%D8%A7%D9%84%D9%85%D8%AD%D9%84%D9%8A/1690/', '2021-01-14', TRUE),
('marrakech', 'Marrakech', 'RESIDENCE_TOURISTIQUE',  5, 'Commune de Marrakech — arrêté fiscal n° 109 du 17/02/2021 (consolidé), chap. 14 : résidences touristiques', 'https://www.ville-marrakech.ma/ar/blog/%D8%A7%D9%84%D9%82%D8%B1%D8%A7%D8%B1%20%D8%A7%D9%84%D8%AC%D8%A8%D8%A7%D8%A6%D9%8A%20%D8%A7%D9%84%D9%85%D8%AD%D9%84%D9%8A/1690/', '2021-01-14', TRUE),
('marrakech', 'Marrakech', 'AUTRES',                 4, 'Commune de Marrakech — arrêté fiscal n° 109 du 17/02/2021 (consolidé), chap. 14 : autres formes d''hébergement touristique', 'https://www.ville-marrakech.ma/ar/blog/%D8%A7%D9%84%D9%82%D8%B1%D8%A7%D8%B1%20%D8%A7%D9%84%D8%AC%D8%A8%D8%A7%D8%A6%D9%8A%20%D8%A7%D9%84%D9%85%D8%AD%D9%84%D9%8A/1690/', '2021-01-14', TRUE)
ON CONFLICT (city_key, category) DO UPDATE SET
    city_label   = EXCLUDED.city_label,
    rate         = EXCLUDED.rate,
    min_rate     = NULL,
    max_rate     = NULL,
    source_label = EXCLUDED.source_label,
    source_url   = EXCLUDED.source_url,
    as_of        = EXCLUDED.as_of,
    verified     = EXCLUDED.verified;

-- Fès, Agadir, Tanger : aucun arrêté fiscal consultable en ligne au 03/10/2026 (site de la
-- commune de Fès suspendu, barèmes d'Agadir et de Tanger non publiés). Les tarifs de 0489
-- restent NON vérifiés ; le libellé précise la démarche pour les confirmer.
UPDATE ma_tourist_tax_rates
   SET source_label = source_label || ' (arrêté fiscal non publié en ligne au 03/10/2026 : demander le barème au service d''assiette de la commune)'
 WHERE city_key IN ('fes', 'agadir', 'tanger')
   AND verified = FALSE
   AND source_label NOT LIKE '%non publié en ligne%';
