--
-- 0000 — Baseline du schema pre-Liquibase (ere Flyway V1 / ddl-auto=update).
--
-- Le changelog a ete converti depuis Flyway V2->V58 : le schema INITIAL n'existait
-- dans aucun changeset et un replay sur base vierge echouait des 0001
-- (relation "users" does not exist). Ce changeset recree ce schema manquant :
--   - les tables jamais creees par un changeset mais requises par les changesets
--     0001+ ou par les entites JPA (historiquement creees par ddl-auto=update) ;
--   - SANS les colonnes/contraintes/index ajoutes par des changesets ulterieurs
--     (ils sont rejoues tels quels) ;
--   - la table legacy `invitations` (non-entite, requise par 0041).
--
-- Genere depuis le schema Hibernate (pgvector/pg15) puis reduit a la forme
-- pre-0001. Ce changeset est PRECONDITIONNE dans le master changelog :
-- MARK_RAN si la table `users` existe deja (tout environnement existant),
-- execute uniquement sur base vierge (DR, staging neuf, replay de test).
--



CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.agoda_connections (
    connected_at timestamp(6) without time zone NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    last_sync_at timestamp(6) without time zone,
    organization_id bigint NOT NULL,
    updated_at timestamp(6) without time zone,
    status character varying(20) NOT NULL,
    api_key_encrypted text NOT NULL,
    api_secret_encrypted text,
    error_message character varying(255),
    property_id character varying(255) NOT NULL,
    CONSTRAINT agoda_connections_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying, 'ERROR'::character varying])::text[])))
);

CREATE TABLE public.api_keys (
    rate_limit_per_minute integer,
    created_at timestamp(6) with time zone,
    created_by bigint,
    expires_at timestamp(6) with time zone,
    id bigint NOT NULL,
    key_prefix character varying(8) NOT NULL,
    last_used_at timestamp(6) with time zone,
    organization_id bigint NOT NULL,
    revoked_at timestamp(6) with time zone,
    status character varying(20) NOT NULL,
    key_name character varying(100) NOT NULL,
    key_hash character varying(255) NOT NULL,
    scopes text,
    CONSTRAINT api_keys_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'REVOKED'::character varying, 'EXPIRED'::character varying])::text[])))
);

CREATE TABLE public.audit_log (
    "userId" character varying(255),
    id bigint NOT NULL,
    "timestamp" timestamp(6) with time zone NOT NULL,
    ip_address character varying(45),
    action character varying(50) NOT NULL,
    source character varying(50),
    entity_type character varying(100) NOT NULL,
    details text,
    entity_id character varying(255),
    new_value text,
    old_value text,
    user_agent text,
    user_email character varying(255),
    user_id character varying(255)
);

CREATE TABLE public.automation_executions (
    automation_rule_id bigint NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    executed_at timestamp(6) without time zone,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    reservation_id bigint,
    scheduled_at timestamp(6) without time zone NOT NULL,
    status character varying(20) NOT NULL,
    error_message text,
    CONSTRAINT automation_executions_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'EXECUTED'::character varying, 'SKIPPED'::character varying, 'FAILED'::character varying])::text[])))
);

CREATE TABLE public.automation_rules (
    enabled boolean NOT NULL,
    sort_order integer NOT NULL,
    trigger_offset_days integer NOT NULL,
    trigger_time character varying(5),
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    template_id bigint,
    updated_at timestamp(6) without time zone NOT NULL,
    delivery_channel character varying(20),
    action_type character varying(40) NOT NULL,
    trigger_type character varying(40) NOT NULL,
    name character varying(255) NOT NULL,
    conditions jsonb,
    CONSTRAINT automation_rules_action_type_check CHECK (((action_type)::text = ANY ((ARRAY['SEND_MESSAGE'::character varying, 'SEND_CHECKIN_LINK'::character varying, 'SEND_GUIDE'::character varying, 'SEND_REVIEW_REQUEST'::character varying, 'CREATE_CLEANING_REQUEST'::character varying, 'CANCEL_LINKED_CLEANING_REQUEST'::character varying, 'CREATE_MAINTENANCE_INTERVENTION'::character varying, 'SEND_INVOICE_REMINDER'::character varying, 'NOTIFY_STAFF'::character varying, 'SEND_OWNER_STATEMENT'::character varying, 'SEND_NOISE_WARNING'::character varying, 'SUGGEST_DEPOSIT_REFUND'::character varying, 'SUGGEST_DEPOSIT_RELEASE'::character varying, 'SUGGEST_CALENDAR_BLOCK'::character varying, 'REVOKE_ACCESS_CODE'::character varying])::text[]))),
    CONSTRAINT automation_rules_delivery_channel_check CHECK (((delivery_channel)::text = ANY ((ARRAY['EMAIL'::character varying, 'WHATSAPP'::character varying, 'SMS'::character varying])::text[]))),
    CONSTRAINT automation_rules_trigger_type_check CHECK (((trigger_type)::text = ANY ((ARRAY['RESERVATION_CONFIRMED'::character varying, 'CHECK_IN_APPROACHING'::character varying, 'CHECK_IN_DAY'::character varying, 'CHECK_OUT_DAY'::character varying, 'CHECK_OUT_PASSED'::character varying, 'REVIEW_REMINDER'::character varying, 'RESERVATION_BOOKED'::character varying, 'RESERVATION_CANCELLED'::character varying, 'NOISE_ALERT'::character varying, 'PAYMENT_FAILED'::character varying, 'LOCK_BATTERY_CRITICAL'::character varying, 'INVOICE_OVERDUE'::character varying, 'PAYOUT_PENDING_REMINDER'::character varying, 'OWNER_MONTHLY_STATEMENT'::character varying, 'IOT_DEVICE_OFFLINE'::character varying])::text[])))
);

CREATE TABLE public.automation_triggers (
    is_active boolean,
    created_at timestamp(6) with time zone,
    id bigint NOT NULL,
    last_triggered_at timestamp(6) with time zone,
    organization_id bigint NOT NULL,
    trigger_count bigint,
    platform character varying(20) NOT NULL,
    trigger_event character varying(40) NOT NULL,
    trigger_name character varying(100) NOT NULL,
    callback_url character varying(255) NOT NULL,
    CONSTRAINT automation_triggers_platform_check CHECK (((platform)::text = ANY ((ARRAY['ZAPIER'::character varying, 'MAKE'::character varying, 'CUSTOM'::character varying])::text[]))),
    CONSTRAINT automation_triggers_trigger_event_check CHECK (((trigger_event)::text = ANY ((ARRAY['RESERVATION_CREATED'::character varying, 'RESERVATION_UPDATED'::character varying, 'RESERVATION_CANCELLED'::character varying, 'GUEST_CHECKED_IN'::character varying, 'GUEST_CHECKED_OUT'::character varying, 'REVIEW_RECEIVED'::character varying, 'MESSAGE_RECEIVED'::character varying, 'PAYOUT_GENERATED'::character varying, 'RATE_UPDATED'::character varying])::text[])))
);

CREATE TABLE public.booking_connections (
    connected_at timestamp(6) without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    last_sync_at timestamp(6) without time zone,
    organization_id bigint NOT NULL,
    updated_at timestamp(6) without time zone,
    status character varying(20) NOT NULL,
    error_message character varying(255),
    hotel_id character varying(255) NOT NULL,
    password_encrypted text,
    username character varying(255),
    CONSTRAINT booking_connections_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying, 'ERROR'::character varying, 'SUSPENDED'::character varying])::text[])))
);

CREATE TABLE public.channel_cancellation_policies (
    enabled boolean NOT NULL,
    non_refundable_discount numeric(5,2),
    created_at timestamp(6) with time zone,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    property_id bigint NOT NULL,
    synced_at timestamp(6) with time zone,
    updated_at timestamp(6) with time zone,
    sync_status character varying(20) NOT NULL,
    policy_type character varying(30) NOT NULL,
    channel_name character varying(50) NOT NULL,
    name character varying(100),
    description text,
    external_policy_id character varying(255),
    cancellation_rules jsonb NOT NULL,
    config jsonb,
    CONSTRAINT channel_cancellation_policies_channel_name_check CHECK (((channel_name)::text = ANY ((ARRAY['AIRBNB'::character varying, 'BOOKING'::character varying, 'EXPEDIA'::character varying, 'VRBO'::character varying, 'ICAL'::character varying, 'GOOGLE_VACATION_RENTALS'::character varying, 'HOMEAWAY'::character varying, 'TRIPADVISOR'::character varying, 'AGODA'::character varying, 'HOTELS_COM'::character varying, 'DIRECT'::character varying, 'BOOKING_ENGINE'::character varying, 'TRIPCOM'::character varying, 'HOMETOGO'::character varying, 'GATHERN'::character varying, 'RENTELLY'::character varying, 'KEASE'::character varying, 'STAY_SA'::character varying, 'MABEET'::character varying, 'OTHER'::character varying])::text[]))),
    CONSTRAINT channel_cancellation_policies_policy_type_check CHECK (((policy_type)::text = ANY ((ARRAY['FLEXIBLE'::character varying, 'MODERATE'::character varying, 'FIRM'::character varying, 'STRICT'::character varying, 'SUPER_STRICT'::character varying, 'NON_REFUNDABLE'::character varying, 'CUSTOM'::character varying])::text[])))
);

CREATE TABLE public.channel_commissions (
    commission_rate numeric(5,4) NOT NULL,
    is_guest_facing boolean,
    vat_rate numeric(5,4),
    created_at timestamp(6) with time zone,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    updated_at timestamp(6) with time zone,
    channel_name character varying(50) NOT NULL,
    notes text,
    CONSTRAINT channel_commissions_channel_name_check CHECK (((channel_name)::text = ANY ((ARRAY['AIRBNB'::character varying, 'BOOKING'::character varying, 'EXPEDIA'::character varying, 'VRBO'::character varying, 'ICAL'::character varying, 'GOOGLE_VACATION_RENTALS'::character varying, 'HOMEAWAY'::character varying, 'TRIPADVISOR'::character varying, 'AGODA'::character varying, 'HOTELS_COM'::character varying, 'DIRECT'::character varying, 'BOOKING_ENGINE'::character varying, 'TRIPCOM'::character varying, 'HOMETOGO'::character varying, 'GATHERN'::character varying, 'RENTELLY'::character varying, 'KEASE'::character varying, 'STAY_SA'::character varying, 'MABEET'::character varying, 'OTHER'::character varying])::text[])))
);

