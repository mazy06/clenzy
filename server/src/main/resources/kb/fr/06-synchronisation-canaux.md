# Synchronisation des canaux (Airbnb, Booking, Vrbo, iCal, Channel Manager)

## Qu'est-ce que la synchronisation des canaux dans Baitly ?

Baitly centralise vos annonces publiées sur les plateformes de réservation (aussi appelées canaux ou OTA : Airbnb, Booking.com, Vrbo, Expedia...) et synchronise automatiquement calendriers, réservations, tarifs et disponibilités. Une réservation prise sur un canal bloque les dates partout ; un changement de prix dans Baitly peut être poussé vers les plateformes connectées. La gestion se fait depuis la page Channels (section Distribution du menu), intitulée « Channels & Intégrations », qui liste vos connexions avec une recherche et un filtre par segment. Trois façons de connecter un canal existent : la connexion Airbnb officielle, le Channel Manager (synchronisation bidirectionnelle multi-plateformes) et l'import iCal (lecture seule, universel).

## Comment connecter mon annonce Airbnb ?

Baitly propose une connexion Airbnb par API officielle. Depuis la page Channels, choisissez Airbnb puis lancez la connexion : vous êtes redirigé vers Airbnb pour autoriser Baitly sur votre compte. Une fois connecté, l'écran affiche la date de connexion, la dernière synchronisation et vos annonces Airbnb. Vous liez ensuite chaque annonce Airbnb à un logement Baitly (ou créez un nouveau logement à partir de l'annonce). Pour chaque annonce liée, vous pouvez activer la synchronisation, la création automatique de ménages après chaque séjour et l'envoi automatique des tarifs (push pricing), ou ouvrir l'annonce directement sur Airbnb. La déconnexion est possible à tout moment depuis le même écran.

## Comment distribuer mes logements sur Booking, Vrbo et les autres plateformes ?

Le Channel Manager de Baitly (« Distribuez vos logements ») permet de mettre vos annonces sur Airbnb, Booking, Vrbo et d'autres plateformes avec une synchronisation dans les deux sens : réservations, tarifs et disponibilités. L'assistant guidé propose trois parcours : importer vos annonces existantes depuis Airbnb, Booking ou Vrbo (les informations du logement sont pré-remplies), connecter un logement déjà présent dans Baitly et publié sur les plateformes, ou gérer et déconnecter vos OTA déjà reliés. Un panneau « État technique de la connexion » permet de vérifier que tout fonctionne. Ce mode est recommandé dès que vous voulez une synchronisation complète (prix et restrictions inclus), là où l'iCal ne synchronise que le calendrier.

## Comment importer un calendrier iCal (Booking.com, Vrbo, Abritel...) ?

Si une plateforme n'est pas connectée par API, utilisez l'import iCal : depuis le Planning, ouvrez « Importer des réservations » puis « Import iCal », et collez le lien .ics fourni par la plateforme (Airbnb, Booking, Vrbo...). Les réservations du calendrier externe sont alors importées en lecture seule et resynchronisées automatiquement plusieurs fois par jour, sans action de votre part. Les séjours déjà importés sont reconnus et ne sont pas dupliqués. Vous recevez une notification en cas d'import réussi, partiel ou échoué, ce qui permet de repérer rapidement un lien expiré ou invalide. Limite à connaître : l'iCal ne transporte que les dates ; les tarifs, les coordonnées complètes du voyageur et les restrictions ne transitent pas par ce canal.

## Comment Baitly évite-t-il les doubles réservations ?

Le calendrier Baitly est la source de vérité des disponibilités. Chaque réservation (directe, importée d'un canal ou saisie manuellement) verrouille les dates du logement de façon atomique : deux demandes simultanées sur le même créneau ne peuvent pas passer toutes les deux. Dès qu'une réservation est confirmée, les dates sont poussées comme indisponibles vers les canaux connectés (Airbnb, Booking, Expedia...). À la création manuelle d'une réservation, Baitly détecte aussi les conflits avec une réservation existante, un ménage, une maintenance ou un blocage de dates, et refuse la création en cas de chevauchement bloquant. Pour réduire le risque résiduel avec les calendriers iCal (dont la mise à jour n'est pas instantanée côté plateforme), privilégiez le Channel Manager pour vos canaux principaux.

## Que faire en cas de conflit de calendrier ?

Si deux séjours se chevauchent (par exemple une réservation directe et une réservation importée d'un canal), commencez par vérifier laquelle est légitime, puis annulez ou déplacez l'autre : l'annulation libère automatiquement les dates et resynchronise les canaux. Un message « Conflit détecté » précise l'événement en cause (réservation d'un voyageur, ménage, maintenance ou blocage) avec ses dates. Les administrateurs de la plateforme disposent en plus d'une page Sync & Diagnostics qui audite les commandes de calendrier et détecte les conflits multi-canaux, ainsi que l'état des tâches de synchronisation. Si un conflit se répète sur un même logement, vérifiez que le lien iCal du canal concerné est toujours valide et que la synchronisation de l'annonce est bien activée.

## Questions fréquentes

**Une réservation prise sur mon site direct bloque-t-elle Airbnb ?**
Oui. Dès le paiement confirmé, les dates sont marquées indisponibles et poussées automatiquement vers les canaux connectés.

**À quelle fréquence les calendriers iCal sont-ils synchronisés ?**
Automatiquement, plusieurs fois par jour. Vous êtes notifié si un import échoue ou n'est que partiel.

**Puis-je pousser mes tarifs Baitly vers Airbnb ?**
Oui, avec la connexion Airbnb officielle : activez l'envoi automatique des tarifs sur l'annonce liée, ou utilisez le bouton d'envoi manuel.

**L'import iCal synchronise-t-il les prix ?**
Non, l'iCal ne transporte que les dates de réservation. Pour synchroniser tarifs et disponibilités dans les deux sens, utilisez le Channel Manager.

**Puis-je répondre aux avis voyageurs depuis Baitly ?**
Oui, la section Channels comprend un écran des avis par plateforme avec note moyenne et possibilité de répondre.
