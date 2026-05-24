/**
 * Channex API client (frontend).
 *
 * Endpoints backend : /api/integrations/channex/**
 * Acces : SUPER_ADMIN / SUPER_MANAGER uniquement (impact distribution OTAs).
 */
import apiClient from '../apiClient';

export type ChannexSyncStatus = 'PENDING' | 'ACTIVE' | 'ERROR' | 'DISABLED';

export interface ChannexMappingDto {
  id: string; // UUID
  organizationId: number;
  clenzyPropertyId: number;
  channexPropertyId: string;
  channexRoomTypeId: string;
  channexDefaultRatePlanId: string;
  syncStatus: ChannexSyncStatus;
  lastSyncAt: string | null; // ISO instant
  lastSyncError: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Mode de connexion :
 * - AUTO_CREATE : Clenzy cree Property + Room Type + Rate Plan dans Channex
 *   en derivant les attributs depuis la Property Clenzy (nom, pays, devise, max guests)
 * - IMPORT_EXISTING : l'utilisateur fournit les 3 IDs deja crees dans Channex
 */
export type ChannexConnectMode = 'AUTO_CREATE' | 'IMPORT_EXISTING';

export interface ChannexConnectRequest {
  mode?: ChannexConnectMode;
  channexPropertyId?: string;
  channexRoomTypeId?: string;
  channexDefaultRatePlanId?: string;
}

export interface ChannexSyncResult {
  success: boolean;
  message: string;
  availabilityUpdates: number;
  rateUpdates: number;
}

export const channexApi = {
  /** Liste tous les mappings Channex de l'organisation. */
  listMappings(): Promise<ChannexMappingDto[]> {
    return apiClient.get<ChannexMappingDto[]>('/integrations/channex/mappings');
  },

  /** Recupere le mapping d'une property specifique (404 si pas connectee). */
  async getMapping(clenzyPropertyId: number): Promise<ChannexMappingDto | null> {
    try {
      return await apiClient.get<ChannexMappingDto>(
        `/integrations/channex/properties/${clenzyPropertyId}/mapping`,
      );
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 404) return null;
      throw err;
    }
  },

  /**
   * Connecte une property Clenzy a Channex.
   * Cote backend : verifie l'existence de la property Channex, cree le mapping,
   * declenche un push initial 6 mois.
   */
  connect(clenzyPropertyId: number, request: ChannexConnectRequest): Promise<ChannexMappingDto> {
    return apiClient.post<ChannexMappingDto>(
      `/integrations/channex/properties/${clenzyPropertyId}/connect`,
      request,
    );
  },

  /** Deconnecte une property (mapping local supprime, property Channex preservee). */
  disconnect(clenzyPropertyId: number): Promise<void> {
    return apiClient.delete<void>(
      `/integrations/channex/properties/${clenzyPropertyId}/disconnect`,
    );
  },

  /**
   * Smart Disconnect orchestre : enchaine deactivate channels (libere les OTA)
   * → delete channels (nettoie le hub) → optionnellement delete property hub
   * → cleanup local en UN SEUL appel REST. Reponse structuree avec une etape
   * par operation (checklist UI).
   *
   * @param clenzyPropertyId   Property a deconnecter
   * @param deleteChannexProperty true = reset complet (supprime aussi la pivot
   *   cote hub Channex — irreversible). false (defaut) = soft reversible :
   *   le user peut reconnecter sans recreer la property cote hub.
   */
  fullDisconnect(
    clenzyPropertyId: number,
    deleteChannexProperty: boolean = false,
  ): Promise<ChannexFullDisconnectResult> {
    return apiClient.post<ChannexFullDisconnectResult>(
      `/integrations/channex/properties/${clenzyPropertyId}/full-disconnect`,
      { deleteChannexProperty },
    );
  },