CREATE TABLE public.channel_content_mappings (
    bathrooms integer,
    bedrooms integer,
    max_guests integer,
    created_at timestamp(6) with time zone,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    property_id bigint NOT NULL,
    synced_at timestamp(6) with time zone,
    updated_at timestamp(6) with time zone,
    sync_status character varying(20) NOT NULL,
    channel_name character varying(50) NOT NULL,
    property_type character varying(50),
    title character varying(200),
    description text,
    external_content_id character varying(255),
    amenities jsonb,
    config jsonb,
    photo_urls jsonb,
    CONSTRAINT channel_content_mappings_channel_name_check CHECK (((channel_name)::text = ANY ((ARRAY['AIRBNB'::character varying, 'BOOKING'::character varying, 'EXPEDIA'::character varying, 'VRBO'::character varying, 'ICAL'::character varying, 'GOOGLE_VACATION_RENTALS'::character varying, 'HOMEAWAY'::character varying, 'TRIPADVISOR'::character varying, 'AGODA'::character varying, 'HOTELS_COM'::character varying, 'DIRECT'::character varying, 'BOOKING_ENGINE'::character varying, 'TRIPCOM'::character varying, 'HOMETOGO'::character varying, 'GATHERN'::character varying, 'RENTELLY'::character varying, 'KEASE'::character varying, 'STAY_SA'::character varying, 'MABEET'::character varying, 'OTHER'::character varying])::text[])))
);

CREATE TABLE public.channel_fees (
    amount numeric(10,2) NOT NULL,
    currency character varying(3) NOT NULL,
    enabled boolean NOT NULL,
    is_mandatory boolean NOT NULL,
    is_taxable boolean NOT NULL,
    created_at timestamp(6) with time zone,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    property_id bigint NOT NULL,
    synced_at timestamp(6) with time zone,
    updated_at timestamp(6) with time zone,
    sync_status character varying(20) NOT NULL,
    charge_type character varying(30) NOT NULL,
    channel_name character varying(50) NOT NULL,
    fee_type character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    external_fee_id character varying(255),
    config jsonb,
    CONSTRAINT channel_fees_channel_name_check CHECK (((channel_name)::text = ANY ((ARRAY['AIRBNB'::character varying, 'BOOKING'::character varying, 'EXPEDIA'::character varying, 'VRBO'::character varying, 'ICAL'::character varying, 'GOOGLE_VACATION_RENTALS'::character varying, 'HOMEAWAY'::character varying, 'TRIPADVISOR'::character varying, 'AGODA'::character varying, 'HOTELS_COM'::character varying, 'DIRECT'::character varying, 'BOOKING_ENGINE'::character varying, 'TRIPCOM'::character varying, 'HOMETOGO'::character varying, 'GATHERN'::character varying, 'RENTELLY'::character varying, 'KEASE'::character varying, 'STAY_SA'::character varying, 'MABEET'::character varying, 'OTHER'::character varying])::text[]))),
    CONSTRAINT channel_fees_charge_type_check CHECK (((charge_type)::text = ANY ((ARRAY['PER_STAY'::character varying, 'PER_NIGHT'::character varying, 'PER_GUEST'::character varying, 'PER_GUEST_PER_NIGHT'::character varying, 'PERCENTAGE'::character varying])::text[]))),
    CONSTRAINT channel_fees_fee_type_check CHECK (((fee_type)::text = ANY ((ARRAY['CLEANING'::character varying, 'PET'::character varying, 'RESORT'::character varying, 'LINEN'::character varying, 'EXTRA_GUEST'::character varying, 'SERVICE'::character varying, 'TAX_RECOVERY'::character varying, 'LATE_CHECKOUT'::character varying, 'EARLY_CHECKIN'::character varying, 'PARKING'::character varying, 'BREAKFAST'::character varying, 'TOWELS'::character varying, 'OTHER'::character varying])::text[])))
);

CREATE TABLE public.channel_promotions (
    discount_percentage numeric(5,2),
    enabled boolean NOT NULL,
    end_date date,
    start_date date,
    created_at timestamp(6) with time zone,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    property_id bigint NOT NULL,
    synced_at timestamp(6) with time zone,
    updated_at timestamp(6) with time zone,
    status character varying(20) NOT NULL,
    channel_name character varying(50) NOT NULL,
    promotion_type character varying(50) NOT NULL,
    external_promotion_id character varying(255),
    config jsonb,
    CONSTRAINT channel_promotions_channel_name_check CHECK (((channel_name)::text = ANY ((ARRAY['AIRBNB'::character varying, 'BOOKING'::character varying, 'EXPEDIA'::character varying, 'VRBO'::character varying, 'ICAL'::character varying, 'GOOGLE_VACATION_RENTALS'::character varying, 'HOMEAWAY'::character varying, 'TRIPADVISOR'::character varying, 'AGODA'::character varying, 'HOTELS_COM'::character varying, 'DIRECT'::character varying, 'BOOKING_ENGINE'::character varying, 'TRIPCOM'::character varying, 'HOMETOGO'::character varying, 'GATHERN'::character varying, 'RENTELLY'::character varying, 'KEASE'::character varying, 'STAY_SA'::character varying, 'MABEET'::character varying, 'OTHER'::character varying])::text[]))),
    CONSTRAINT channel_promotions_promotion_type_check CHECK (((promotion_type)::text = ANY ((ARRAY['GENIUS'::character varying, 'PREFERRED_PARTNER'::character varying, 'VISIBILITY_BOOSTER'::character varying, 'MOBILE_RATE'::character varying, 'COUNTRY_RATE'::character varying, 'EARLY_BIRD_OTA'::character varying, 'FLASH_SALE'::character varying, 'LONG_STAY_OTA'::character varying])::text[]))),
    CONSTRAINT channel_promotions_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'PENDING'::character varying, 'EXPIRED'::character varying, 'REJECTED'::character varying])::text[])))
);

CREATE TABLE public.channel_rate_modifiers (
    end_date date,
    is_active boolean NOT NULL,
    modifier_value numeric(10,2) NOT NULL,
    priority integer NOT NULL,
    start_date date,
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    property_id bigint,
    updated_at timestamp(6) without time zone,
    modifier_type character varying(20) NOT NULL,
    channel_name character varying(50) NOT NULL,
    description character varying(255),
    CONSTRAINT channel_rate_modifiers_channel_name_check CHECK (((channel_name)::text = ANY ((ARRAY['AIRBNB'::character varying, 'BOOKING'::character varying, 'EXPEDIA'::character varying, 'VRBO'::character varying, 'ICAL'::character varying, 'GOOGLE_VACATION_RENTALS'::character varying, 'HOMEAWAY'::character varying, 'TRIPADVISOR'::character varying, 'AGODA'::character varying, 'HOTELS_COM'::character varying, 'DIRECT'::character varying, 'BOOKING_ENGINE'::character varying, 'TRIPCOM'::character varying, 'HOMETOGO'::character varying, 'GATHERN'::character varying, 'RENTELLY'::character varying, 'KEASE'::character varying, 'STAY_SA'::character varying, 'MABEET'::character varying, 'OTHER'::character varying])::text[]))),
    CONSTRAINT channel_rate_modifiers_modifier_type_check CHECK (((modifier_type)::text = ANY ((ARRAY['PERCENTAGE'::character varying, 'FIXED_AMOUNT'::character varying])::text[])))
);

CREATE TABLE public.contact_attachment_files (
    created_at timestamp(6) without time zone,
    id bigint NOT NULL,
    message_id bigint NOT NULL,
    size bigint,
    attachment_id character varying(36) NOT NULL,
    content_type character varying(100),
    original_name character varying(500),
    data bytea NOT NULL
);

CREATE TABLE public.conversation_messages (
    conversation_id bigint NOT NULL,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    read_at timestamp(6) without time zone,
    sent_at timestamp(6) without time zone NOT NULL,
    direction character varying(10) NOT NULL,
    channel_source character varying(20) NOT NULL,
    delivery_status character varying(20),
    sender_identifier character varying(500),
    content text,
    content_html text,
    external_message_id character varying(255),
    sender_name character varying(255),
    attachments jsonb,
    metadata jsonb,
    CONSTRAINT conversation_messages_channel_source_check CHECK (((channel_source)::text = ANY ((ARRAY['AIRBNB'::character varying, 'BOOKING'::character varying, 'WHATSAPP'::character varying, 'EMAIL'::character varying, 'SMS'::character varying, 'INTERNAL'::character varying])::text[]))),
    CONSTRAINT conversation_messages_direction_check CHECK (((direction)::text = ANY ((ARRAY['INBOUND'::character varying, 'OUTBOUND'::character varying])::text[])))
);

CREATE TABLE public.conversations (
    message_count integer NOT NULL,
    unread boolean NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    guest_id bigint,
    id bigint NOT NULL,
    last_message_at timestamp(6) without time zone,
    organization_id bigint NOT NULL,
    property_id bigint,
    reservation_id bigint,
    updated_at timestamp(6) without time zone NOT NULL,
    channel character varying(20) NOT NULL,
    status character varying(20) NOT NULL,
    subject character varying(500),
    assigned_to_keycloak_id character varying(255),
    external_conversation_id character varying(255),
    last_message_preview text,
    CONSTRAINT conversations_channel_check CHECK (((channel)::text = ANY ((ARRAY['AIRBNB'::character varying, 'BOOKING'::character varying, 'WHATSAPP'::character varying, 'EMAIL'::character varying, 'SMS'::character varying, 'INTERNAL'::character varying])::text[]))),
    CONSTRAINT conversations_status_check CHECK (((status)::text = ANY ((ARRAY['OPEN'::character varying, 'CLOSED'::character varying, 'ARCHIVED'::character varying])::text[])))
);

CREATE TABLE public.device_tokens (
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    organization_id bigint,
    updated_at timestamp(6) without time zone,
    platform character varying(10) NOT NULL,
    token character varying(512) NOT NULL,
    user_id character varying(255) NOT NULL
);