  /**
   * Pre-flight check Channex : verifie si une connexion peut aboutir AVANT
   * de demarrer un wizard OAuth. Retourne une liste de checks (OK / WARNING /
   * BLOCKER) + un flag {@code canProceed} faux des qu'un BLOCKER existe.
   *
   * @param propertyId Optionnel — sans : checks globaux uniquement (API, hub,
   *   capabilities). Avec : ajoute les checks par-property (existence,
   *   mapping deja present, completude attributs).
   */
  preflight(propertyId?: number): Promise<ChannexPreflightReport> {
    const params: Record<string, string> = {};
    if (propertyId != null) params.propertyId = String(propertyId);
    return apiClient.get<ChannexPreflightReport>(
      '/integrations/channex/preflight',
      { params },
    );
  },

  /**
   * Diagnostic d'une property connectee a Channex (Quick Win #5).
   * Retourne un snapshot de l'etat de sync + 1-3 actions recommandees en 1 clic
   * pour debloquer la situation (cas typique : listing bloque cote OTA).
   */
  diagnose(clenzyPropertyId: number): Promise<ChannexDiagnosisReport> {
    return apiClient.get<ChannexDiagnosisReport>(
      `/integrations/channex/properties/${clenzyPropertyId}/diagnose`,
    );
  },

  /**
   * Resume agrege de la sante Channex pour l'organisation courante (Phase 2).
   * Counts par sync_status + liste des items meritant attention (ERROR
   * persistant, PENDING bloque > 24h, ACTIVE stale > 6h).
   */
  healthSummary(): Promise<ChannexHealthSummary> {
    return apiClient.get<ChannexHealthSummary>(
      '/integrations/channex/health-summary',
    );
  },

  /**
   * Historique des operations sync Channex pour une property (Phase 3).
   * Trie par date desc, max 200 entrees.
   */
  syncLogs(clenzyPropertyId: number, limit: number = 50): Promise<ChannexSyncLogDto[]> {
    return apiClient.get<ChannexSyncLogDto[]>(
      `/integrations/channex/properties/${clenzyPropertyId}/sync-logs`,
      { params: { limit: String(Math.min(Math.max(1, limit), 200)) } },
    );
  },

  /**
   * Force un re-push complet d'une property (1 a 12 mois, defaut 6).
   * Utile pour recuperer un mapping en ERROR ou apres changement de prix.
   */
  resync(clenzyPropertyId: number, months: number = 6): Promise<ChannexSyncResult> {
    return apiClient.post<ChannexSyncResult>(
      `/integrations/channex/properties/${clenzyPropertyId}/resync`,
      undefined,
      { params: { months: String(months) } },
    );
  },

  /**
   * Re-synchronise le contenu OTA d'une property (re-scrape Airbnb pour nom
   * + amenities JSON-LD, applique les aliases admin, met a jour amenities
   * et ota_raw_amenities). Utile pour les properties importees avant le
   * scraping ou apres modification du listing OTA cote host.
   */
  resyncContent(clenzyPropertyId: number): Promise<ChannexResyncContentResult> {
    return apiClient.post<ChannexResyncContentResult>(
      `/integrations/channex/properties/${clenzyPropertyId}/resync-content`,
      undefined,
    );
  },

  /** Bulk : re-sync content de TOUTES les properties de l'org. */
  resyncAllContent(): Promise<ChannexResyncContentResult[]> {
    return apiClient.post<ChannexResyncContentResult[]>(
      `/integrations/channex/properties/resync-all-content`,
      undefined,
    );
  },

  /**
   * Importe les bookings actuellement connus de Channex pour cette property
   * (utile juste apres avoir connecte un OTA cote Channex).
   * Idempotent : les bookings deja persistes sont skip silencieusement.
   */
  pullBookings(clenzyPropertyId: number, from?: string, to?: string): Promise<PullBookingsResult> {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    return apiClient.post<PullBookingsResult>(
      `/integrations/channex/properties/${clenzyPropertyId}/pull-bookings`,
      undefined,
      { params },
    );
  },

  /**
   * Recupere une URL signee a embarquer dans une iframe pour ouvrir le widget
   * officiel Channex de connexion aux OTAs (Airbnb, Booking, Vrbo, Expedia).
   *
   * Le token dans l'URL est a usage unique (15 min de validite). Une fois
   * charge par la iframe, la session reste active jusqu'a fermeture de l'onglet.
   *
   * Si `channelCode` est fourni (ex: 'ABB' pour Airbnb), le wizard Channex est
   * pre-filtre pour ne montrer que cet OTA — ameliore l'UX en evitant a
   * l'utilisateur de chercher dans la longue liste des 500+ channels Channex.
   */
  getEmbedUrl(
    clenzyPropertyId: number,
    lng: string = 'fr',
    channelCode?: ChannexOtaCode,
  ): Promise<ChannexEmbedUrlResponse> {
    const params: Record<string, string> = { lng };
    if (channelCode) params.channel = channelCode;
    return apiClient.get<ChannexEmbedUrlResponse>(
      `/integrations/channex/properties/${clenzyPropertyId}/embed-url`,
      { params },
    );
  },

  /**
   * Cree un channel OTA Channex pre-rempli (title auto, channel type, group)
   * via API, et retourne l'URL d'iframe pointant directement sur ce channel
   * pour finaliser l'OAuth/credentials. L'utilisateur n'a plus a remplir le
   * wizard manuellement.
   *
   * Le backend resoud automatiquement le group_id Channex de la property.
   *
   * @param apiChannelName Nom Channex officiel ("Airbnb", "BookingCom", ...)
   *                       — utiliser CHANNEX_OTA_OPTIONS[i].apiChannelName
   */
  createOtaChannel(
    clenzyPropertyId: number,
    apiChannelName: string,
    lng: string = 'fr',
  ): Promise<ChannexOtaChannelResponse> {
    return apiClient.post<ChannexOtaChannelResponse>(
      `/integrations/channex/properties/${clenzyPropertyId}/ota-channels`,
      { otaChannelName: apiChannelName },
      { params: { lng } },
    );
  },

  /**
   * Discovery : retourne les properties du hub non encore mappees a Clenzy +
   * un compteur global pour distinguer "hub vide" vs "tout deja importe".
   */
  discoverUnmappedProperties(): Promise<ChannexDiscoveryResponse> {
    return apiClient.get<ChannexDiscoveryResponse>(
      '/integrations/channex/discover',
    );
  },

  /**
   * Import en masse : pour chaque ID Channex selectionne, le backend cree
   * une Property Clenzy auto-fillee (depuis les attributs Channex) + un
   * ChannexPropertyMapping (sync_status PENDING).
   *
   * Idempotent : si un mapping existe deja pour un channexPropertyId, il est
   * skip silencieusement (status SKIPPED_ALREADY_MAPPED).
   */
  /**
   * @param overrides Reserve aux SUPER_ADMIN / SUPER_MANAGER : reattribue la
   *   property creee a une autre org + un autre owner. Les deux champs DOIVENT
   *   etre fournis ensemble (le backend valide la coherence org ↔ owner).
   */
  importProperties(
    imports: ChannexImportItem[],
    overrides?: { targetOrganizationId?: number; targetOwnerId?: number },
  ): Promise<ChannexImportResult> {
    return apiClient.post<ChannexImportResult>(
      '/integrations/channex/import',
      {
        imports,
        targetOrganizationId: overrides?.targetOrganizationId ?? null,
        targetOwnerId: overrides?.targetOwnerId ?? null,
      },
    );
  },

  /**
   * Demarre un flux OAuth OTA "global" (cree une nouvelle session) ou re-ouvre
   * le wizard sur un channel existant (deja OAuth) pour re-detecter de nouveaux
   * listings ajoutes recemment cote OTA.
   *
   * - Sans `existingChannelId` : cree une nouvelle session OAuth (pivot fresh).
   * - Avec `existingChannelId` : reutilise le channel existant (preserve les
   *   tokens OAuth), ouvre l'iframe pour acceder a l'onglet "Listing" et mapper
   *   de nouveaux listings detectes.
   *
   * @param channelCode       code 3 lettres OTA ("ABB" pour Airbnb, "BDC" Booking, ...)
   * @param existingChannelId UUID d'un channel existant pour re-detection (optionnel)
   */
  setupOauth(
    channelCode: ChannexOtaCode,
    existingChannelId?: string,
  ): Promise<ChannexOauthSetupResponse> {
    return apiClient.post<ChannexOauthSetupResponse>(
      '/integrations/channex/import/setup-oauth',
      { channelCode, existingChannelId: existingChannelId ?? null },
    );
  },