CREATE TABLE public.direct_booking_configs (
    auto_confirm boolean NOT NULL,
    enabled boolean NOT NULL,
    require_payment boolean NOT NULL,
    widget_theme_color character varying(7),
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    property_id bigint NOT NULL,
    updated_at timestamp(6) without time zone,
    allowed_currencies character varying(100),
    cancellation_policy_text text,
    confirmation_email_template text,
    custom_css text,
    terms_and_conditions_url character varying(255),
    widget_logo character varying(255)
);

CREATE TABLE public.escrow_holds (
    amount numeric(12,2) NOT NULL,
    currency character varying(3) NOT NULL,
    created_at timestamp(6) without time zone,
    held_at timestamp(6) without time zone,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    release_at timestamp(6) without time zone,
    released_at timestamp(6) without time zone,
    reservation_id bigint,
    transaction_id bigint,
    updated_at timestamp(6) without time zone,
    status character varying(20) NOT NULL,
    release_trigger character varying(30),
    CONSTRAINT escrow_holds_status_check CHECK (((status)::text = ANY ((ARRAY['HELD'::character varying, 'RELEASED'::character varying, 'REFUNDED'::character varying, 'EXPIRED'::character varying])::text[])))
);

CREATE TABLE public.exchange_rates (
    base_currency character varying(3) NOT NULL,
    rate numeric(12,6) NOT NULL,
    rate_date date NOT NULL,
    target_currency character varying(3) NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    source character varying(30)
);

CREATE TABLE public.expedia_connections (
    connected_at timestamp(6) without time zone NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    last_sync_at timestamp(6) without time zone,
    organization_id bigint NOT NULL,
    updated_at timestamp(6) without time zone,
    status character varying(20) NOT NULL,
    property_id character varying(100) NOT NULL,
    api_key_encrypted text NOT NULL,
    api_secret_encrypted text NOT NULL,
    error_message character varying(255),
    CONSTRAINT expedia_connections_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying, 'ERROR'::character varying])::text[])))
);

CREATE TABLE public.external_pricing_configs (
    currency character varying(3),
    enabled boolean NOT NULL,
    sync_interval_hours integer,
    created_at timestamp(6) with time zone,
    id bigint NOT NULL,
    last_sync_at timestamp(6) with time zone,
    organization_id bigint NOT NULL,
    updated_at timestamp(6) with time zone,
    provider character varying(30) NOT NULL,
    api_key text,
    api_url character varying(255),
    property_mappings jsonb,
    CONSTRAINT external_pricing_configs_provider_check CHECK (((provider)::text = ANY ((ARRAY['PRICELABS'::character varying, 'BEYOND_PRICING'::character varying, 'WHEELHOUSE'::character varying])::text[])))
);

CREATE TABLE public.fiscal_profiles (
    country_code character varying(3) NOT NULL,
    default_currency character varying(3) NOT NULL,
    vat_registered boolean NOT NULL,
    invoice_language character varying(5),
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    updated_at timestamp(6) without time zone,
    invoice_prefix character varying(10),
    vat_declaration_frequency character varying(15),
    fiscal_regime character varying(30) NOT NULL,
    vat_number character varying(30),
    tax_id_number character varying(50),
    legal_entity_name character varying(200),
    legal_address text,
    legal_mentions text,
    CONSTRAINT fiscal_profiles_fiscal_regime_check CHECK (((fiscal_regime)::text = ANY ((ARRAY['STANDARD'::character varying, 'MICRO_ENTERPRISE'::character varying, 'SIMPLIFIED'::character varying])::text[])))
);

CREATE TABLE public.google_vr_connections (
    connected_at timestamp(6) without time zone NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    last_sync_at timestamp(6) without time zone,
    organization_id bigint NOT NULL,
    updated_at timestamp(6) without time zone,
    status character varying(20) NOT NULL,
    partner_id character varying(100) NOT NULL,
    service_account_key_path character varying(500),
    error_message character varying(255),
    CONSTRAINT google_vr_connections_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying, 'ERROR'::character varying])::text[])))
);

CREATE TABLE public.guest_reviews (
    is_public boolean,
    rating integer NOT NULL,
    review_date date NOT NULL,
    sentiment_score double precision,
    created_at timestamp(6) with time zone,
    host_responded_at timestamp(6) with time zone,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    property_id bigint NOT NULL,
    reservation_id bigint,
    synced_at timestamp(6) with time zone,
    updated_at timestamp(6) with time zone,
    language character varying(10),
    sentiment_label character varying(20),
    channel_name character varying(50) NOT NULL,
    external_review_id character varying(255),
    guest_name character varying(255),
    host_response text,
    review_text text,
    tags jsonb,
    CONSTRAINT guest_reviews_channel_name_check CHECK (((channel_name)::text = ANY ((ARRAY['AIRBNB'::character varying, 'BOOKING'::character varying, 'EXPEDIA'::character varying, 'VRBO'::character varying, 'ICAL'::character varying, 'GOOGLE_VACATION_RENTALS'::character varying, 'HOMEAWAY'::character varying, 'TRIPADVISOR'::character varying, 'AGODA'::character varying, 'HOTELS_COM'::character varying, 'DIRECT'::character varying, 'BOOKING_ENGINE'::character varying, 'TRIPCOM'::character varying, 'HOMETOGO'::character varying, 'GATHERN'::character varying, 'RENTELLY'::character varying, 'KEASE'::character varying, 'STAY_SA'::character varying, 'MABEET'::character varying, 'OTHER'::character varying])::text[]))),
    CONSTRAINT guest_reviews_sentiment_label_check CHECK (((sentiment_label)::text = ANY ((ARRAY['POSITIVE'::character varying, 'NEUTRAL'::character varying, 'NEGATIVE'::character varying])::text[])))
);

CREATE TABLE public.homeaway_connections (
    connected_at timestamp(6) without time zone NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    last_sync_at timestamp(6) without time zone,
    organization_id bigint NOT NULL,
    token_expires_at timestamp(6) without time zone,
    updated_at timestamp(6) without time zone,
    status character varying(20) NOT NULL,
    access_token_encrypted text NOT NULL,
    error_message character varying(255),
    listing_id character varying(255),
    refresh_token_encrypted text,
    CONSTRAINT homeaway_connections_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying, 'EXPIRED'::character varying, 'ERROR'::character varying])::text[])))
);

CREATE TABLE public.hotelscom_connections (
    connected_at timestamp(6) without time zone NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    last_sync_at timestamp(6) without time zone,
    organization_id bigint NOT NULL,
    updated_at timestamp(6) without time zone,
    status character varying(20) NOT NULL,
    api_key_encrypted text NOT NULL,
    api_secret_encrypted text,
    error_message character varying(255),
    property_id character varying(255) NOT NULL,
    CONSTRAINT hotelscom_connections_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying, 'ERROR'::character varying])::text[])))
);

CREATE TABLE public.ical_feeds (
    auto_create_interventions boolean NOT NULL,
    events_imported integer NOT NULL,
    sync_enabled boolean NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    last_sync_at timestamp(6) without time zone,
    property_id bigint,
    updated_at timestamp(6) without time zone,
    last_sync_status character varying(20),
    source_name character varying(50) NOT NULL,
    url character varying(1000) NOT NULL,
    last_sync_error text
);

CREATE TABLE public.integration_partners (
    connected_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone,
    id bigint NOT NULL,
    last_sync_at timestamp(6) with time zone,
    organization_id bigint NOT NULL,
    updated_at timestamp(6) with time zone,
    status character varying(20) NOT NULL,
    category character varying(30) NOT NULL,
    partner_slug character varying(50) NOT NULL,
    partner_name character varying(100) NOT NULL,
    api_key_encrypted character varying(255),
    config jsonb,
    description text,
    logo_url character varying(255),
    website_url character varying(255),
    CONSTRAINT integration_partners_category_check CHECK (((category)::text = ANY ((ARRAY['PRICING'::character varying, 'KEY_MANAGEMENT'::character varying, 'CLEANING'::character varying, 'ACCOUNTING'::character varying, 'GUEST_SCREENING'::character varying, 'HOME_AUTOMATION'::character varying, 'INSURANCE'::character varying, 'ANALYTICS'::character varying])::text[]))),
    CONSTRAINT integration_partners_status_check CHECK (((status)::text = ANY ((ARRAY['AVAILABLE'::character varying, 'CONNECTED'::character varying, 'DISCONNECTED'::character varying, 'ERROR'::character varying])::text[])))
);

CREATE TABLE public.interventions (
    actual_cost numeric(10,2),
    actual_duration_minutes integer,
    currency character varying(3) DEFAULT 'EUR'::character varying NOT NULL,
    customer_rating integer,
    estimated_cost numeric(10,2),
    estimated_duration_hours integer,
    is_urgent boolean,
    progress_percentage integer,
    requires_follow_up boolean,
    assigned_technician_id bigint,
    assigned_user_id bigint,
    completed_at timestamp(6) without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    end_time timestamp(6) without time zone,
    guest_checkin_time timestamp(6) without time zone,
    guest_checkout_time timestamp(6) without time zone,
    id bigint NOT NULL,
    paid_at timestamp(6) without time zone,
    property_id bigint NOT NULL,
    requestor_id bigint NOT NULL,
    scheduled_date timestamp(6) without time zone NOT NULL,
    service_request_id bigint NOT NULL,
    start_time timestamp(6) without time zone,
    team_id bigint,
    updated_at timestamp(6) without time zone,
    payment_status character varying(50),
    priority character varying(50) NOT NULL,
    status character varying(50) NOT NULL,
    type character varying(50) NOT NULL,
    access_notes text,
    after_photos_urls text,
    before_photos_urls text,
    customer_feedback character varying(255),
    description text,
    follow_up_notes character varying(255),
    materials_used character varying(255),
    notes text,
    photos text,
    preferred_time_slot character varying(255),
    special_instructions text,
    stripe_payment_intent_id character varying(255),
    stripe_session_id character varying(255),
    technician_notes character varying(255),
    title character varying(255) NOT NULL,
    CONSTRAINT interventions_payment_status_check CHECK (((payment_status)::text = ANY ((ARRAY['PENDING'::character varying, 'PROCESSING'::character varying, 'PARTIALLY_PAID'::character varying, 'PAID'::character varying, 'FAILED'::character varying, 'REFUNDED'::character varying, 'CANCELLED'::character varying, 'NOT_REQUIRED'::character varying])::text[])))
);