  /**
   * Liste les OTAs (Airbnb, Booking, Vrbo, ...) actuellement connectes au hub
   * pour l'organisation. Inclut les tokens OAuth s'ils sont stockes.
   */
  listConnectedOtas(): Promise<ChannexConnectedOta[]> {
    return apiClient.get<ChannexConnectedOta[]>(
      '/integrations/channex/ota-channels',
    );
  },

  /**
   * Deconnecte un OTA : supprime le channel du hub + tokens OAuth.
   * Apres deconnexion, l'utilisateur devra refaire l'OAuth complet
   * pour reconnecter cet OTA.
   */
  disconnectOta(channelId: string): Promise<void> {
    return apiClient.delete<void>(
      `/integrations/channex/ota-channels/${channelId}`,
    );
  },
};

export interface ChannexOauthSetupResponse {
  embedUrl: string;
  expiresInSeconds: number;
  pivotPropertyId: string;
}

/** Channel OTA actuellement connecte au hub (Airbnb, Booking, Vrbo, ...). */
export interface ChannexConnectedOta {
  channelId: string;
  title: string;
  otaName: string;          // "Airbnb", "BookingCom", "VrboCom", ...
  isActive: boolean;        // true = OAuth complet, Save fait dans le wizard
  hasOauthToken: boolean;   // true = tokens stockes (OAuth reussi meme si pas Save)
  attachedPropertyTitle: string;
  attachedPropertyId: string;
}

export interface ChannexDiscoveredProperty {
  channexPropertyId: string;
  title: string;
  currency: string;
  country: string;
  timezone: string;
  maxOccupancy: number | null;
  suggestedType: string;
  hasActiveOta: boolean;
  /** Si false, l'import creera automatiquement un room_type par defaut cote Channex. */
  hasRoomType: boolean;
  /** Si false, l'import creera automatiquement un rate_plan "Standard Rate" par defaut. */
  hasRatePlan: boolean;
  /** Nombre de photos disponibles cote Channex (vides en staging gratuit, peuplees avec API payante). */
  photoCount: number;
  /** True si Channex expose une description content.description non-vide. */
  hasDescription: boolean;
  /** True si Channex expose une address non-vide. */
  hasAddress: boolean;
  /** True si cette property est deja mappee a une Property Clenzy. */
  isImported: boolean;
  /** ID de la Property Clenzy si isImported, null sinon. */
  clenzyPropertyId: number | null;
  /** Nom de la Property Clenzy si isImported, null sinon. */
  clenzyPropertyName: string | null;
  /** OTAs synchronises sur cette property (vide si aucun OAuth). */
  connectedOtas: ChannexPropertyOtaSync[];
  // ─── Donnees STRUCTUREES OTA (rate_plan.settings — pas de scraping HTML)
  /** Type de listing brut OTA (Airbnb: "house", "apartment", ...). */
  otaListingType: string | null;
  /** Tarif/nuit (rate_plan.pricing_setting.default_daily_price). */
  otaNightlyPrice: number | null;
  /** Tarif weekend (pricing_setting.weekend_price). */
  otaWeekendPrice: number | null;
  /** Nb de voyageurs inclus dans le tarif de base (pricing_setting.guests_included). */
  otaGuestsIncluded: number | null;
  /** Tarif par voyageur supplementaire (pricing_setting.price_per_extra_person). */
  otaPricePerExtraPerson: number | null;
  /** Facteur prix hebdomadaire (0 = pas de remise). */
  otaWeeklyPriceFactor: number | null;
  /** Facteur prix mensuel (% remise, ex 16). */
  otaMonthlyPriceFactor: number | null;
  /** Nuits min (availability_rule.default_min_nights). */
  otaMinNights: number | null;
  /** Nuits max (availability_rule.default_max_nights). */
  otaMaxNights: number | null;
  /** Heure check-in start ("FLEXIBLE" ou heure ex "14"). */
  otaCheckInTimeStart: string | null;
  /** Heure check-in end. */
  otaCheckInTimeEnd: string | null;
  /** Heure check-out (entier ex 11). */
  otaCheckOutTime: number | null;
  /** Politique d'annulation (ex "firm_14", "moderate", "strict"). */
  otaCancellationPolicy: string | null;
  /** Politique reservation instantanee ("everyone", "experienced", "off"). */
  otaInstantBooking: string | null;
  /** Animaux acceptes ? */
  otaAllowsPets: boolean | null;
  /** Fumeurs acceptes ? */
  otaAllowsSmoking: boolean | null;
  /** Evenements acceptes ? */
  otaAllowsEvents: boolean | null;
}

/** OTA sync sur une property (mini-badge logo + check vert dans la UI). */
export interface ChannexPropertyOtaSync {
  /** Nom officiel Channex ("Airbnb", "AirBNB", "BookingCom", ...). */
  otaName: string;
  /** true si OAuth complet + Save fait dans le wizard hub */
  isActive: boolean;
  /** true si tokens OAuth stockes (auth reussie meme si pas Save). */
  hasOauthToken: boolean;
}

/** Reponse enrichie de GET /discover : liste des items + compteur global hub. */
export interface ChannexDiscoveryResponse {
  items: ChannexDiscoveredProperty[];
  /** Nombre total de proprietes presentes dans le hub (mappees ou non). 0 = hub vide. */
  totalInHub: number;
  /** Nombre de proprietes non encore importees dans Clenzy (= items.length). */
  totalUnmapped: number;
}

export interface ChannexImportItem {
  channexPropertyId: string;
  propertyType: string; // APARTMENT / HOUSE / STUDIO / VILLA / LOFT / CHALET
}

export interface ChannexImportResult {
  totalRequested: number;
  created: number;
  skipped: number;
  errors: number;
  details: ChannexImportResultItem[];
}

export interface ChannexImportResultItem {
  channexPropertyId: string;
  status: 'CREATED' | 'SKIPPED_ALREADY_MAPPED' | 'ERROR';
  clenzyPropertyId: number | null;
  message: string;
}

export interface ChannexEmbedUrlResponse {
  url: string;
  expiresInSeconds: number;
}

/** Reponse de POST /properties/{id}/ota-channels — channel cree + URL iframe d'OAuth. */
export interface ChannexOtaChannelResponse {
  channelId: string;
  channelTitle: string;
  channelName: string;
  embedUrl: string;
  expiresInSeconds: number;
}

/**
 * Codes Channex 3 lettres pour les OTAs majeurs.
 * Reference : docs.channex.io/api-v.1-documentation/channel-codes
 * Channex en supporte 500+ ; on expose ici les plus pertinents pour Clenzy.
 */
export type ChannexOtaCode = 'ABB' | 'BDC' | 'VRB' | 'EXP' | 'AGO';

export interface ChannexOtaOption {
  code: ChannexOtaCode;
  /** Nom Channex officiel a envoyer dans POST /channels (champ `channel`). */
  apiChannelName: string;
  name: string;                // libelle UI
  brandColor: string;          // bg du card
  brandColorFg: string;        // texte/icone sur le bg
  initials: string;            // affichage simple sans logo externe
  description: string;
}

export const CHANNEX_OTA_OPTIONS: readonly ChannexOtaOption[] = [
  {
    code: 'ABB',
    apiChannelName: 'Airbnb',
    name: 'Airbnb',
    brandColor: '#FF5A5F',
    brandColorFg: '#FFFFFF',
    initials: 'Ab',
    description: 'OAuth direct · sync 2-way',
  },
  {
    code: 'BDC',
    apiChannelName: 'BookingCom',
    name: 'Booking.com',
    brandColor: '#003580',
    brandColorFg: '#FFFFFF',
    initials: 'B.',
    description: 'XML API · credentials hotel',
  },
  {
    code: 'VRB',
    apiChannelName: 'VrboCom',
    name: 'Vrbo',
    brandColor: '#0067DC',
    brandColorFg: '#FFFFFF',
    initials: 'Vr',
    description: 'Expedia Group · XML',
  },
  {
    code: 'EXP',
    apiChannelName: 'ExpediaQuickConnect',
    name: 'Expedia',
    brandColor: '#FEDB00',
    brandColorFg: '#1E1E1E',
    initials: 'Ex',
    description: 'EQC · multi-marques',
  },
  {
    code: 'AGO',
    apiChannelName: 'Agoda',
    name: 'Agoda',
    brandColor: '#D4291E',
    brandColorFg: '#FFFFFF',
    initials: 'Ag',
    description: 'Marche APAC · YCS',
  },
] as const;