CREATE TABLE public.invoice_lines (
    line_number integer NOT NULL,
    quantity numeric(10,3) NOT NULL,
    tax_amount numeric(10,2) NOT NULL,
    tax_rate numeric(5,4) NOT NULL,
    total_ht numeric(10,2) NOT NULL,
    total_ttc numeric(10,2) NOT NULL,
    unit_price_ht numeric(10,2) NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    invoice_id bigint NOT NULL,
    tax_category character varying(30) NOT NULL,
    description character varying(500) NOT NULL
);

CREATE TABLE public.invoice_number_sequences (
    current_year integer NOT NULL,
    last_number integer NOT NULL,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    prefix character varying(10) NOT NULL
);

CREATE TABLE public.invoices (
    country_code character varying(3) NOT NULL,
    currency character varying(3) NOT NULL,
    due_date date,
    invoice_date date NOT NULL,
    total_ht numeric(12,2) NOT NULL,
    total_tax numeric(12,2) NOT NULL,
    total_ttc numeric(12,2) NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    document_generation_id bigint,
    duplicate_of_id bigint,
    id bigint NOT NULL,
    intervention_id bigint,
    organization_id bigint NOT NULL,
    overdue_notified_at timestamp(6) without time zone,
    paid_at timestamp(6) without time zone,
    payment_reminder_sent_at timestamp(6) without time zone,
    payment_transaction_id bigint,
    payout_id bigint,
    reservation_id bigint,
    updated_at timestamp(6) without time zone,
    status character varying(20) NOT NULL,
    invoice_number character varying(30) NOT NULL,
    payment_method character varying(30),
    buyer_tax_id character varying(50),
    seller_tax_id character varying(50),
    buyer_name character varying(200),
    seller_name character varying(200),
    buyer_address text,
    legal_mentions text,
    qr_code_data text,
    seller_address text,
    xml_content text,
    CONSTRAINT invoices_status_check CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'SENT'::character varying, 'ISSUED'::character varying, 'PAID'::character varying, 'OVERDUE'::character varying, 'CANCELLED'::character varying, 'CREDIT_NOTE'::character varying])::text[])))
);

CREATE TABLE public.key_exchange_codes (
    collected_at timestamp(6) without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    point_id bigint NOT NULL,
    property_id bigint NOT NULL,
    reservation_id bigint,
    returned_at timestamp(6) without time zone,
    updated_at timestamp(6) without time zone,
    valid_from timestamp(6) without time zone,
    valid_until timestamp(6) without time zone,
    code_type character varying(20) NOT NULL,
    status character varying(20) NOT NULL,
    code character varying(100) NOT NULL,
    provider_code_id character varying(100),
    guest_name character varying(255),
    CONSTRAINT key_exchange_codes_code_type_check CHECK (((code_type)::text = ANY ((ARRAY['COLLECTION'::character varying, 'DROP_OFF'::character varying])::text[]))),
    CONSTRAINT key_exchange_codes_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'USED'::character varying, 'EXPIRED'::character varying, 'CANCELLED'::character varying])::text[])))
);

CREATE TABLE public.key_exchange_events (
    code_id bigint,
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    organization_id bigint,
    point_id bigint,
    property_id bigint NOT NULL,
    source character varying(20) NOT NULL,
    event_type character varying(30) NOT NULL,
    actor_name character varying(255),
    notes text,
    CONSTRAINT key_exchange_events_event_type_check CHECK (((event_type)::text = ANY ((ARRAY['KEY_DEPOSITED'::character varying, 'KEY_COLLECTED'::character varying, 'KEY_RETURNED'::character varying, 'CODE_GENERATED'::character varying, 'CODE_CANCELLED'::character varying, 'CODE_EXPIRED'::character varying])::text[]))),
    CONSTRAINT key_exchange_events_source_check CHECK (((source)::text = ANY ((ARRAY['MANUAL'::character varying, 'WEBHOOK'::character varying, 'API_POLL'::character varying, 'PUBLIC_PAGE'::character varying])::text[])))
);

CREATE TABLE public.key_exchange_points (
    store_lat double precision,
    store_lng double precision,
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    property_id bigint NOT NULL,
    updated_at timestamp(6) without time zone,
    guardian_type character varying(20),
    provider character varying(20) NOT NULL,
    status character varying(20) NOT NULL,
    store_phone character varying(50),
    provider_store_id character varying(100),
    verification_token character varying(100),
    config_json text,
    store_address text,
    store_name character varying(255) NOT NULL,
    store_opening_hours text,
    user_id character varying(255) NOT NULL,
    CONSTRAINT key_exchange_points_guardian_type_check CHECK (((guardian_type)::text = ANY ((ARRAY['MERCHANT'::character varying, 'INDIVIDUAL'::character varying])::text[]))),
    CONSTRAINT key_exchange_points_provider_check CHECK (((provider)::text = ANY ((ARRAY['KEYNEST'::character varying, 'CLENZY_KEYVAULT'::character varying])::text[]))),
    CONSTRAINT key_exchange_points_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[])))
);

CREATE TABLE public.ledger_entries (
    amount numeric(12,2) NOT NULL,
    balance_after numeric(12,2) NOT NULL,
    currency character varying(3) NOT NULL,
    counterpart_entry_id bigint,
    created_at timestamp(6) without time zone,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    wallet_id bigint NOT NULL,
    entry_type character varying(10) NOT NULL,
    reference_type character varying(30) NOT NULL,
    reference_id character varying(100) NOT NULL,
    description character varying(500),
    CONSTRAINT ledger_entries_entry_type_check CHECK (((entry_type)::text = ANY ((ARRAY['DEBIT'::character varying, 'CREDIT'::character varying])::text[]))),
    CONSTRAINT ledger_entries_reference_type_check CHECK (((reference_type)::text = ANY ((ARRAY['PAYMENT'::character varying, 'ESCROW_HOLD'::character varying, 'ESCROW_RELEASE'::character varying, 'SPLIT'::character varying, 'REFUND'::character varying, 'PAYOUT'::character varying, 'ADJUSTMENT'::character varying, 'UPSELL'::character varying, 'COMMISSION'::character varying])::text[])))
);

CREATE TABLE public.length_of_stay_discounts (
    discount_value numeric(10,2) NOT NULL,
    end_date date,
    is_active boolean NOT NULL,
    max_nights integer,
    min_nights integer NOT NULL,
    start_date date,
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    property_id bigint,
    updated_at timestamp(6) without time zone,
    discount_type character varying(20) NOT NULL,
    CONSTRAINT length_of_stay_discounts_discount_type_check CHECK (((discount_type)::text = ANY ((ARRAY['PERCENTAGE'::character varying, 'FIXED_PER_NIGHT'::character varying])::text[])))
);

CREATE TABLE public.management_contracts (
    auto_renew boolean,
    cleaning_fee_included boolean,
    commission_rate numeric(5,4) NOT NULL,
    end_date date,
    maintenance_included boolean,
    minimum_stay_nights integer,
    notice_period_days integer,
    start_date date NOT NULL,
    created_at timestamp(6) with time zone,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    owner_id bigint NOT NULL,
    property_id bigint NOT NULL,
    signed_at timestamp(6) with time zone,
    terminated_at timestamp(6) with time zone,
    updated_at timestamp(6) with time zone,
    status character varying(20) NOT NULL,
    contract_type character varying(30) NOT NULL,
    contract_number character varying(50),
    notes text,
    termination_reason text,
    CONSTRAINT management_contracts_contract_type_check CHECK (((contract_type)::text = ANY ((ARRAY['FULL_MANAGEMENT'::character varying, 'BOOKING_ONLY'::character varying, 'MAINTENANCE_ONLY'::character varying, 'CUSTOM'::character varying])::text[]))),
    CONSTRAINT management_contracts_status_check CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'ACTIVE'::character varying, 'SUSPENDED'::character varying, 'TERMINATED'::character varying, 'EXPIRED'::character varying])::text[])))
);

CREATE TABLE public.migration_jobs (
    failed_records integer,
    processed_records integer,
    total_records integer,
    completed_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    started_at timestamp(6) with time zone,
    data_type character varying(20) NOT NULL,
    source character varying(30) NOT NULL,
    status character varying(30) NOT NULL,
    error_log text,
    source_api_key character varying(255),
    source_config jsonb,
    CONSTRAINT migration_jobs_data_type_check CHECK (((data_type)::text = ANY ((ARRAY['PROPERTIES'::character varying, 'RESERVATIONS'::character varying, 'GUESTS'::character varying, 'RATES'::character varying, 'AVAILABILITY'::character varying, 'ALL'::character varying])::text[]))),
    CONSTRAINT migration_jobs_source_check CHECK (((source)::text = ANY ((ARRAY['LODGIFY'::character varying, 'GUESTY'::character varying, 'HOSTAWAY'::character varying, 'BEDS24'::character varying, 'SMOOBU'::character varying, 'HOSPITABLE'::character varying, 'CSV_IMPORT'::character varying])::text[]))),
    CONSTRAINT migration_jobs_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'IN_PROGRESS'::character varying, 'COMPLETED'::character varying, 'FAILED'::character varying, 'PARTIALLY_COMPLETED'::character varying])::text[])))
);

CREATE TABLE public.notifications (
    is_read boolean NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    id bigint NOT NULL,
    updated_at timestamp(6) with time zone,
    type character varying(20) NOT NULL,
    category character varying(30) NOT NULL,
    title character varying(200) NOT NULL,
    action_url character varying(255),
    message text NOT NULL,
    user_id character varying(255) NOT NULL,
    CONSTRAINT notifications_type_check CHECK (((type)::text = ANY ((ARRAY['INFO'::character varying, 'SUCCESS'::character varying, 'WARNING'::character varying, 'ERROR'::character varying])::text[])))
);

CREATE TABLE public.occupancy_pricing (
    base_occupancy integer NOT NULL,
    child_discount numeric(5,2),
    extra_guest_fee numeric(10,2) NOT NULL,
    is_active boolean NOT NULL,
    max_occupancy integer NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    property_id bigint NOT NULL,
    updated_at timestamp(6) without time zone
);