export interface PullBookingsResult {
  totalReceived: number;
  importedOrIdempotent: number;
  skipped: number;
  errors: number;
}

/** Resultat d'un re-sync content (re-scrape OTA + apply aliases). */
export interface ChannexResyncContentResult {
  clenzyPropertyId: number;
  propertyName: string;
  scrapedName: string | null;
  mappedAmenities: string[];
  rawAmenitiesRemaining: string[];
  ignoredCount: number;
}

/**
 * Etape d'un Smart Disconnect orchestre.
 *
 * Codes possibles (stables pour mapping UI ↔ icone) :
 * - `LIST_CHANNELS`     : enumere les channels Channex lies a la property
 * - `DEACTIVATE_CHANNEL`: PUT is_active=false (= libere l'OTA — critique)
 * - `DELETE_CHANNEL`    : DELETE /channels/{id} (nettoyage hub)
 * - `DELETE_PROPERTY`   : DELETE /properties/{id} (reset hub complet, optionnel)
 * - `CLEANUP_LOCAL`     : suppression mapping + ota_channels en DB Clenzy
 */
export interface ChannexFullDisconnectStep {
  code:
    | 'LIST_CHANNELS'
    | 'DEACTIVATE_CHANNEL'
    | 'DELETE_CHANNEL'
    | 'DELETE_PROPERTY'
    | 'CLEANUP_LOCAL';
  label: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  detail: string;
  /** Channel ID Channex pour DEACTIVATE_CHANNEL / DELETE_CHANNEL. */
  targetId: string | null;
}

/** Reponse de POST /properties/{id}/full-disconnect — checklist par etape. */
export interface ChannexFullDisconnectResult {
  /** true uniquement si TOUTES les etapes non-SKIPPED sont SUCCESS. */
  overallSuccess: boolean;
  clenzyPropertyId: number;
  channexPropertyId: string;
  steps: ChannexFullDisconnectStep[];
}

/**
 * Check individuel d'un pre-flight Channex.
 *
 * Codes (stables pour mapping UI ↔ icone + couleur) :
 * - `API_REACHABLE`        : API Channex joignable + auth OK
 * - `WHITELABEL_CAPABILITIES` : snapshot des capabilities WL disponibles
 * - `HUB_STATE`            : nb properties dans le hub + nb deja mappees
 * - `PROPERTY_EXISTS`      : property Clenzy existe + meme org
 * - `PROPERTY_NOT_MAPPED`  : pas de mapping deja present
 * - `PROPERTY_NAME` / `PROPERTY_CURRENCY` / `PROPERTY_COUNTRY` : attributs requis
 */
export interface ChannexPreflightCheck {
  code:
    | 'API_REACHABLE'
    | 'WHITELABEL_CAPABILITIES'
    | 'HUB_STATE'
    | 'PROPERTY_EXISTS'
    | 'PROPERTY_NOT_MAPPED'
    | 'PROPERTY_NAME'
    | 'PROPERTY_CURRENCY'
    | 'PROPERTY_COUNTRY';
  label: string;
  severity: 'OK' | 'WARNING' | 'BLOCKER';
  detail: string;
  /** Marche a suivre si severity != OK. null si severity == OK. */
  remediation: string | null;
}

/** Reponse de GET /preflight — rapport complet avec verdict global. */
export interface ChannexPreflightReport {
  /** false des qu'au moins un BLOCKER est detecte → l'UI desactive le bouton Connect. */
  canProceed: boolean;
  checks: ChannexPreflightCheck[];
}