CREATE TABLE public.online_checkins (
    number_of_guests integer,
    completed_at timestamp(6) without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    expires_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    reservation_id bigint NOT NULL,
    started_at timestamp(6) without time zone,
    updated_at timestamp(6) without time zone NOT NULL,
    estimated_arrival_time character varying(10),
    token uuid NOT NULL,
    status character varying(20) NOT NULL,
    id_document_type character varying(50),
    email character varying(500),
    first_name character varying(500),
    id_document_number character varying(500),
    last_name character varying(500),
    phone character varying(500),
    id_document_file_path character varying(1000),
    special_requests text,
    additional_guests jsonb,
    CONSTRAINT online_checkins_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'STARTED'::character varying, 'COMPLETED'::character varying, 'EXPIRED'::character varying])::text[])))
);

CREATE TABLE public.owner_payouts (
    commission_amount numeric(10,2) NOT NULL,
    commission_rate numeric(5,4) NOT NULL,
    currency character varying(3) DEFAULT 'EUR'::character varying NOT NULL,
    expenses numeric(10,2),
    gross_revenue numeric(10,2) NOT NULL,
    net_amount numeric(10,2) NOT NULL,
    period_end date NOT NULL,
    period_start date NOT NULL,
    created_at timestamp(6) with time zone,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    owner_id bigint NOT NULL,
    paid_at timestamp(6) with time zone,
    updated_at timestamp(6) with time zone,
    status character varying(20) NOT NULL,
    notes text,
    payment_reference character varying(255)
);

CREATE TABLE public.payment_method_configs (
    enabled boolean NOT NULL,
    sandbox_mode boolean,
    created_at timestamp(6) without time zone,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    updated_at timestamp(6) without time zone,
    provider_type character varying(30) NOT NULL,
    country_codes character varying(100),
    api_key_encrypted text,
    api_secret_encrypted text,
    webhook_secret_encrypted text,
    config_json jsonb,
    CONSTRAINT payment_method_configs_provider_type_check CHECK (((provider_type)::text = ANY ((ARRAY['STRIPE'::character varying, 'PAYTABS'::character varying, 'CMI'::character varying, 'PAYZONE'::character varying, 'PAYPAL'::character varying])::text[])))
);

CREATE TABLE public.payment_transactions (
    amount numeric(12,2) NOT NULL,
    currency character varying(3) NOT NULL,
    created_at timestamp(6) without time zone,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    source_id bigint,
    updated_at timestamp(6) without time zone,
    status character varying(20) NOT NULL,
    payment_type character varying(30) NOT NULL,
    provider_type character varying(30) NOT NULL,
    source_type character varying(30),
    transaction_ref character varying(64) NOT NULL,
    idempotency_key character varying(100),
    error_message text,
    provider_tx_id character varying(255),
    metadata jsonb,
    CONSTRAINT payment_transactions_payment_type_check CHECK (((payment_type)::text = ANY ((ARRAY['CHECKOUT'::character varying, 'CAPTURE'::character varying, 'REFUND'::character varying, 'PAYOUT'::character varying, 'TRANSFER'::character varying])::text[]))),
    CONSTRAINT payment_transactions_provider_type_check CHECK (((provider_type)::text = ANY ((ARRAY['STRIPE'::character varying, 'PAYTABS'::character varying, 'CMI'::character varying, 'PAYZONE'::character varying, 'PAYPAL'::character varying])::text[]))),
    CONSTRAINT payment_transactions_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'PROCESSING'::character varying, 'COMPLETED'::character varying, 'FAILED'::character varying, 'CANCELLED'::character varying, 'REFUNDED'::character varying])::text[])))
);

CREATE TABLE public.pending_inscriptions (
    guest_capacity integer,
    property_count integer,
    surface integer,
    created_at timestamp(6) without time zone NOT NULL,
    expires_at timestamp(6) without time zone,
    id bigint NOT NULL,
    services character varying(500),
    services_devis character varying(500),
    booking_frequency character varying(255),
    calendar_sync character varying(255),
    city character varying(255),
    cleaning_schedule character varying(255),
    company_name character varying(255),
    email character varying(255) NOT NULL,
    first_name character varying(255) NOT NULL,
    forfait character varying(255) NOT NULL,
    last_name character varying(255) NOT NULL,
    password character varying(255),
    phone_number character varying(255),
    postal_code character varying(255),
    property_type character varying(255),
    status character varying(255) NOT NULL,
    stripe_session_id character varying(255),
    CONSTRAINT pending_inscriptions_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING_PAYMENT'::character varying, 'PAYMENT_CONFIRMED'::character varying, 'COMPLETED'::character varying, 'PAYMENT_FAILED'::character varying, 'EXPIRED'::character varying])::text[])))
);

CREATE TABLE public.permissions (
    category character varying(255),
    created_at timestamp(6) without time zone,
    id bigint NOT NULL,
    updated_at timestamp(6) without time zone,
    module character varying(50),
    name character varying(100) NOT NULL,
    description character varying(255)
);

CREATE TABLE public.pricing_configs (
    user_id bigint,
    automation_basic_surcharge integer,
    automation_full_surcharge integer,
    base_price_confort integer,
    base_price_essentiel integer,
    base_price_premium integer,
    min_price integer,
    pms_free_seats integer,
    pms_monthly_price_cents integer,
    pms_per_seat_price_cents integer,
    pms_sync_price_cents integer,
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    updated_at timestamp(6) without time zone,
    frequency_coeffs text,
    guest_capacity_coeffs text,
    property_count_coeffs text,
    property_type_coeffs text,
    surface_tiers text
);

CREATE TABLE public.promo_codes (
    active boolean NOT NULL,
    current_uses integer NOT NULL,
    discount_value numeric(10,2) NOT NULL,
    max_uses integer,
    min_nights integer,
    valid_from date,
    valid_until date,
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    property_id bigint,
    updated_at timestamp(6) without time zone,
    discount_type character varying(20) NOT NULL,
    code character varying(50) NOT NULL,
    CONSTRAINT promo_codes_discount_type_check CHECK (((discount_type)::text = ANY ((ARRAY['PERCENTAGE'::character varying, 'FIXED_AMOUNT'::character varying])::text[])))
);

CREATE TABLE public.properties (
    bathroom_count integer NOT NULL,
    bedroom_count integer NOT NULL,
    booking_engine_visible boolean NOT NULL,
    cleaning_base_price numeric(10,2),
    cleaning_duration_minutes integer,
    default_currency character varying(3) DEFAULT 'EUR'::character varying NOT NULL,
    has_exterior boolean,
    has_laundry boolean,
    latitude numeric(38,2),
    longitude numeric(38,2),
    maintenance_contract boolean,
    max_guests integer,
    minimum_nights integer,
    nightly_price numeric(10,2),
    number_of_floors integer,
    square_meters integer,
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    owner_id bigint NOT NULL,
    updated_at timestamp(6) without time zone,
    access_instructions text,
    address character varying(255) NOT NULL,
    airbnb_listing_id character varying(255),
    airbnb_url character varying(255),
    city character varying(255),
    cleaning_frequency character varying(255),
    cleaning_notes text,
    country character varying(255),
    description text,
    emergency_contact character varying(255),
    emergency_phone character varying(255),
    name character varying(255) NOT NULL,
    postal_code character varying(255),
    special_requirements text,
    status character varying(255) NOT NULL,
    type character varying(255) NOT NULL,
    CONSTRAINT properties_cleaning_frequency_check CHECK (((cleaning_frequency)::text = ANY ((ARRAY['AFTER_EACH_STAY'::character varying, 'WEEKLY'::character varying, 'BIWEEKLY'::character varying, 'MONTHLY'::character varying, 'ON_DEMAND'::character varying])::text[]))),
    CONSTRAINT properties_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying, 'UNDER_MAINTENANCE'::character varying, 'ARCHIVED'::character varying])::text[]))),
    CONSTRAINT properties_type_check CHECK (((type)::text = ANY ((ARRAY['APARTMENT'::character varying, 'HOUSE'::character varying, 'STUDIO'::character varying, 'VILLA'::character varying, 'LOFT'::character varying, 'DUPLEX'::character varying, 'TOWNHOUSE'::character varying, 'BUNGALOW'::character varying, 'RIAD'::character varying, 'GUEST_ROOM'::character varying, 'COTTAGE'::character varying, 'CHALET'::character varying, 'BOAT'::character varying, 'OTHER'::character varying])::text[])))
);

CREATE TABLE public.prospects (
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    updated_at timestamp(6) without time zone,
    employees character varying(50),
    revenue character varying(100),
    linked_in character varying(500),
    website character varying(500),
    category character varying(255) NOT NULL,
    city character varying(255),
    email character varying(255),
    name character varying(255) NOT NULL,
    notes text,
    phone character varying(255),
    specialty character varying(255),
    status character varying(255) NOT NULL,
    CONSTRAINT prospects_category_check CHECK (((category)::text = ANY ((ARRAY['CONCIERGERIES'::character varying, 'MENAGE'::character varying, 'ARTISANS'::character varying, 'ENTRETIEN'::character varying, 'BLANCHISSERIES'::character varying])::text[]))),
    CONSTRAINT prospects_status_check CHECK (((status)::text = ANY ((ARRAY['TO_CONTACT'::character varying, 'IN_DISCUSSION'::character varying, 'PARTNER'::character varying, 'REJECTED'::character varying])::text[])))
);

CREATE TABLE public.regulatory_configs (
    country_code character varying(2),
    is_enabled boolean,
    max_days_per_year integer,
    created_at timestamp(6) with time zone,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    property_id bigint NOT NULL,
    updated_at timestamp(6) with time zone,
    city_code character varying(10),
    regulatory_type character varying(30) NOT NULL,
    registration_number character varying(50),
    notes text,
    CONSTRAINT regulatory_configs_regulatory_type_check CHECK (((regulatory_type)::text = ANY ((ARRAY['ALUR_120_DAYS'::character varying, 'REGISTRATION_NUMBER'::character varying, 'POLICE_FORM'::character varying, 'INSURANCE_CHECK'::character varying, 'BAIL_MOBILITE'::character varying])::text[])))
);

CREATE TABLE public.request_comments (
    author_id bigint NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    service_request_id bigint NOT NULL,
    content text NOT NULL
);

CREATE TABLE public.request_photos (
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    service_request_id bigint NOT NULL,
    caption character varying(255),
    url character varying(255) NOT NULL
);