/** Snapshot brut de l'etat de sync (extrait du mapping + check OTAs cote hub). */
export interface ChannexSyncSnapshot {
  status: ChannexSyncStatus;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  /** Nombre d'OTAs actifs (is_active=true) sur le hub pour cette property. */
  activeOtaCount: number;
  hasActiveOta: boolean;
}

/**
 * Action recommandee par le diagnostic.
 *
 * Codes (stables pour mapping UI ↔ handler) :
 * - `FORCE_RESYNC`    : appelle channexApi.resync(propertyId)
 * - `FULL_DISCONNECT` : ouvre le Smart Disconnect dialog
 * - `OPEN_HUB`        : navigue vers les settings Channex
 */
export interface ChannexRecommendedAction {
  code: 'FORCE_RESYNC' | 'FULL_DISCONNECT' | 'OPEN_HUB';
  label: string;
  detail: string;
  priority: 'PRIMARY' | 'SECONDARY';
}

/** Reponse de GET /properties/{id}/diagnose — snapshot + actions. */
export interface ChannexDiagnosisReport {
  clenzyPropertyId: number;
  propertyName: string;
  sync: ChannexSyncSnapshot;
  recommendedActions: ChannexRecommendedAction[];
  /** Resume humain en francais affiche en tete du dialog. */
  summary: string;
}

/** Severite d'un item meritant attention dans le health summary. */
export type ChannexAttentionSeverity = 'ERROR' | 'WARNING' | 'INFO';

/** Un mapping qui demande une action humaine + raison. */
export interface ChannexAttentionItem {
  clenzyPropertyId: number;
  propertyName: string;
  syncStatus: ChannexSyncStatus;
  severity: ChannexAttentionSeverity;
  reason: string;
  lastSyncAt: string | null;
  lastSyncError: string | null;
}

/** Reponse de GET /health-summary — counts agreges + liste d'attention. */
export interface ChannexHealthSummary {
  totalMappings: number;
  /** Counts indexes par status (cles : PENDING, ACTIVE, ERROR, DISABLED). */
  countsByStatus: Record<ChannexSyncStatus, number>;
  /** Trie ERROR > WARNING > INFO, puis par lastSyncAt asc. */
  attentionItems: ChannexAttentionItem[];
  /** ISO instant — quand le snapshot a ete calcule. */
  computedAt: string;
}

/** Type d'operation sync persistee dans channex_sync_logs. */
export type ChannexSyncLogType =
  | 'PUSH_AVAILABILITY'
  | 'PUSH_RATES'
  | 'PUSH_PROPERTY'
  | 'PULL_BOOKINGS'
  | 'RESYNC_CONTENT';

/** Statut d'une operation sync persistee. */
export type ChannexSyncLogStatus = 'SUCCESS' | 'FAIL' | 'SKIPPED';

/** Une entree d'historique sync Channex (GET /properties/{id}/sync-logs). */
export interface ChannexSyncLogDto {
  id: number;
  clenzyPropertyId: number;
  mappingId: string | null;
  syncType: ChannexSyncLogType;
  status: ChannexSyncLogStatus;
  recordCount: number;
  durationMs: number;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
}

/** UI helpers : couleurs + labels par statut de sync. */
export const CHANNEX_STATUS_META: Record<
  ChannexSyncStatus,
  { label: string; color: string; description: string }
> = {
  PENDING: {
    label: 'En cours de configuration',
    color: '#D97706',
    description: 'Mapping cree, push initial en cours ou pas encore tente.',
  },
  ACTIVE: {
    label: 'Connectee',
    color: '#059669',
    description: 'Sync operationnelle, derniere mise a jour reussie.',
  },
  ERROR: {
    label: 'Erreur',
    color: '#EF4444',
    description: 'Derniere sync a echoue. Le scheduler retentera dans l\'heure.',
  },
  DISABLED: {
    label: 'Desactivee',
    color: '#6B7280',
    description: 'Sync manuellement desactivee. Cliquez sur "Resync" pour reactiver.',
  },
};