CREATE TABLE public.review_auto_responses (
    is_active boolean,
    max_rating integer,
    min_rating integer,
    created_at timestamp(6) with time zone,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    language character varying(10),
    sentiment_filter character varying(20),
    response_template text NOT NULL,
    template_name character varying(255) NOT NULL,
    CONSTRAINT review_auto_responses_sentiment_filter_check CHECK (((sentiment_filter)::text = ANY ((ARRAY['POSITIVE'::character varying, 'NEUTRAL'::character varying, 'NEGATIVE'::character varying])::text[])))
);

CREATE TABLE public.role_permissions (
    is_active boolean,
    is_default boolean,
    created_at timestamp(6) without time zone,
    id bigint NOT NULL,
    permission_id bigint NOT NULL,
    role_id bigint NOT NULL,
    updated_at timestamp(6) without time zone
);

CREATE TABLE public.roles (
    created_at timestamp(6) without time zone,
    id bigint NOT NULL,
    updated_at timestamp(6) without time zone,
    name character varying(50) NOT NULL,
    display_name character varying(100) NOT NULL,
    description character varying(255)
);

CREATE TABLE public.service_requests (
    actual_cost numeric(38,2),
    estimated_cost numeric(38,2),
    estimated_duration_hours integer,
    is_urgent boolean,
    assigned_to_id bigint,
    created_at timestamp(6) without time zone NOT NULL,
    desired_date timestamp(6) without time zone NOT NULL,
    guest_checkin_time timestamp(6) without time zone,
    guest_checkout_time timestamp(6) without time zone,
    id bigint NOT NULL,
    paid_at timestamp(6) without time zone,
    property_id bigint NOT NULL,
    reservation_id bigint,
    updated_at timestamp(6) without time zone,
    user_id bigint NOT NULL,
    assigned_to_type character varying(10),
    payment_status character varying(20),
    access_notes text,
    description text,
    preferred_time_slot character varying(255),
    priority character varying(255) NOT NULL,
    service_type character varying(255) NOT NULL,
    special_instructions text,
    status character varying(255) NOT NULL,
    stripe_session_id character varying(255),
    title character varying(255) NOT NULL,
    CONSTRAINT service_requests_payment_status_check CHECK (((payment_status)::text = ANY ((ARRAY['PENDING'::character varying, 'PROCESSING'::character varying, 'PARTIALLY_PAID'::character varying, 'PAID'::character varying, 'FAILED'::character varying, 'REFUNDED'::character varying, 'CANCELLED'::character varying, 'NOT_REQUIRED'::character varying])::text[]))),
    CONSTRAINT service_requests_priority_check CHECK (((priority)::text = ANY ((ARRAY['LOW'::character varying, 'NORMAL'::character varying, 'HIGH'::character varying, 'CRITICAL'::character varying])::text[]))),
    CONSTRAINT service_requests_service_type_check CHECK (((service_type)::text = ANY ((ARRAY['CLEANING'::character varying, 'EXPRESS_CLEANING'::character varying, 'DEEP_CLEANING'::character varying, 'WINDOW_CLEANING'::character varying, 'FLOOR_CLEANING'::character varying, 'KITCHEN_CLEANING'::character varying, 'BATHROOM_CLEANING'::character varying, 'PREVENTIVE_MAINTENANCE'::character varying, 'EMERGENCY_REPAIR'::character varying, 'ELECTRICAL_REPAIR'::character varying, 'PLUMBING_REPAIR'::character varying, 'HVAC_REPAIR'::character varying, 'APPLIANCE_REPAIR'::character varying, 'GARDENING'::character varying, 'EXTERIOR_CLEANING'::character varying, 'PEST_CONTROL'::character varying, 'DISINFECTION'::character varying, 'RESTORATION'::character varying, 'OTHER'::character varying])::text[])))
);

CREATE TABLE public.smart_lock_devices (
    battery_level integer,
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    property_id bigint NOT NULL,
    updated_at timestamp(6) without time zone,
    lock_state character varying(20),
    status character varying(20) NOT NULL,
    external_device_id character varying(255),
    name character varying(255) NOT NULL,
    room_name character varying(255),
    user_id character varying(255) NOT NULL,
    CONSTRAINT smart_lock_devices_lock_state_check CHECK (((lock_state)::text = ANY ((ARRAY['LOCKED'::character varying, 'UNLOCKED'::character varying, 'UNKNOWN'::character varying])::text[]))),
    CONSTRAINT smart_lock_devices_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying, 'PENDING'::character varying])::text[])))
);

CREATE TABLE public.split_configurations (
    active boolean,
    concierge_share numeric(5,4) NOT NULL,
    is_default boolean,
    owner_share numeric(5,4) NOT NULL,
    platform_share numeric(5,4) NOT NULL,
    created_at timestamp(6) without time zone,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    updated_at timestamp(6) without time zone,
    name character varying(100) NOT NULL
);

CREATE TABLE public.team_members (
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    team_id bigint NOT NULL,
    updated_at timestamp(6) without time zone,
    user_id bigint NOT NULL,
    role character varying(50) NOT NULL
);

CREATE TABLE public.teams (
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    updated_at timestamp(6) without time zone,
    intervention_type character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(500)
);

CREATE TABLE public.tourist_tax_configs (
    children_exempt_under integer,
    enabled boolean NOT NULL,
    max_nights integer,
    percentage_rate numeric(5,4),
    rate_per_person numeric(6,2),
    created_at timestamp(6) with time zone,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    property_id bigint NOT NULL,
    updated_at timestamp(6) with time zone,
    commune_code character varying(10),
    calculation_mode character varying(30) NOT NULL,
    commune_name character varying(255) NOT NULL,
    CONSTRAINT tourist_tax_configs_calculation_mode_check CHECK (((calculation_mode)::text = ANY ((ARRAY['PER_PERSON_PER_NIGHT'::character varying, 'PERCENTAGE_OF_RATE'::character varying, 'FLAT_PER_NIGHT'::character varying])::text[])))
);

CREATE TABLE public.tripadvisor_connections (
    connected_at timestamp(6) without time zone NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    last_sync_at timestamp(6) without time zone,
    organization_id bigint NOT NULL,
    updated_at timestamp(6) without time zone,
    status character varying(20) NOT NULL,
    partner_id character varying(100) NOT NULL,
    api_key_encrypted text,
    api_secret_encrypted text,
    error_message character varying(255),
    CONSTRAINT tripadvisor_connections_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying, 'ERROR'::character varying])::text[])))
);

CREATE TABLE public.users (
    deferred_payment boolean NOT NULL,
    email_verified boolean,
    guest_capacity integer,
    phone_verified boolean,
    property_count integer,
    surface integer,
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    last_login timestamp(6) without time zone,
    updated_at timestamp(6) without time zone,
    first_name character varying(500) NOT NULL,
    last_name character varying(500) NOT NULL,
    services character varying(500),
    services_devis character varying(500),
    booking_frequency character varying(255),
    calendar_sync character varying(255),
    city character varying(255),
    cleaning_schedule character varying(255),
    cognito_user_id character varying(255),
    company_name character varying(255),
    email character varying(255) NOT NULL,
    forfait character varying(255),
    phone_number character varying(255),
    postal_code character varying(255),
    profile_picture_url character varying(255),
    property_type character varying(255),
    role character varying(255) NOT NULL,
    status character varying(255) NOT NULL,
    stripe_customer_id character varying(255),
    stripe_subscription_id character varying(255),
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['SUPER_ADMIN'::character varying, 'SUPER_MANAGER'::character varying, 'HOST'::character varying, 'TECHNICIAN'::character varying, 'HOUSEKEEPER'::character varying, 'SUPERVISOR'::character varying, 'LAUNDRY'::character varying, 'EXTERIOR_TECH'::character varying])::text[]))),
    CONSTRAINT users_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'PENDING_VERIFICATION'::character varying, 'SUSPENDED'::character varying, 'INACTIVE'::character varying, 'BLOCKED'::character varying, 'DELETED'::character varying])::text[])))
);

CREATE TABLE public.wallets (
    currency character varying(3) NOT NULL,
    created_at timestamp(6) without time zone,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    owner_id bigint,
    updated_at timestamp(6) without time zone,
    status character varying(20) NOT NULL,
    wallet_type character varying(30) NOT NULL,
    CONSTRAINT wallets_wallet_type_check CHECK (((wallet_type)::text = ANY ((ARRAY['PLATFORM'::character varying, 'OWNER'::character varying, 'CONCIERGE'::character varying, 'ESCROW'::character varying])::text[])))
);

CREATE TABLE public.webhook_configs (
    failure_count integer,
    created_at timestamp(6) with time zone,
    id bigint NOT NULL,
    last_failure_at timestamp(6) with time zone,
    last_triggered_at timestamp(6) with time zone,
    organization_id bigint NOT NULL,
    updated_at timestamp(6) with time zone,
    status character varying(20) NOT NULL,
    events text NOT NULL,
    last_failure_reason text,
    secret_hash character varying(255) NOT NULL,
    url character varying(255) NOT NULL,
    CONSTRAINT webhook_configs_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'PAUSED'::character varying, 'FAILED'::character varying])::text[])))
);

CREATE TABLE public.whatsapp_configs (
    enabled boolean NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    organization_id bigint,
    updated_at timestamp(6) without time zone NOT NULL,
    business_account_id character varying(100),
    phone_number_id character varying(100),
    api_token character varying(1000),
    webhook_verify_token character varying(255)
);

CREATE TABLE public.whatsapp_templates (
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    synced_at timestamp(6) without time zone,
    language character varying(10) NOT NULL,
    status character varying(20) NOT NULL,
    category character varying(50),
    template_name character varying(255) NOT NULL,
    components jsonb,
    CONSTRAINT whatsapp_templates_status_check CHECK (((status)::text = ANY ((ARRAY['APPROVED'::character varying, 'PENDING'::character varying, 'REJECTED'::character varying])::text[])))
);

CREATE TABLE public.yield_rules (
    adjustment_value numeric(10,2) NOT NULL,
    is_active boolean NOT NULL,
    max_price numeric(10,2),
    min_price numeric(10,2),
    priority integer NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    property_id bigint,
    updated_at timestamp(6) without time zone,
    adjustment_type character varying(20) NOT NULL,
    rule_type character varying(30) NOT NULL,
    name character varying(100) NOT NULL,
    trigger_condition jsonb NOT NULL,
    CONSTRAINT yield_rules_adjustment_type_check CHECK (((adjustment_type)::text = ANY ((ARRAY['PERCENTAGE'::character varying, 'FIXED_AMOUNT'::character varying])::text[]))),
    CONSTRAINT yield_rules_rule_type_check CHECK (((rule_type)::text = ANY ((ARRAY['OCCUPANCY_THRESHOLD'::character varying, 'DAYS_BEFORE_ARRIVAL'::character varying, 'LAST_MINUTE_FILL'::character varying, 'GAP_FILL'::character varying])::text[])))
);

CREATE TABLE public.invitations (
    id bigint NOT NULL,
    role_invited character varying(20)
);

ALTER TABLE public.agoda_connections ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.agoda_connections_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.api_keys ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.api_keys_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.audit_log ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.automation_executions ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.automation_executions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.automation_rules ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.automation_rules_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.automation_triggers ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.automation_triggers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.booking_connections ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.booking_connections_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.channel_cancellation_policies ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.channel_cancellation_policies_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.channel_commissions ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.channel_commissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.channel_content_mappings ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.channel_content_mappings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.channel_fees ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.channel_fees_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.channel_promotions ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.channel_promotions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.channel_rate_modifiers ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.channel_rate_modifiers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.contact_attachment_files ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.contact_attachment_files_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.conversation_messages ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.conversation_messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.conversations ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.conversations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.device_tokens ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.device_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.direct_booking_configs ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.direct_booking_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.escrow_holds ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.escrow_holds_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.exchange_rates ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.exchange_rates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.expedia_connections ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.expedia_connections_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.external_pricing_configs ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.external_pricing_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.fiscal_profiles ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.fiscal_profiles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.google_vr_connections ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.google_vr_connections_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.guest_reviews ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.guest_reviews_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.homeaway_connections ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.homeaway_connections_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.hotelscom_connections ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.hotelscom_connections_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.ical_feeds ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.ical_feeds_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.integration_partners ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.integration_partners_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.interventions ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.interventions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.invoice_lines ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.invoice_lines_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.invoice_number_sequences ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.invoice_number_sequences_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.invoices ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.invoices_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.key_exchange_codes ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.key_exchange_codes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.key_exchange_events ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.key_exchange_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.key_exchange_points ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.key_exchange_points_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.ledger_entries ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.ledger_entries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.length_of_stay_discounts ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.length_of_stay_discounts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.management_contracts ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.management_contracts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.migration_jobs ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.migration_jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.notifications ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.occupancy_pricing ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.occupancy_pricing_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.online_checkins ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.online_checkins_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.owner_payouts ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.owner_payouts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.payment_method_configs ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.payment_method_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.payment_transactions ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.payment_transactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.pending_inscriptions ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.pending_inscriptions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.permissions ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.permissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.pricing_configs ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.pricing_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.promo_codes ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.promo_codes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.properties ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.properties_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.prospects ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.prospects_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.regulatory_configs ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.regulatory_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.request_comments ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.request_comments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.request_photos ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.request_photos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.review_auto_responses ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.review_auto_responses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.role_permissions ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.role_permissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.roles ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.roles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.service_requests ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.service_requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.smart_lock_devices ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.smart_lock_devices_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.split_configurations ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.split_configurations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.team_members ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.team_members_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.teams ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.teams_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.tourist_tax_configs ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.tourist_tax_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.tripadvisor_connections ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.tripadvisor_connections_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.users ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.wallets ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.wallets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.webhook_configs ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.webhook_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.whatsapp_configs ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.whatsapp_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.whatsapp_templates ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.whatsapp_templates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.yield_rules ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.yield_rules_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE ONLY public.agoda_connections
    ADD CONSTRAINT agoda_connections_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_key_hash_key UNIQUE (key_hash);

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.automation_executions
    ADD CONSTRAINT automation_executions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.automation_rules
    ADD CONSTRAINT automation_rules_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.automation_triggers
    ADD CONSTRAINT automation_triggers_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.booking_connections
    ADD CONSTRAINT booking_connections_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.channel_cancellation_policies
    ADD CONSTRAINT channel_cancellation_policies_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.channel_commissions
    ADD CONSTRAINT channel_commissions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.channel_content_mappings
    ADD CONSTRAINT channel_content_mappings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.channel_fees
    ADD CONSTRAINT channel_fees_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.channel_promotions
    ADD CONSTRAINT channel_promotions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.channel_rate_modifiers
    ADD CONSTRAINT channel_rate_modifiers_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.contact_attachment_files
    ADD CONSTRAINT contact_attachment_files_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.conversation_messages
    ADD CONSTRAINT conversation_messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT device_tokens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT device_tokens_token_key UNIQUE (token);

ALTER TABLE ONLY public.direct_booking_configs
    ADD CONSTRAINT direct_booking_configs_organization_id_property_id_key UNIQUE (organization_id, property_id);

ALTER TABLE ONLY public.direct_booking_configs
    ADD CONSTRAINT direct_booking_configs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.escrow_holds
    ADD CONSTRAINT escrow_holds_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.expedia_connections
    ADD CONSTRAINT expedia_connections_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.external_pricing_configs
    ADD CONSTRAINT external_pricing_configs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.fiscal_profiles
    ADD CONSTRAINT fiscal_profiles_organization_id_key UNIQUE (organization_id);

ALTER TABLE ONLY public.fiscal_profiles
    ADD CONSTRAINT fiscal_profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.google_vr_connections
    ADD CONSTRAINT google_vr_connections_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.guest_reviews
    ADD CONSTRAINT guest_reviews_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.homeaway_connections
    ADD CONSTRAINT homeaway_connections_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.hotelscom_connections
    ADD CONSTRAINT hotelscom_connections_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ical_feeds
    ADD CONSTRAINT ical_feeds_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.google_vr_connections
    ADD CONSTRAINT idx_google_vr_conn_org_id UNIQUE (organization_id);

ALTER TABLE ONLY public.tripadvisor_connections
    ADD CONSTRAINT idx_tripadvisor_conn_org_id UNIQUE (organization_id);

ALTER TABLE ONLY public.integration_partners
    ADD CONSTRAINT integration_partners_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.interventions
    ADD CONSTRAINT interventions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.invoice_number_sequences
    ADD CONSTRAINT invoice_number_sequences_organization_id_current_year_key UNIQUE (organization_id, current_year);

ALTER TABLE ONLY public.invoice_number_sequences
    ADD CONSTRAINT invoice_number_sequences_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.key_exchange_codes
    ADD CONSTRAINT key_exchange_codes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.key_exchange_events
    ADD CONSTRAINT key_exchange_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.key_exchange_points
    ADD CONSTRAINT key_exchange_points_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ledger_entries
    ADD CONSTRAINT ledger_entries_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.length_of_stay_discounts
    ADD CONSTRAINT length_of_stay_discounts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.management_contracts
    ADD CONSTRAINT management_contracts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.migration_jobs
    ADD CONSTRAINT migration_jobs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.occupancy_pricing
    ADD CONSTRAINT occupancy_pricing_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.online_checkins
    ADD CONSTRAINT online_checkins_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.online_checkins
    ADD CONSTRAINT online_checkins_token_key UNIQUE (token);

ALTER TABLE ONLY public.owner_payouts
    ADD CONSTRAINT owner_payouts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.payment_method_configs
    ADD CONSTRAINT payment_method_configs_organization_id_provider_type_key UNIQUE (organization_id, provider_type);

ALTER TABLE ONLY public.payment_method_configs
    ADD CONSTRAINT payment_method_configs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pending_inscriptions
    ADD CONSTRAINT pending_inscriptions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pending_inscriptions
    ADD CONSTRAINT pending_inscriptions_stripe_session_id_key UNIQUE (stripe_session_id);

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_name_key UNIQUE (name);

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pricing_configs
    ADD CONSTRAINT pricing_configs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_organization_id_code_key UNIQUE (organization_id, code);

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.prospects
    ADD CONSTRAINT prospects_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.regulatory_configs
    ADD CONSTRAINT regulatory_configs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.request_comments
    ADD CONSTRAINT request_comments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.request_photos
    ADD CONSTRAINT request_photos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.review_auto_responses
    ADD CONSTRAINT review_auto_responses_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.smart_lock_devices
    ADD CONSTRAINT smart_lock_devices_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.split_configurations
    ADD CONSTRAINT split_configurations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tourist_tax_configs
    ADD CONSTRAINT tourist_tax_configs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tripadvisor_connections
    ADD CONSTRAINT tripadvisor_connections_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_stripe_customer_id_key UNIQUE (stripe_customer_id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_stripe_subscription_id_key UNIQUE (stripe_subscription_id);

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.webhook_configs
    ADD CONSTRAINT webhook_configs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.whatsapp_configs
    ADD CONSTRAINT whatsapp_configs_organization_id_key UNIQUE (organization_id);

ALTER TABLE ONLY public.whatsapp_configs
    ADD CONSTRAINT whatsapp_configs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.whatsapp_templates
    ADD CONSTRAINT whatsapp_templates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.yield_rules
    ADD CONSTRAINT yield_rules_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_permission_id_key UNIQUE (role_id, permission_id);

CREATE INDEX idx_agoda_conn_org_id ON public.agoda_connections USING btree (organization_id);

CREATE INDEX idx_agoda_conn_property_id ON public.agoda_connections USING btree (property_id);

CREATE INDEX idx_audit_log_entity ON public.audit_log USING btree (entity_type, entity_id);

CREATE INDEX idx_audit_log_timestamp ON public.audit_log USING btree ("timestamp");

CREATE INDEX idx_audit_log_user_id ON public.audit_log USING btree (user_id);

CREATE INDEX idx_booking_conn_hotel_id ON public.booking_connections USING btree (hotel_id);

CREATE INDEX idx_booking_conn_org_id ON public.booking_connections USING btree (organization_id);

CREATE INDEX idx_device_tokens_platform ON public.device_tokens USING btree (platform);

CREATE INDEX idx_device_tokens_user_id ON public.device_tokens USING btree (user_id);

CREATE INDEX idx_escrow_org ON public.escrow_holds USING btree (organization_id);

CREATE INDEX idx_escrow_reservation ON public.escrow_holds USING btree (reservation_id);

CREATE INDEX idx_escrow_status ON public.escrow_holds USING btree (status);

CREATE INDEX idx_expedia_conn_org_id ON public.expedia_connections USING btree (organization_id);

CREATE INDEX idx_expedia_conn_property_id ON public.expedia_connections USING btree (property_id);

CREATE INDEX idx_fiscal_profile_country ON public.fiscal_profiles USING btree (country_code);

CREATE INDEX idx_fiscal_profile_org ON public.fiscal_profiles USING btree (organization_id);

CREATE INDEX idx_fx_lookup ON public.exchange_rates USING btree (base_currency, target_currency, rate_date);

CREATE INDEX idx_google_vr_conn_partner_id ON public.google_vr_connections USING btree (partner_id);

CREATE INDEX idx_homeaway_conn_listing_id ON public.homeaway_connections USING btree (listing_id);

CREATE INDEX idx_homeaway_conn_org_id ON public.homeaway_connections USING btree (organization_id);

CREATE INDEX idx_hotelscom_conn_org_id ON public.hotelscom_connections USING btree (organization_id);

CREATE INDEX idx_hotelscom_conn_property_id ON public.hotelscom_connections USING btree (property_id);

CREATE INDEX idx_ical_feed_property_id ON public.ical_feeds USING btree (property_id);

CREATE INDEX idx_ical_feed_sync_enabled ON public.ical_feeds USING btree (sync_enabled);

CREATE INDEX idx_invoice_date ON public.invoices USING btree (invoice_date);

CREATE INDEX idx_invoice_lines_invoice ON public.invoice_lines USING btree (invoice_id);

CREATE INDEX idx_invoice_org ON public.invoices USING btree (organization_id);

CREATE INDEX idx_invoice_reservation ON public.invoices USING btree (reservation_id);

CREATE INDEX idx_invoice_status ON public.invoices USING btree (status);

CREATE INDEX idx_kec_created ON public.key_exchange_codes USING btree (created_at DESC);

CREATE INDEX idx_kec_org ON public.key_exchange_codes USING btree (organization_id);

CREATE INDEX idx_kec_point ON public.key_exchange_codes USING btree (point_id);

CREATE INDEX idx_kec_property ON public.key_exchange_codes USING btree (property_id);

CREATE INDEX idx_kec_reservation ON public.key_exchange_codes USING btree (reservation_id);

CREATE INDEX idx_kec_status ON public.key_exchange_codes USING btree (status);

CREATE INDEX idx_kee_code ON public.key_exchange_events USING btree (code_id);

CREATE INDEX idx_kee_created ON public.key_exchange_events USING btree (created_at DESC);

CREATE INDEX idx_kee_org ON public.key_exchange_events USING btree (organization_id);

CREATE INDEX idx_kee_point ON public.key_exchange_events USING btree (point_id);

CREATE INDEX idx_kee_property ON public.key_exchange_events USING btree (property_id);

CREATE INDEX idx_kee_type ON public.key_exchange_events USING btree (event_type);

CREATE INDEX idx_kep_org ON public.key_exchange_points USING btree (organization_id);

CREATE INDEX idx_kep_property ON public.key_exchange_points USING btree (property_id);

CREATE INDEX idx_kep_provider ON public.key_exchange_points USING btree (provider);

CREATE INDEX idx_kep_status ON public.key_exchange_points USING btree (status);

CREATE INDEX idx_kep_token ON public.key_exchange_points USING btree (verification_token);

CREATE INDEX idx_kep_user ON public.key_exchange_points USING btree (user_id);

CREATE INDEX idx_ledger_created ON public.ledger_entries USING btree (created_at);

CREATE INDEX idx_ledger_org ON public.ledger_entries USING btree (organization_id);

CREATE INDEX idx_ledger_ref ON public.ledger_entries USING btree (reference_type, reference_id);

CREATE INDEX idx_ledger_wallet ON public.ledger_entries USING btree (wallet_id);

CREATE INDEX idx_notification_created_at ON public.notifications USING btree (created_at);

CREATE INDEX idx_notification_user_id ON public.notifications USING btree (user_id);

CREATE INDEX idx_notification_user_read ON public.notifications USING btree (user_id, is_read);

CREATE INDEX idx_payment_tx_idempotency ON public.payment_transactions USING btree (idempotency_key);

CREATE INDEX idx_payment_tx_org ON public.payment_transactions USING btree (organization_id);

CREATE INDEX idx_payment_tx_provider ON public.payment_transactions USING btree (provider_type);

CREATE INDEX idx_payment_tx_source ON public.payment_transactions USING btree (source_type, source_id);

CREATE INDEX idx_payment_tx_status ON public.payment_transactions USING btree (status);

CREATE INDEX idx_pmc_org ON public.payment_method_configs USING btree (organization_id);

CREATE INDEX idx_smart_lock_org_id ON public.smart_lock_devices USING btree (organization_id);

CREATE INDEX idx_smart_lock_property_id ON public.smart_lock_devices USING btree (property_id);

CREATE INDEX idx_smart_lock_status ON public.smart_lock_devices USING btree (status);

CREATE INDEX idx_smart_lock_user_id ON public.smart_lock_devices USING btree (user_id);

CREATE INDEX idx_split_config_org ON public.split_configurations USING btree (organization_id);

CREATE INDEX idx_tripadvisor_conn_partner_id ON public.tripadvisor_connections USING btree (partner_id);

CREATE INDEX idx_wallet_org ON public.wallets USING btree (organization_id);

CREATE INDEX idx_wallet_owner ON public.wallets USING btree (owner_id);

ALTER TABLE ONLY public.request_comments
    ADD CONSTRAINT fk13nouu2hjynrt9615bxon9ump FOREIGN KEY (service_request_id) REFERENCES public.service_requests(id);

ALTER TABLE ONLY public.interventions
    ADD CONSTRAINT fk1srakyu11edwvwt9ryo7v31yu FOREIGN KEY (assigned_user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT fk32k2h9s30s0ukftb8hj947ef2 FOREIGN KEY (owner_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.ical_feeds
    ADD CONSTRAINT fk4sltajsqpu3prtdf6085xng8t FOREIGN KEY (property_id) REFERENCES public.properties(id);

ALTER TABLE ONLY public.length_of_stay_discounts
    ADD CONSTRAINT fk52sy7huo9a0up914yy10evtka FOREIGN KEY (property_id) REFERENCES public.properties(id);

ALTER TABLE ONLY public.request_comments
    ADD CONSTRAINT fk7n8ygoe4blfceo7dwi9r7r4sd FOREIGN KEY (author_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.request_photos
    ADD CONSTRAINT fk8te7ankgqi2548ydhdbxbslmc FOREIGN KEY (service_request_id) REFERENCES public.service_requests(id);

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT fk9caktsq232h6ih6jlbtx4rs5s FOREIGN KEY (property_id) REFERENCES public.properties(id);

ALTER TABLE ONLY public.interventions
    ADD CONSTRAINT fk9dvamc3koxlig34t8s4w1fgim FOREIGN KEY (service_request_id) REFERENCES public.service_requests(id);

ALTER TABLE ONLY public.occupancy_pricing
    ADD CONSTRAINT fkb9dpvvjavkkegjc9mb47b02iu FOREIGN KEY (property_id) REFERENCES public.properties(id);

ALTER TABLE ONLY public.conversation_messages
    ADD CONSTRAINT fkcr8qqgnqnaqq2hw3gr4wtfe2a FOREIGN KEY (conversation_id) REFERENCES public.conversations(id);

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT fkdnrpkrvtepdqqcxg1nqiq5edt FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT fkee8x7x5026imwmma9kndkxs36 FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT fkegdk29eiy7mdtefy5c7eirr6e FOREIGN KEY (permission_id) REFERENCES public.permissions(id);

ALTER TABLE ONLY public.key_exchange_points
    ADD CONSTRAINT fkf0bg8hrgfecs5b0sic2skkb83 FOREIGN KEY (property_id) REFERENCES public.properties(id);

ALTER TABLE ONLY public.key_exchange_codes
    ADD CONSTRAINT fkj3nm6un2jhg6rhvmsqbdv8c8q FOREIGN KEY (point_id) REFERENCES public.key_exchange_points(id);

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT fkjuhx6xss6b3bfxyn8pjcc0inf FOREIGN KEY (property_id) REFERENCES public.properties(id);

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT fkn5fotdgk8d1xvo8nav9uv3muc FOREIGN KEY (role_id) REFERENCES public.roles(id);

ALTER TABLE ONLY public.interventions
    ADD CONSTRAINT fkn7a10alqikhujsn77elldscun FOREIGN KEY (property_id) REFERENCES public.properties(id);

ALTER TABLE ONLY public.channel_rate_modifiers
    ADD CONSTRAINT fkpgn71dw239qb6cvc17w52ihlk FOREIGN KEY (property_id) REFERENCES public.properties(id);

ALTER TABLE ONLY public.smart_lock_devices
    ADD CONSTRAINT fkpusxw3obi903ljirggaq6b58v FOREIGN KEY (property_id) REFERENCES public.properties(id);

ALTER TABLE ONLY public.interventions
    ADD CONSTRAINT fkqm4yxy3n5cw3an1g21endwv7b FOREIGN KEY (requestor_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.yield_rules
    ADD CONSTRAINT fkqx1tkpgug6tep59wlx3i17n23 FOREIGN KEY (property_id) REFERENCES public.properties(id);

ALTER TABLE ONLY public.automation_executions
    ADD CONSTRAINT fks1x9f2shkqt6l28gn4ni3ovme FOREIGN KEY (automation_rule_id) REFERENCES public.automation_rules(id);

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT fksgudq2lwpa9wc92a23nggah1w FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);

ALTER TABLE ONLY public.key_exchange_events
    ADD CONSTRAINT fksw8sjqrn6u8c7mke14bvmjrsq FOREIGN KEY (point_id) REFERENCES public.key_exchange_points(id);

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT fktgca08el3ofisywcf11f0f76t FOREIGN KEY (team_id) REFERENCES public.teams(id);

ALTER TABLE ONLY public.key_exchange_events
    ADD CONSTRAINT fkvotcllg1o21mi315innpnf0s FOREIGN KEY (code_id) REFERENCES public.key_exchange_codes(id);

