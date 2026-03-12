# Clenzy PMS — AI Integration Strategy

> **Document Version:** 1.0
> **Date:** March 2026
> **Authors:** Architecture Team
> **Status:** Strategic Blueprint
> **Confidentiality:** Internal — Sinatech Engineering

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Full Repository Analysis](#2-full-repository-analysis)
3. [Domain Mapping](#3-domain-mapping)
4. [Code Hotspot Detection](#4-code-hotspot-detection)
5. [Global AI Strategy](#5-global-ai-strategy)
6. [Booking Engine Intelligence](#6-booking-engine-intelligence)
7. [Revenue Management AI](#7-revenue-management-ai)
8. [OTA Optimization AI](#8-ota-optimization-ai)
9. [Operations AI](#9-operations-ai)
10. [PMS AI Assistant](#10-pms-ai-assistant)
11. [User Experience AI](#11-user-experience-ai)
12. [Implementation Roadmap](#12-implementation-roadmap)

---

## 1. Executive Summary

### Vision

Transform Clenzy from a feature-rich PMS into an **AI-native property management platform** where every decision — pricing, scheduling, guest communication, channel management — is augmented by intelligent systems. The goal is not to replace human operators but to amplify their effectiveness by 10x through context-aware recommendations, automated workflows, and predictive intelligence.

### Current State

Clenzy already has **four rule-based AI services** in production:

| Service | Approach | Limitation |
|---------|----------|------------|
| `AiDesignService` | LLM (GPT-4o + Claude) | Only covers booking engine design tokens |
| `AiPricingService` | Rule-based heuristics | No ML models, static multipliers, no market data |
| `AiMessagingService` | Keyword matching | No NLU, limited intents, single language |
| `AiAnalyticsService` | Statistical formulas | No time-series forecasting, no anomaly detection |
| `SentimentAnalysisService` | Keyword lexicon (6 languages) | No contextual understanding, no nuance |

### Strategic Approach

1. **Phase 1 (Completed):** LLM-powered design analysis for the booking engine
2. **Phase 2:** Upgrade existing rule-based services with LLM/ML intelligence
3. **Phase 3:** Build new AI-native capabilities (assistant, auto-pricing, predictive ops)
4. **Phase 4:** Create a unified AI orchestration layer with RAG and embeddings

### Guiding Principles

- **Non-breaking:** AI layers are additive; existing services continue to work
- **Feature-flagged:** Every AI capability is behind `clenzy.ai.*.enabled` flags
- **Graceful degradation:** Rule-based fallbacks when LLM calls fail
- **Cost-aware:** Token budgets per tenant, caching, and smart batching
- **Multi-tenant:** AI context is always organization-scoped
- **Privacy-first:** No PII sent to LLM providers; anonymization layer required

---

## 2. Full Repository Analysis

### 2.1 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Backend** | Spring Boot + Java | 3.2 / 21 (Virtual Threads) |
| **Frontend** | React + TypeScript + MUI | 18.x / 5.x |
| **Database** | PostgreSQL + Read Replicas | 16.x |
| **Cache** | Redis (Lettuce) + Caffeine L1 | 7.x |
| **Message Broker** | Apache Kafka | 3.6.x |
| **Auth** | Keycloak (OAuth2/OIDC) | 24.0.2 |
| **Payments** | Stripe Java SDK | 24.16.0 |
| **Docs** | iText7 + XDocReport + LibreOffice | 8.0.2 |
| **Monitoring** | Micrometer + Prometheus + Sentry | Latest |
| **AI (Current)** | RestClient → OpenAI + Anthropic | GPT-4o / Claude Sonnet |

### 2.2 Architecture Topology

```
                    ┌──────────────┐
                    │   Keycloak   │
                    │  (Auth/JWT)  │
                    └──────┬───────┘
                           │
    ┌──────────┐    ┌──────┴───────┐    ┌──────────────┐
    │  React   │───▶│  Spring Boot │───▶│  PostgreSQL   │
    │ Frontend │    │   REST API   │    │  (Primary +   │
    │ (Vite)   │◀───│  WebSocket   │    │   Replicas)   │
    └──────────┘    └──────┬───────┘    └──────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────┴─────┐ ┌───┴────┐ ┌─────┴──────┐
        │   Kafka   │ │ Redis  │ │  External  │
        │  (Events) │ │(Cache) │ │   APIs     │
        └───────────┘ └────────┘ └────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
              ┌─────┴─────┐    ┌──────┴──────┐   ┌──────┴───────┐
              │  Airbnb   │    │  Stripe     │   │  OpenAI /    │
              │  Booking  │    │  PayPal     │   │  Anthropic   │
              │  Expedia  │    │  PayTabs    │   │  (AI APIs)   │
              │  +14 OTAs │    └─────────────┘   └──────────────┘
              └───────────┘
```

### 2.3 Codebase Scale

| Metric | Count |
|--------|-------|
| Java packages | 16 core + 18 integration modules |
| JPA entities | 175+ |
| Spring services | 124+ |
| REST controllers | 98+ (500+ endpoints) |
| Spring Data repositories | 105+ |
| Kafka topics | 16+ |
| Scheduled tasks | 33+ |
| Frontend modules | 40+ |
| Custom React hooks | 57+ |
| API service files | 53 |
| Liquibase migrations | 71+ |

### 2.4 External Integration Landscape

**OTA Channels (18):** Airbnb, Booking.com, Expedia, VRBO, Agoda, Hotels.com, TripAdvisor, Google Vacation Rentals, HomeAway, iCal (generic), + 8 others

**Payment Gateways (5):** Stripe, PayPal, PayTabs, Payzone, CMI

**IoT/Smart Home (3):** Minut (noise), Nuki (locks), Tuya (IoT)

**Communication (4):** Brevo SMTP, Twilio (SMS/WhatsApp), Firebase FCM, IMAP

**Business Tools (3):** HubSpot CRM, Pennylane (accounting), Zapier (webhooks)

---

## 3. Domain Mapping

### 3.1 Core Business Domains

```
┌─────────────────────────────────────────────────────────┐
│                    CLENZY PMS DOMAINS                    │
├─────────────┬─────────────┬─────────────┬───────────────┤
│  PROPERTY   │ RESERVATION │  CALENDAR   │   PRICING     │
│ Management  │ & Booking   │ & Avail.    │  & Revenue    │
├─────────────┼─────────────┼─────────────┼───────────────┤
│  GUEST      │ CHANNEL     │ OPERATIONS  │  FINANCIAL    │
│  & CRM      │ Management  │ (Cleaning/  │  (Payments/   │
│             │ (18 OTAs)   │  Maint.)    │   Invoicing)  │
├─────────────┼─────────────┼─────────────┼───────────────┤
│  MESSAGING  │ DOCUMENTS   │ IoT/SMART   │  ANALYTICS    │
│ & Notif.    │ & Compliance│  HOME       │  & Reports    │
├─────────────┼─────────────┼─────────────┼───────────────┤
│  TEAM       │ AUTOMATION  │ BOOKING     │  AUTH &       │
│ Management  │ & Workflows │  ENGINE     │  MULTI-TENANT │
└─────────────┴─────────────┴─────────────┴───────────────┘
```

### 3.2 Domain Data Flow

```
Guest books on Airbnb
  → Webhook received by AirbnbWebhookController
  → AirbnbReservationService.sync()
  → ReservationService.create()
  → CalendarEngine.book() [with advisory lock]
  → GuestService.deduplicate()
  → PriceEngine.resolvePrice()
  → TouristTaxService.calculateTax()
  → InvoiceGeneratorService.generateInvoice()
  → NotificationService.notifyHost()
  → GuestMessagingScheduler queues check-in message
  → ServiceRequestService auto-creates cleaning task
  → RateDistributionService pushes availability to other channels
```

### 3.3 Entity Relationship Summary

**Properties** (1:N) → Reservations, CalendarDays, Interventions, ServiceRequests, Photos
**Reservations** (N:1) → Property, Guest; (1:N) → PaymentTransactions, InvoiceLines
**CalendarDays** (N:1) → Property; unique(propertyId, date); status enum
**Guests** (1:N) → Reservations, MessageLogs, Reviews; encrypted PII (AES-256)
**Interventions** (N:1) → Property, Team, Technician; status machine with 6 states
**Invoices** (1:N) → InvoiceLines; immutable when ISSUED; fiscal country rules
**ChannelConnections** (N:1) → Organization; encrypted credentials; sync config (JSONB)

### 3.4 Data Volume Estimates (per medium-sized client)

| Entity | Estimated Monthly Volume | Growth Pattern |
|--------|------------------------|----------------|
| Reservations | 50-200 / property | Seasonal |
| CalendarDays | 365 / property / year | Linear |
| Interventions | 100-500 | Proportional to reservations |
| Guest messages | 500-2000 | Proportional to bookings |
| Channel sync events | 10,000+ | High frequency |
| Noise alerts | 0-100 | Event-driven |
| Invoices | 50-200 | Proportional to reservations |

---

## 4. Code Hotspot Detection

### 4.1 AI Integration Points by Impact

The following table identifies exact code locations where AI can be injected with maximum business value and minimum architectural disruption:

| Priority | Domain | Current Service | AI Enhancement | Files to Modify |
|----------|--------|-----------------|----------------|-----------------|
| **P0** | Messaging | `AiMessagingService` | Replace keyword matching with LLM NLU | `AiMessagingService.java`, `GuestMessagingService.java` |
| **P0** | Pricing | `AiPricingService` | ML demand forecasting + market analysis | `AiPricingService.java`, `AdvancedRateManager.java` |
| **P1** | Analytics | `AiAnalyticsService` | Predictive forecasting + anomaly detection | `AiAnalyticsService.java`, `KpiService.java` |
| **P1** | Reviews | `SentimentAnalysisService` | LLM deep sentiment + actionable insights | `SentimentAnalysisService.java`, `ReviewService.java` |
| **P1** | Channels | `ChannelContentService` | Listing copy optimization per channel | `ChannelContentService.java` (new AI layer) |
| **P2** | Operations | `ServiceRequestService` | Smart scheduling + cost prediction | `ServiceRequestService.java`, `InterventionService.java` |
| **P2** | Documents | `DocumentGeneratorService` | AI-powered template generation | `DocumentGeneratorService.java` |
| **P2** | Automation | `AutomationSchedulerService` | Natural language rule creation | `AutomationRulesService.java` |
| **P3** | Booking | `AiDesignService` | **Done (Phase 1)** — Design analysis | Already implemented |
| **P3** | Assistant | *New* | Conversational PMS assistant | New service + controller |
| **P3** | Onboarding | `InscriptionService` | Guided setup with AI recommendations | `InscriptionService.java` |

### 4.2 Existing AI Service Assessment

#### `AiMessagingService.java` — HIGH priority upgrade

**Current:** 8 hardcoded intents via keyword maps, single-language (FR), static response templates.

**Problem:** Cannot handle:
- Complex multi-intent messages ("I need parking AND early check-in")
- Language variations beyond French
- Contextual understanding (guest history, property details)
- Tone adaptation (formal vs. casual)
- Escalation detection

**Proposed:** Replace `detectIntent()` and `generateSuggestedResponse()` with LLM calls that receive the conversation context, property details (anonymized), and guest history.

#### `AiPricingService.java` — HIGH priority upgrade

**Current:** Simple demand score (count bookings in 14-day window / 5), static multipliers (weekend 1.15x, high demand 1.25x, last-minute 0.80x).

**Problem:**
- No market data integration (competitor pricing, local events)
- No time-series analysis or trend detection
- No multi-property portfolio optimization
- Confidence scores are approximate formulas, not calibrated

**Proposed:** Feed historical data into a fine-tuned model or use LLM for reasoning over market signals. Integrate external data sources (PriceLabs, AirDNA, local event APIs).

#### `AiAnalyticsService.java` — MEDIUM priority upgrade

**Current:** Statistical aggregation (occupancy rates, ADR, RevPAR) with seasonal coefficients (Mediterranean hardcoded). Forecast = base occupancy * historical factor * day type factor.

**Problem:**
- Mediterranean seasonality hardcoded (doesn't work for other markets)
- No competitor benchmarking
- No anomaly detection
- No "what-if" scenario modeling

**Proposed:** Time-series forecasting (Prophet-like) for demand, LLM for insight generation and narrative explanations of trends.

#### `SentimentAnalysisService.java` — MEDIUM priority upgrade

**Current:** Keyword lexicon in 6 languages, tag extraction via word matching, score = (positive - negative) / total.

**Problem:**
- No sarcasm detection
- No contextual understanding
- Misses nuanced feedback (e.g., "the location was great but the apartment needs work")
- No actionable insights extraction

**Proposed:** LLM-based analysis that produces structured insights (what to improve, what to maintain), competitive positioning, and auto-generated response drafts.

---

## 5. Global AI Strategy

### 5.1 AI Service Layer Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   FRONTEND (React)                       │
│  AI Suggestions │ Smart Defaults │ Copilot Chat Panel   │
└────────────────────────┬────────────────────────────────┘
                         │ REST / WebSocket
┌────────────────────────┴────────────────────────────────┐
│                 AI GATEWAY CONTROLLER                     │
│  /api/ai/chat  │  /api/ai/suggest  │  /api/ai/analyze   │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────┐
│               AI ORCHESTRATION SERVICE                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Context  │  │ Provider │  │  Token   │              │
│  │ Builder  │  │ Router   │  │  Budget  │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │   RAG    │  │ Response │  │  Cache   │              │
│  │  Engine  │  │ Parser   │  │  Layer   │              │
│  └──────────┘  └──────────┘  └──────────┘              │
└────────────────────────┬────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
   ┌─────┴─────┐  ┌─────┴─────┐  ┌─────┴─────┐
   │  OpenAI   │  │ Anthropic │  │  Local /   │
   │  GPT-4o   │  │  Claude   │  │  Custom    │
   └───────────┘  └───────────┘  └───────────┘
```

### 5.2 New Backend Packages

```
com.clenzy.ai/
├── config/
│   ├── AiConfig.java                 # Feature flags, provider routing
│   └── AiTokenBudgetConfig.java      # Per-org token limits
├── context/
│   ├── AiContextBuilder.java         # Builds anonymized context from domain data
│   ├── PropertyContextProvider.java   # Property data for AI context
│   ├── GuestContextProvider.java      # Guest history (anonymized)
│   └── ReservationContextProvider.java
├── embedding/
│   ├── EmbeddingService.java         # Text → vector embeddings
│   ├── EmbeddingStore.java           # pgvector storage
│   └── DocumentChunker.java          # Split documents for embedding
├── rag/
│   ├── RagService.java               # Retrieval-Augmented Generation
│   ├── KnowledgeBaseService.java     # Property guides, house rules, FAQs
│   └── VectorSearchService.java      # Similarity search
├── provider/
│   ├── AiProvider.java               # Interface: chat(), embed(), analyze()
│   ├── OpenAiProvider.java           # GPT-4o implementation
│   ├── AnthropicProvider.java        # Claude implementation
│   └── FallbackProvider.java         # Rule-based fallback
├── orchestration/
│   ├── AiOrchestrationService.java   # Main entry point
│   ├── AiResponseParser.java         # Parse structured AI responses
│   └── AiCacheService.java           # Semantic cache (embedding-based)
├── budget/
│   ├── TokenBudgetService.java       # Track usage per org
│   └── TokenUsageRepository.java     # Persist token consumption
├── assistant/
│   ├── PmsAssistantService.java      # Conversational assistant
│   ├── AssistantToolRegistry.java    # Function calling tools
│   └── AssistantConversationService.java # Conversation history
└── controller/
    ├── AiAssistantController.java    # /api/ai/assistant
    ├── AiSuggestionController.java   # /api/ai/suggest
    └── AiAnalysisController.java     # /api/ai/analyze
```

### 5.3 LLM Provider Strategy

| Provider | Use Case | Model | Reason |
|----------|----------|-------|--------|
| **OpenAI** | Structured extraction, embeddings | `gpt-4o`, `text-embedding-3-small` | Best JSON mode, fast embeddings |
| **Anthropic** | Long-form generation, analysis | `claude-sonnet-4-20250514` | Superior reasoning, longer context |
| **Fallback** | All cases on API failure | Rule-based heuristics | Zero-cost, always available |

**Provider Routing Logic:**
```java
public interface AiProvider {
    String chat(String systemPrompt, String userPrompt, AiRequestOptions options);
    float[] embed(String text);
    <T> T structuredOutput(String prompt, Class<T> responseType);
}

// Router selects provider based on task type + cost
@Service
public class AiProviderRouter {
    public AiProvider resolve(AiTaskType taskType) {
        return switch (taskType) {
            case EXTRACTION, EMBEDDING -> openAiProvider;
            case GENERATION, ANALYSIS, REASONING -> anthropicProvider;
            case SIMPLE_CLASSIFICATION -> fallbackProvider;
        };
    }
}
```

### 5.4 RAG Architecture (Retrieval-Augmented Generation)

**Purpose:** Give LLMs access to property-specific knowledge without fine-tuning.

**Knowledge Sources:**
- Property descriptions, house rules, check-in instructions
- Welcome guides and local area information
- FAQ from historical guest conversations
- Cancellation policies and terms of service
- Past maintenance records (for predictive insights)

**Implementation:**
```
Document → Chunker (512 tokens) → Embedding API → pgvector store
                                                        │
User Query → Embedding → Similarity Search (top-k=5) ───┘
                                                        │
                                        Context + Query → LLM → Response
```

**Database Extension:**
```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge base table
CREATE TABLE ai_knowledge_chunks (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id),
    source_type VARCHAR(50) NOT NULL,  -- PROPERTY_GUIDE, HOUSE_RULES, FAQ, etc.
    source_id BIGINT,                  -- FK to source entity
    content TEXT NOT NULL,
    embedding vector(1536),            -- OpenAI text-embedding-3-small dimension
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_knowledge_chunks_embedding ON ai_knowledge_chunks
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### 5.5 Token Budget Management

**Why:** LLM API costs can escalate quickly with multi-tenant SaaS. Each organization gets a monthly token budget based on their subscription tier.

```java
@Entity
public class AiTokenUsage {
    @Id @GeneratedValue
    private Long id;
    private Long organizationId;
    private String provider;         // OPENAI, ANTHROPIC
    private String model;
    private int inputTokens;
    private int outputTokens;
    private BigDecimal estimatedCost;
    private String featureKey;       // MESSAGING, PRICING, ANALYTICS, etc.
    private LocalDateTime createdAt;
}
```

**Budget Tiers:**

| Plan | Monthly Token Budget | Features |
|------|---------------------|----------|
| Starter | 100K tokens | Messaging AI only |
| Professional | 500K tokens | Messaging + Pricing + Analytics |
| Enterprise | 2M tokens | All AI features + Assistant |
| Unlimited | Pay-as-you-go | All features, usage-based billing |

### 5.6 Anonymization Layer

**Rule:** Never send raw PII to LLM providers. All context passes through an anonymization filter.

```java
@Service
public class AiContextAnonymizer {

    public String anonymize(String text) {
        // Replace guest names with GUEST_1, GUEST_2
        // Replace emails with [EMAIL]
        // Replace phone numbers with [PHONE]
        // Replace addresses with city-level only
        // Keep: property type, dates, prices, status, language
        return anonymized;
    }

    public String deanonymize(String aiResponse, Map<String, String> mapping) {
        // Restore original values in the AI response
        return restored;
    }
}
```

### 5.7 Configuration Structure

```yaml
clenzy:
  ai:
    enabled: false                    # Global kill switch

    orchestration:
      default-provider: anthropic     # Default LLM provider
      fallback-enabled: true          # Use rule-based on LLM failure
      max-retries: 2
      timeout-seconds: 30

    openai:
      api-key: ${OPENAI_API_KEY:}
      model: gpt-4o
      embedding-model: text-embedding-3-small
      base-url: https://api.openai.com/v1

    anthropic:
      api-key: ${ANTHROPIC_API_KEY:}
      model: claude-sonnet-4-20250514
      base-url: https://api.anthropic.com/v1

    rag:
      enabled: true
      chunk-size: 512
      chunk-overlap: 64
      top-k: 5
      min-similarity: 0.75

    budget:
      enabled: true
      default-monthly-limit: 500000   # tokens
      warning-threshold-pct: 80

    features:
      messaging:
        enabled: true
        provider: anthropic            # Best for multilingual generation
        max-tokens-per-request: 1000
      pricing:
        enabled: true
        provider: openai               # Best for structured output
        max-tokens-per-request: 2000
      analytics:
        enabled: true
        provider: anthropic
        max-tokens-per-request: 3000
      assistant:
        enabled: false                 # Phase 3
        provider: anthropic
        max-tokens-per-request: 4000
      design:
        enabled: true                  # Phase 1 — already live
        extraction-provider: openai
        generation-provider: anthropic

    cache:
      enabled: true
      semantic-cache-ttl-hours: 24     # Same-meaning queries reuse cache
      exact-cache-ttl-hours: 72        # Identical queries reuse cache
```

---

## 6. Booking Engine Intelligence

> **Status:** Phase 1 COMPLETED

### 6.1 What Was Built

The AI Design Matching system is fully operational:

**Pipeline:**
```
User enters website URL
  → WebsiteFetchService (Jsoup, SSRF-protected)
  → SHA-256 hash for caching
  → OpenAI GPT-4o extracts 21 design tokens (JSON structured output)
  → Anthropic Claude generates scoped CSS for .booking-widget
  → Tokens + CSS stored in DB (BookingEngineConfig)
  → Frontend DesignTokenEditor for manual adjustments
  → Regenerate CSS from edited tokens
```

**Files Implemented:**
- `WebsiteFetchService.java` — Jsoup fetcher with SSRF protection
- `AiDesignPrompts.java` — System/user prompts for both LLMs
- `AiDesignService.java` — Orchestration with circuit breaker + retry
- `BookingEngineAiController.java` — REST endpoints
- `AiDesignMatcher.tsx` — Frontend URL input + analysis UI
- `DesignTokenEditor.tsx` — Visual token editor (5 accordion sections)
- `BookingEnginePreview.tsx` — Real-time preview with CSS custom properties

### 6.2 Future Enhancements (Phase 2+)

| Enhancement | Description | Priority |
|-------------|-------------|----------|
| **Multi-variant CSS** | Generate 3 CSS variants (modern, classic, minimal) for A/B testing | P2 |
| **Brand voice analysis** | Extract brand personality from website copy for booking page tone | P3 |
| **Accessibility scoring** | Analyze generated CSS for WCAG 2.1 compliance | P3 |
| **Auto-refresh** | Detect website redesigns and auto-regenerate tokens | P3 |
| **Template recommendation** | Suggest optimal booking engine template based on property type | P3 |

---

## 7. Revenue Management AI

### 7.1 Current State: `AiPricingService`

The existing service uses simple heuristics: weekend multiplier (1.15x), high demand (1.25x when demand score > 0.7), low demand (0.85x), last-minute discount (0.80x within 7 days). Demand score = count of historical bookings in 14-day window / 5.

### 7.2 Target Architecture: Intelligent Revenue Management

```
┌──────────────────────────────────────────────────────────────┐
│                  REVENUE MANAGEMENT ENGINE                     │
├──────────────┬───────────────┬───────────────┬───────────────┤
│  Market      │  Demand       │  Competitor   │  Event        │
│  Intelligence│  Forecasting  │  Analysis     │  Detection    │
├──────────────┴───────────────┴───────────────┴───────────────┤
│                    PRICING OPTIMIZER                           │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │ Base    │  │ Dynamic  │  │ Channel  │  │  Length-of-  │ │
│  │ Price   │→ │ Modifier │→ │ Modifier │→ │  Stay Disc.  │ │
│  └─────────┘  └──────────┘  └──────────┘  └──────────────┘ │
├──────────────────────────────────────────────────────────────┤
│                   PRICE SUGGESTION API                        │
│  POST /api/ai/pricing/suggest                                │
│  POST /api/ai/pricing/forecast                               │
│  GET  /api/ai/pricing/market-intel                           │
└──────────────────────────────────────────────────────────────┘
```

### 7.3 New Service: `AiRevenuManagementService`

**Responsibilities:**

1. **Demand Forecasting**
   - Input: Historical reservations (1-2 years), calendar state, seasonal patterns
   - Output: Predicted occupancy per day for next 90 days with confidence intervals
   - Method: LLM reasoning over structured data + time-series patterns

2. **Dynamic Price Optimization**
   - Input: Demand forecast, competitor rates (via PriceLabs API), local events
   - Output: Suggested nightly price per property per day
   - Method: Multi-factor optimization with LLM explanation of rationale

3. **Market Intelligence**
   - Input: Property characteristics, location, recent reviews
   - Output: Competitive positioning analysis, pricing gap identification
   - Method: RAG over market data + LLM analysis

4. **Revenue Insights**
   - Input: Portfolio performance data (RevPAR, ADR, occupancy)
   - Output: Natural language insights ("Your Marais apartment is 15% below market ADR...")
   - Method: LLM narrative generation from structured metrics

### 7.4 Integration Points

**Existing services to enhance:**

```java
// In AdvancedRateManager.java — add AI modifier layer
public BigDecimal resolvePrice(Long propertyId, LocalDate date, ...) {
    BigDecimal basePrice = priceEngine.resolve(propertyId, date);

    // Existing layers (unchanged)
    basePrice = applyRatePlanModifier(basePrice, ...);
    basePrice = applyChannelModifier(basePrice, channel);
    basePrice = applyLengthOfStayDiscount(basePrice, nights);
    basePrice = applyOccupancyPricing(basePrice, guests);
    basePrice = applyYieldRule(basePrice, occupancy);

    // NEW: AI dynamic pricing layer (additive, not replacing)
    if (aiPricingEnabled) {
        AiPriceSuggestion suggestion = aiRevenueService.getSuggestion(propertyId, date);
        if (suggestion.confidence() > 0.7) {
            basePrice = suggestion.suggestedPrice();
            // Log for audit
            rateAuditLog.record(propertyId, date, basePrice, suggestion.reason());
        }
    }

    return applyRateOverride(basePrice, propertyId, date); // Manual override always wins
}
```

### 7.5 Frontend: Pricing Intelligence Dashboard

New analytics panel in the existing `AnalyticsPricingIntelligence.tsx`:

- **Price Heatmap Calendar:** Color-coded calendar showing AI-suggested prices
- **Demand Forecast Graph:** 90-day occupancy prediction with confidence band
- **Market Positioning Card:** Where the property sits vs. competitors
- **Revenue Opportunity Alerts:** "Raising price by 10% on Jul 14-18 could increase revenue by 180 EUR"
- **One-click Apply:** Button to push AI-suggested prices to the calendar

---

## 8. OTA Optimization AI

### 8.1 Current State

The platform syncs with 18+ OTA channels. Each channel has:
- `ChannelConnection` — Credentials and config
- `ChannelMapping` — Property ↔ listing mapping
- `ChannelSyncLog` — Audit trail
- `ChannelRateModifier` — Per-channel price adjustments
- `ChannelContentMapping` — Description/amenity mapping

Currently, all content (titles, descriptions, amenities) is manually managed per channel.

### 8.2 Channel Performance Intelligence

**New Service: `AiChannelOptimizationService`**

```java
@Service
public class AiChannelOptimizationService {

    /**
     * Analyze channel performance and suggest optimization.
     * Compares booking sources, commission rates, ADR per channel,
     * and cancellation rates to recommend channel mix strategy.
     */
    public ChannelOptimizationReport analyzePerformance(Long orgId, LocalDate from, LocalDate to);

    /**
     * Optimize listing content for a specific channel.
     * Uses channel-specific best practices (Airbnb favors storytelling,
     * Booking.com favors factual descriptions).
     */
    public ListingOptimizationDto optimizeListing(Long propertyId, String channel);

    /**
     * Suggest optimal channel rate modifiers based on
     * commission rates, conversion rates, and guest quality per channel.
     */
    public List<RateModifierSuggestion> suggestRateModifiers(Long orgId);

    /**
     * Auto-generate channel-specific description from property data.
     */
    public String generateChannelDescription(Long propertyId, String channel, String language);
}
```

### 8.3 Listing Content Optimization

**How it works:**

1. AI reads property data (description, amenities, photos metadata, reviews)
2. For each connected channel, generates an optimized listing description:
   - **Airbnb:** Storytelling format, highlight unique experiences, local tips
   - **Booking.com:** Factual, amenity-focused, proximity to landmarks
   - **Expedia:** Travel-oriented, package-friendly descriptions
3. Suggests optimal title variations per channel
4. Recommends photo ordering based on channel best practices

**RAG Enhancement:** Store top-performing listings from the same market as reference data for the LLM.

### 8.4 Channel Mix Optimization

**Data Sources:**
```sql
-- Per-channel performance query
SELECT
    r.source AS channel,
    COUNT(*) AS bookings,
    AVG(r.total_price) AS avg_revenue,
    AVG(EXTRACT(DAY FROM r.check_out - r.check_in)) AS avg_stay_length,
    COUNT(CASE WHEN r.status = 'cancelled' THEN 1 END)::DECIMAL / COUNT(*) AS cancel_rate,
    SUM(r.total_price) AS total_revenue
FROM reservations r
WHERE r.organization_id = :orgId
    AND r.check_in BETWEEN :from AND :to
GROUP BY r.source;
```

**AI Analysis Output:**
```json
{
    "recommendations": [
        {
            "channel": "booking.com",
            "action": "INCREASE_ALLOCATION",
            "reason": "34% higher ADR than Airbnb with similar occupancy",
            "impact": "+2,400 EUR/month estimated"
        },
        {
            "channel": "direct",
            "action": "INVEST",
            "reason": "0% commission, 12% of bookings — potential to grow to 25%",
            "impact": "+1,800 EUR/month in saved commissions"
        }
    ]
}
```

### 8.5 Review Response Automation

**Enhanced `SentimentAnalysisService`:**

1. LLM analyzes the review (sentiment, topics, actionable items)
2. Generates a personalized response draft matching the property's tone
3. Adapts language to the reviewer's language
4. Highlights operational issues to the host (e.g., "3 reviews mention slow WiFi")

```java
public ReviewAnalysis analyzeReview(GuestReview review, Property property) {
    // Returns:
    // - sentiment: POSITIVE/NEUTRAL/NEGATIVE with confidence
    // - topics: [CLEANLINESS, WIFI, LOCATION]
    // - actionableInsights: ["WiFi speed mentioned negatively in 3 of last 10 reviews"]
    // - suggestedResponse: "Thank you for your feedback, [Guest]..."
    // - internalNotes: "Consider upgrading WiFi router for property [X]"
}
```

---

## 9. Operations AI

### 9.1 Smart Cleaning Scheduling

**Current State:** Cleaning tasks (interventions) are manually created when reservations are confirmed. Assignment is manual or basic auto-assign by team zone.

**Target:** AI-powered cleaning operations that predict needs, optimize routes, and estimate costs.

**New Service: `AiOperationsService`**

```java
@Service
public class AiOperationsService {

    /**
     * Auto-generate optimal cleaning schedule for the week.
     * Considers: checkout times, check-in times, property sizes,
     * team availability, travel distances between properties,
     * cleaning duration estimates, and priority levels.
     */
    public WeeklySchedule generateCleaningSchedule(Long orgId, LocalDate weekStart);

    /**
     * Predict cleaning duration based on property characteristics
     * and historical intervention data.
     */
    public DurationEstimate predictCleaningDuration(Long propertyId, String cleaningType);

    /**
     * Detect potential issues from intervention photos using vision AI.
     * Flags: damage, cleanliness issues, missing items, maintenance needs.
     */
    public PhotoAnalysisResult analyzeInterventionPhoto(byte[] photo, String context);

    /**
     * Predict maintenance needs based on property age, usage patterns,
     * and historical intervention data.
     */
    public List<MaintenancePrediction> predictMaintenance(Long propertyId);
}
```

### 9.2 Intelligent Task Assignment

**Current:** `PropertyTeamService` assigns teams based on coverage zones (geographic polygons). `ServiceRequestService` auto-assigns based on team availability.

**Enhancement:** AI considers multiple factors for optimal assignment:

```
Factors for AI Assignment:
├── Geographic proximity (travel time between properties)
├── Team member skills (TECHNICIAN vs. HOUSEKEEPER vs. SUPERVISOR)
├── Current workload (tasks already assigned today)
├── Historical performance (avg. duration, quality rating per member)
├── Property complexity (size, number of rooms, special requirements)
├── Urgency level (checkout → checkin gap time)
└── Team member preferences and availability
```

**Integration with existing code:**

```java
// Enhancement to InterventionService.java
public Intervention autoAssign(Long interventionId) {
    Intervention intervention = findById(interventionId);

    if (aiOperationsEnabled) {
        AiAssignmentSuggestion suggestion = aiOperationsService
            .suggestAssignment(intervention);

        if (suggestion.confidence() > 0.8) {
            intervention.setAssignedTechnicianId(suggestion.technicianId());
            intervention.setTeamId(suggestion.teamId());
            intervention.setEstimatedDuration(suggestion.estimatedDuration());
            // Log reasoning for audit
            intervention.setAiAssignmentReason(suggestion.reason());
        }
    } else {
        // Fallback: existing zone-based assignment
        autoAssignByZone(intervention);
    }

    return save(intervention);
}
```

### 9.3 Predictive Maintenance

**Data Sources:**
- Historical intervention records (type, frequency, cost, property)
- Property age and characteristics
- IoT sensor data (Minut noise alerts can indicate appliance issues)
- Guest feedback mentioning equipment issues
- Seasonal patterns (heating issues in winter, AC in summer)

**AI Output:**
```json
{
    "propertyId": 42,
    "predictions": [
        {
            "item": "Water heater",
            "predictedFailureWindow": "2026-04-15 to 2026-05-15",
            "confidence": 0.72,
            "reason": "3 plumbing interventions in last 6 months, unit age: 8 years",
            "estimatedCost": "350-500 EUR",
            "recommendation": "Schedule preventive inspection before summer season"
        }
    ]
}
```

### 9.4 Noise Alert Intelligence

**Enhancement to `NoiseAlertNotificationService`:**

Instead of simple threshold alerts, AI analyzes noise patterns to:
- Distinguish party noise from TV/music (pattern analysis)
- Predict escalation likelihood based on time and noise profile
- Auto-generate appropriate guest messages (warning vs. informational)
- Recommend threshold adjustments per property based on neighborhood norms

---

## 10. PMS AI Assistant

### 10.1 Vision

A conversational AI assistant accessible from any page in the PMS. Operators can ask questions in natural language and the assistant queries the PMS data to provide answers.

### 10.2 Architecture: Function Calling

```
User: "What's my occupancy rate for Paris properties this summer?"
        │
        ▼
┌───────────────────┐
│  PMS Assistant    │
│  Service          │
│                   │
│  1. Parse intent  │
│  2. Select tools  │
│  3. Execute       │
│  4. Format reply  │
└───────┬───────────┘
        │ Function Calling
        ▼
┌───────────────────────────────────┐
│        TOOL REGISTRY              │
├───────────────────────────────────┤
│ get_occupancy(properties, dates)  │
│ get_revenue(properties, dates)    │
│ list_reservations(filters)        │
│ list_interventions(filters)       │
│ get_pricing_suggestions(prop)     │
│ get_channel_performance(dates)    │
│ get_guest_info(guestId)           │
│ search_properties(criteria)       │
│ get_calendar_availability(prop)   │
│ create_intervention(data)         │
│ update_pricing(prop, dates, price)│
│ send_message(guestId, content)    │
└───────────────────────────────────┘
```

### 10.3 Example Conversations

**Revenue Query:**
```
User: "How did we perform last month compared to the same month last year?"

Assistant → calls get_revenue(properties=ALL, dates=last_month)
         → calls get_revenue(properties=ALL, dates=same_month_last_year)
Assistant: "Here's your February 2026 vs February 2025 comparison:

| Metric     | Feb 2025   | Feb 2026   | Change  |
|------------|------------|------------|---------|
| Revenue    | 12,450 EUR | 18,320 EUR | +47.1%  |
| Occupancy  | 62%        | 78%        | +16 pts |
| ADR        | 95 EUR     | 112 EUR    | +17.9%  |
| RevPAR     | 58.90 EUR  | 87.36 EUR  | +48.3%  |
| Bookings   | 45         | 63         | +40%    |

Key drivers: Higher ADR from dynamic pricing, plus 3 new
properties added in Q4 2025. Direct bookings up 12%."
```

**Operational Query:**
```
User: "Are there any maintenance issues I should worry about this week?"

Assistant -> calls list_interventions(status=PENDING, dateRange=this_week)
          -> calls get_predictive_maintenance(properties=ALL)
Assistant: "Here's your maintenance overview for this week:

PENDING INTERVENTIONS (3):
1. Apt. Marais #12 - Broken dishwasher (reported 2 days ago, assigned to Pierre)
2. Studio Montmartre #5 - AC filter replacement (scheduled Thursday)
3. Villa Nice #2 - Pool pump inspection (scheduled Friday)

PREDICTIVE ALERTS (1):
- Villa Nice #2: Water heater showing signs of wear (8 years old,
  3 plumbing calls in 6 months). Recommend preventive replacement
  before summer. Estimated cost: 350-500 EUR.

Want me to schedule the water heater replacement?"
```

**Action Query:**
```
User: "Set the price for Studio Montmartre to 120 EUR for next weekend"

Assistant -> calls update_pricing(propertyId=5, dates=[next_saturday, next_sunday], price=120)
Assistant: "Done! I've updated Studio Montmartre pricing:
- Saturday March 14: 120 EUR (was 95 EUR, +26.3%)
- Sunday March 15: 120 EUR (was 90 EUR, +33.3%)

Note: This is above the AI-suggested price of 105 EUR for these
dates. The property currently has no bookings for next weekend."
```

### 10.4 Service Implementation

**New file: `com.clenzy.service.PmsAssistantService`**

```java
@Service
public class PmsAssistantService {

    private final RestClient anthropicClient;
    private final AssistantToolRegistry toolRegistry;
    private final AiTokenBudgetService budgetService;
    private final AiAnonymizationService anonymizer;
    private final ObjectMapper objectMapper;

    private static final List<Map<String, Object>> TOOLS = List.of(
        tool("get_occupancy", "Get occupancy rate for properties in a date range",
            param("property_ids", "array", "Property IDs (empty = all)"),
            param("start_date", "string", "Start date ISO"),
            param("end_date", "string", "End date ISO")),
        tool("get_revenue", "Get revenue metrics for properties",
            param("property_ids", "array", "Property IDs"),
            param("start_date", "string", "Start date"),
            param("end_date", "string", "End date")),
        tool("list_reservations", "List reservations with filters",
            param("status", "string", "CONFIRMED/PENDING/CANCELLED"),
            param("property_id", "integer", "Optional property filter"),
            param("limit", "integer", "Max results (default 20)")),
        tool("update_pricing", "Update nightly price for a property",
            param("property_id", "integer", "Property ID"),
            param("dates", "array", "Array of date strings"),
            param("price", "number", "New nightly price")),
        tool("send_message", "Send message to a guest",
            param("guest_id", "integer", "Guest ID"),
            param("content", "string", "Message content"),
            param("channel", "string", "EMAIL/SMS/WHATSAPP"))
    );

    @CircuitBreaker(name = "ai-assistant")
    public AssistantResponseDto chat(Long orgId, List<MessageDto> history, String userMessage) {
        budgetService.requireBudget(orgId, "assistant");

        List<Map<String, Object>> messages = new ArrayList<>();
        for (MessageDto msg : history) {
            messages.add(Map.of("role", msg.role(), "content", msg.content()));
        }
        messages.add(Map.of("role", "user", "content", anonymizer.anonymize(userMessage)));

        Map<String, Object> request = Map.of(
            "model", "claude-sonnet-4-20250514",
            "max_tokens", 4096,
            "system", ASSISTANT_SYSTEM_PROMPT,
            "tools", TOOLS,
            "messages", messages
        );

        Map<String, Object> response = callClaude(request);
        while (hasToolUse(response)) {
            List<ToolCallResult> results = executeToolCalls(orgId, response);
            messages.addAll(buildToolResultMessages(response, results));
            response = callClaude(request);
        }

        String assistantText = extractText(response);
        int tokensUsed = extractTokenCount(response);
        budgetService.recordUsage(orgId, "assistant", tokensUsed);

        return new AssistantResponseDto(
            anonymizer.deAnonymize(assistantText),
            tokensUsed
        );
    }
}
```

### 10.5 Security Model

The assistant operates with **strict tenant isolation** and **permission-aware tool execution**:

| Aspect | Implementation |
|--------|---------------|
| **Tenant isolation** | Every tool call scoped by `organizationId` from `TenantContext` |
| **Read vs Write** | Read tools (get_*, list_*) require `ROLE_USER`. Write tools (update_*, send_*, create_*) require `ROLE_MANAGER` or above |
| **Rate limiting** | Max 50 messages/hour per user, max 200/hour per organization |
| **Audit trail** | Every tool execution logged to `ai_assistant_audit` table |
| **PII handling** | All user messages anonymized before LLM; responses de-anonymized after |
| **Token budget** | Per-org monthly limit enforced before every API call |
| **Dangerous actions** | Price changes > 50%, bulk operations, and message sends require explicit confirmation in the chat |

### 10.6 Frontend: Chat Panel

**New file: `client/src/modules/assistant/AssistantChatPanel.tsx`**

- Floating chat button (bottom-right, customizable position)
- Slide-up panel with conversation history
- Message bubbles with Markdown rendering (react-markdown)
- Tool execution indicators (loading spinners for each tool call)
- Confirmation dialogs for write actions
- Keyboard shortcut: `Cmd+K` / `Ctrl+K` to open
- Context-aware: pre-populates context based on current page (e.g., opens with property context on property detail page)

---

## 11. User Experience AI

### 11.1 AI-Powered Onboarding

**Problem:** New users struggle with initial PMS configuration (properties, pricing rules, OTA connections).

**Solution:** An onboarding assistant that guides users step-by-step:

```
┌─────────────────────────────────────────────────────────┐
│                  ONBOARDING FLOW                        │
│                                                         │
│  1. Import existing listings                            │
│     └─ AI scrapes Airbnb/Booking.com listing URL        │
│        Extracts: name, description, amenities, photos   │
│        Pre-fills: property form, pricing, calendar      │
│                                                         │
│  2. Smart pricing setup                                 │
│     └─ AI analyzes comparable listings in the area      │
│        Suggests: base price, seasonal adjustments       │
│        Shows: market position (budget/mid/premium)      │
│                                                         │
│  3. Automated channel connection                        │
│     └─ Guided OAuth flow for each OTA                   │
│        AI maps fields between PMS and OTA schemas       │
│        Validates: calendar sync, pricing rules          │
│                                                         │
│  4. Communication templates                             │
│     └─ AI generates message templates from examples     │
│        Adapts: tone, language, property-specific info    │
│        Pre-configures: auto-messages (check-in, etc.)   │
│                                                         │
│  5. First booking simulation                            │
│     └─ Walks through a mock booking end-to-end          │
│        Tests: availability, pricing, guest flow         │
│        Identifies: configuration gaps                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Key service:** `AiOnboardingService.java`
- `analyzeListingUrl(url)` - Scrapes and extracts property data from OTA listing pages
- `suggestPricing(propertyId, location)` - Analyzes comparable properties to suggest initial pricing
- `generateTemplates(propertyId, language, tone)` - Creates message templates adapted to the property
- `validateSetup(orgId)` - Comprehensive check of configuration completeness

### 11.2 Contextual Recommendations

The AI proactively surfaces recommendations based on user context:

**Dashboard Insights Panel:**
```
┌─────────────────────────────────────────────────┐
│  AI Insights                           [Refresh]│
├─────────────────────────────────────────────────┤
│                                                  │
│  PRICING OPPORTUNITY                             │
│  Studio Montmartre is priced 15% below market    │
│  average for this weekend. Consider raising to    │
│  115 EUR (+20 EUR). [Apply] [Dismiss]            │
│                                                  │
│  GUEST ALERT                                     │
│  Booking #4521 guest asked about early check-in  │
│  3 hours ago. No response yet.                   │
│  [Draft response] [View conversation]            │
│                                                  │
│  MAINTENANCE PREDICTION                          │
│  Villa Nice pool pump: 72% failure probability   │
│  in next 30 days. Schedule preventive service?   │
│  [Schedule] [Remind later]                       │
│                                                  │
│  CHANNEL PERFORMANCE                             │
│  Booking.com conversion dropped 18% this week.   │
│  Possible cause: competitor price undercut.      │
│  [View analysis] [Adjust pricing]                │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Implementation: `AiInsightsService.java`**

```java
@Service
public class AiInsightsService {

    @Cacheable(value = "ai-insights", key = "#orgId")
    public List<InsightDto> generateInsights(Long orgId) {
        List<InsightDto> insights = new ArrayList<>();

        insights.addAll(pricingInsights(orgId));

        insights.addAll(guestAlertInsights(orgId));

        insights.addAll(maintenanceInsights(orgId));

        insights.addAll(channelInsights(orgId));

        insights.addAll(occupancyGapInsights(orgId));

        return insights.stream()
            .sorted(Comparator.comparingDouble(InsightDto::priority).reversed())
            .limit(5)
            .toList();
    }
}
```

### 11.3 Smart Defaults

AI learns from user behavior to set intelligent defaults:

| Feature | Smart Default |
|---------|--------------|
| **New property pricing** | Based on similar properties in portfolio + market data |
| **Check-in/out times** | Based on most common times across existing properties |
| **Cancellation policy** | Based on property type and market segment |
| **Minimum stay** | Based on seasonal demand patterns and booking history |
| **Cleaning duration** | Based on property size and historical intervention data |
| **Response templates** | Based on most-used templates and guest language |
| **Calendar buffer days** | Based on cleaning team capacity and property turnover |

**Implementation:** `AiSmartDefaultsService.java` with a simple `getDefaults(orgId, context)` method that returns a map of suggested values. Frontend components check for smart defaults when creating new entities.

### 11.4 Proactive Alerts

AI-generated alerts pushed via WebSocket to the frontend:

| Alert Type | Trigger | Channel |
|------------|---------|---------|
| **Price alert** | Competitor undercut detected | Dashboard + Push |
| **Review alert** | New negative review (sentiment < 0.3) | Dashboard + Email |
| **Booking surge** | Unusual booking volume (anomaly detection) | Dashboard |
| **Calendar conflict** | Overlapping bookings detected across channels | Dashboard + SMS |
| **Guest no-show** | Check-in time passed, no activity detected | Dashboard + Push |
| **Payment overdue** | Payment deadline approaching with no payment | Dashboard + Email |
| **OTA sync failure** | Channel sync error for > 30 minutes | Dashboard + Email |
| **Noise alert** | IoT sensor threshold exceeded (contextual) | Dashboard + SMS |

**Implementation:** `AiAlertService.java` processes events from Kafka topics, applies AI analysis, and publishes alerts via `SimpMessagingTemplate` (WebSocket). Alerts stored in `ai_alerts` table for history.

---

## 12. Implementation Roadmap

### 12.1 Phase Overview

```
Phase 1 (COMPLETED)        Phase 2               Phase 3               Phase 4
Q1 2026                    Q2 2026               Q3-Q4 2026            2027
─────────────────────      ──────────────────    ──────────────────    ──────────────────
Booking Engine AI          Revenue + Messaging   Operations + OTA     Assistant + UX
- Design analysis          - Dynamic pricing     - Smart scheduling   - PMS Assistant
- Token extraction         - Smart messaging     - Predictive maint.  - AI Onboarding
- CSS generation           - Sentiment upgrade   - OTA optimization   - Smart defaults
- Design editor            - Analytics upgrade   - Review automation  - Proactive alerts
                           - Insights panel      - Channel mix AI     - AI Insights
```

### 12.2 Phase 2: Revenue + Messaging Intelligence (Q2 2026)

**Duration:** 10-12 weeks
**Team:** 2 backend engineers + 1 frontend engineer + 0.5 ML engineer

| Sprint | Deliverable | Effort |
|--------|-------------|--------|
| S1-S2 | AI infrastructure: token budget service, anonymization layer, provider abstraction | 3 weeks |
| S3-S4 | `AdvancedPricingService`: market data integration, demand forecasting, competitor analysis | 4 weeks |
| S5-S6 | `SmartMessagingService`: LLM-powered guest communication, multi-language NLU, auto-responses | 3 weeks |
| S7 | `EnhancedAnalyticsService`: time-series forecasting, anomaly detection, revenue optimization | 2 weeks |
| S8 | `SentimentAnalysisV2`: LLM-based sentiment with actionable insights, auto-response drafts | 1 week |
| S9 | Frontend: AI insights dashboard panel, pricing recommendation UI, messaging AI controls | 2 weeks |
| S10 | Integration testing, prompt tuning, performance optimization | 1 week |

**Infrastructure requirements:**
- pgvector extension for PostgreSQL (embeddings storage)
- Redis cache expansion (AI response caching)
- OpenAI API access (GPT-4o for extraction, text-embedding-3-small for embeddings)
- Anthropic API access (Claude for generation)

**Cost estimate (monthly API):**
- Starter tier (< 10 properties): ~$15-30/month
- Professional tier (10-50 properties): ~$50-150/month
- Enterprise tier (50+ properties): ~$200-500/month

### 12.3 Phase 3: Operations + OTA Intelligence (Q3-Q4 2026)

**Duration:** 14-16 weeks
**Team:** 2 backend engineers + 1 frontend engineer + 1 data engineer

| Sprint | Deliverable | Effort |
|--------|-------------|--------|
| S1-S2 | `SmartSchedulingService`: AI-powered cleaning assignment, route optimization | 3 weeks |
| S3-S4 | `PredictiveMaintenanceService`: equipment lifecycle tracking, failure prediction | 3 weeks |
| S5-S6 | `OtaOptimizationService`: channel performance analysis, listing optimization, pricing by channel | 4 weeks |
| S7-S8 | `ReviewAutomationService`: AI-generated review responses, review analysis, reputation scoring | 3 weeks |
| S9-S10 | `ChannelMixOptimizer`: channel allocation AI, commission optimization, demand routing | 3 weeks |
| S11-S12 | Frontend: operations dashboard, OTA insights, review management AI panel | 3 weeks |
| S13 | Integration testing, load testing, prompt optimization | 1 week |

**Infrastructure additions:**
- Kafka consumer groups for real-time event processing
- Scheduled jobs for daily/weekly AI analysis batches
- IoT data pipeline integration (Minut, Nuki event streams)

### 12.4 Phase 4: Assistant + UX Intelligence (2027)

**Duration:** 16-20 weeks
**Team:** 2 backend engineers + 2 frontend engineers + 1 ML engineer

| Sprint | Deliverable | Effort |
|--------|-------------|--------|
| S1-S3 | `PmsAssistantService`: function calling, tool registry, conversation management | 4 weeks |
| S4-S5 | Assistant frontend: chat panel, message rendering, tool execution UI | 3 weeks |
| S6-S7 | `AiOnboardingService`: listing import, smart setup, configuration validation | 3 weeks |
| S8-S9 | `AiInsightsService`: contextual recommendations, proactive alerts | 3 weeks |
| S10-S11 | `AiSmartDefaultsService`: behavioral learning, intelligent defaults | 2 weeks |
| S12-S13 | `AiAlertService`: real-time alert pipeline, WebSocket integration | 2 weeks |
| S14-S15 | RAG knowledge base: property manuals, FAQ, operational guides | 3 weeks |
| S16 | End-to-end testing, security audit, performance tuning | 2 weeks |

### 12.5 Success Metrics

| Metric | Phase 2 Target | Phase 3 Target | Phase 4 Target |
|--------|---------------|----------------|----------------|
| **Revenue per property** | +8-12% | +15-20% | +20-30% |
| **Guest response time** | < 5 min (from 2h avg) | < 2 min | < 1 min |
| **Pricing accuracy** | Within 10% of optimal | Within 5% | Within 3% |
| **Occupancy rate** | +5% | +10% | +15% |
| **Operational efficiency** | - | -30% manual scheduling | -50% manual tasks |
| **Guest satisfaction** | +0.2 avg rating | +0.4 avg rating | +0.5 avg rating |
| **OTA commission savings** | - | -5% avg commission | -10% avg commission |
| **Onboarding time** | - | - | -60% setup time |
| **Support tickets** | - | - | -40% (self-service AI) |

### 12.6 Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| **LLM hallucination** | All factual responses validated against DB. Tool calls return real data, not generated data. Confidence scores on all AI outputs. |
| **API cost overrun** | Per-org token budgets with hard limits. Aggressive caching (Redis). Prompt optimization. Batch processing where possible. |
| **Latency** | Circuit breakers (Resilience4j) with fallback to rule-based services. Async processing via Kafka. Response streaming for assistant. |
| **Data privacy** | PII anonymization layer before all LLM calls. No raw guest data sent to providers. GDPR-compliant data retention. |
| **Provider lock-in** | Abstraction layer supports multiple providers. Prompts stored separately from provider logic. Easy to swap OpenAI/Anthropic. |
| **Accuracy regression** | A/B testing framework for AI vs rule-based. Automated quality scoring. Human-in-the-loop for high-stakes decisions. |
| **Tenant isolation** | All queries scoped by organizationId. Separate embedding namespaces per org. Audit logging for all AI operations. |

### 12.7 Technical Dependencies

```
Phase 2 Prerequisites:
├── PostgreSQL pgvector extension
├── OpenAI API key (organization)
├── Anthropic API key (organization)
├── Redis cache expansion (2GB -> 4GB)
└── Kafka topic additions (3 new topics)

Phase 3 Prerequisites:
├── Phase 2 infrastructure complete
├── IoT data pipeline (Minut webhooks)
├── OTA API access for competitor data
├── Scheduled job framework (Spring @Scheduled)
└── Additional Kafka partitions

Phase 4 Prerequisites:
├── Phase 2 + 3 infrastructure complete
├── WebSocket infrastructure (STOMP)
├── RAG vector store populated
├── Frontend chat component library
└── Security audit completion
```

---

## Appendix A: AI Service Package Structure

```
com.clenzy.ai/
├── config/
│   ├── AiConfig.java                    # @Configuration, RestClient beans
│   ├── AiProperties.java               # @ConfigurationProperties
│   └── AiCacheConfig.java              # Cache definitions
├── provider/
│   ├── AiProvider.java                  # Interface
│   ├── OpenAiProvider.java              # GPT-4o implementation
│   ├── AnthropicProvider.java           # Claude implementation
│   └── RuleBasedFallbackProvider.java   # Fallback
├── budget/
│   ├── AiTokenBudgetService.java        # Budget enforcement
│   └── AiUsageRepository.java           # Usage tracking
├── security/
│   ├── AiAnonymizationService.java      # PII anonymization
│   └── AiAuditService.java             # Audit logging
├── rag/
│   ├── EmbeddingService.java            # Vector embeddings
│   ├── KnowledgeBaseService.java        # RAG retrieval
│   └── KnowledgeBaseRepository.java     # pgvector queries
├── pricing/
│   ├── AdvancedPricingService.java       # ML-powered pricing
│   └── MarketDataService.java           # Competitor analysis
├── messaging/
│   ├── SmartMessagingService.java        # LLM guest comms
│   └── IntentClassificationService.java # NLU intent detection
├── analytics/
│   ├── EnhancedAnalyticsService.java     # Time-series forecasting
│   └── AnomalyDetectionService.java     # Anomaly detection
├── operations/
│   ├── SmartSchedulingService.java       # AI scheduling
│   ├── PredictiveMaintenanceService.java # Failure prediction
│   └── NoiseIntelligenceService.java    # Smart noise alerts
├── ota/
│   ├── OtaOptimizationService.java       # Channel optimization
│   ├── ListingOptimizationService.java  # Listing AI
│   └── ReviewAutomationService.java     # Review responses
├── assistant/
│   ├── PmsAssistantService.java          # Chat assistant
│   ├── AssistantToolRegistry.java       # Function calling tools
│   └── ConversationService.java         # History management
├── insights/
│   ├── AiInsightsService.java            # Contextual insights
│   ├── AiAlertService.java              # Proactive alerts
│   └── AiSmartDefaultsService.java      # Intelligent defaults
└── onboarding/
    ├── AiOnboardingService.java          # Guided setup
    └── ListingImportService.java        # OTA listing import
```

---

## Appendix B: Database Schema Additions

```sql
-- Phase 2: AI infrastructure
CREATE TABLE ai_token_usage (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id),
    feature         VARCHAR(50) NOT NULL,
    tokens_used     INTEGER NOT NULL,
    cost_usd        DECIMAL(10,6),
    provider        VARCHAR(20) NOT NULL,
    model           VARCHAR(50) NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ai_usage_org_feature ON ai_token_usage(organization_id, feature, created_at);

CREATE TABLE ai_token_budgets (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id),
    feature         VARCHAR(50) NOT NULL,
    monthly_limit   INTEGER NOT NULL,
    current_usage   INTEGER NOT NULL DEFAULT 0,
    period_start    DATE NOT NULL,
    UNIQUE(organization_id, feature, period_start)
);

-- Phase 2: Knowledge base (RAG)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE ai_knowledge_base (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id),
    source_type     VARCHAR(50) NOT NULL,
    source_id       BIGINT,
    title           VARCHAR(500),
    content         TEXT NOT NULL,
    embedding       vector(1536),
    metadata        JSONB,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_knowledge_embedding ON ai_knowledge_base
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_knowledge_org ON ai_knowledge_base(organization_id, source_type);

-- Phase 3: Predictive maintenance
CREATE TABLE ai_equipment_lifecycle (
    id              BIGSERIAL PRIMARY KEY,
    property_id     BIGINT NOT NULL REFERENCES properties(id),
    equipment_type  VARCHAR(100) NOT NULL,
    install_date    DATE,
    expected_life   INTEGER,
    failure_score   DECIMAL(3,2),
    last_assessed   TIMESTAMP,
    metadata        JSONB
);

-- Phase 4: Assistant
CREATE TABLE ai_conversations (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id),
    user_id         BIGINT NOT NULL REFERENCES users(id),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE ai_conversation_messages (
    id              BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES ai_conversations(id),
    role            VARCHAR(20) NOT NULL,
    content         TEXT NOT NULL,
    tool_calls      JSONB,
    tokens_used     INTEGER,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_messages ON ai_conversation_messages(conversation_id, created_at);

CREATE TABLE ai_assistant_audit (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id),
    user_id         BIGINT NOT NULL,
    tool_name       VARCHAR(100) NOT NULL,
    tool_input      JSONB,
    tool_output     JSONB,
    success         BOOLEAN NOT NULL,
    execution_ms    INTEGER,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_org ON ai_assistant_audit(organization_id, created_at);

-- Phase 4: Alerts
CREATE TABLE ai_alerts (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id),
    alert_type      VARCHAR(50) NOT NULL,
    severity        VARCHAR(20) NOT NULL,
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    context         JSONB,
    acknowledged    BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_by BIGINT REFERENCES users(id),
    acknowledged_at TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_alerts_org ON ai_alerts(organization_id, acknowledged, created_at);
```

---

## Appendix C: Configuration Reference

```yaml
clenzy:
  ai:
    # Master switch
    enabled: true

    # Provider configuration
    openai:
      api-key: ${OPENAI_API_KEY}
      model: gpt-4o
      embedding-model: text-embedding-3-small
      base-url: https://api.openai.com/v1
    anthropic:
      api-key: ${ANTHROPIC_API_KEY}
      model: claude-sonnet-4-20250514
      base-url: https://api.anthropic.com/v1

    # Feature flags (each independently toggleable)
    features:
      design-analysis: true
      advanced-pricing: false
      smart-messaging: false
      enhanced-analytics: false
      sentiment-v2: false
      smart-scheduling: false
      predictive-maintenance: false
      ota-optimization: false
      review-automation: false
      pms-assistant: false
      ai-onboarding: false
      ai-insights: false
      proactive-alerts: false

    # Token budgets (per org per month)
    budgets:
      starter:
        monthly-tokens: 100000
        features: [design-analysis, smart-messaging]
      professional:
        monthly-tokens: 500000
        features: [design-analysis, smart-messaging, advanced-pricing, enhanced-analytics, sentiment-v2]
      enterprise:
        monthly-tokens: 2000000
        features: ALL
      unlimited:
        monthly-tokens: -1
        features: ALL

    # RAG configuration
    rag:
      chunk-size: 500
      chunk-overlap: 50
      max-results: 5
      similarity-threshold: 0.75

    # Website fetch (design analysis)
    website-fetch:
      timeout-seconds: 15
      max-content-length-kb: 512

    # Anonymization
    anonymization:
      enabled: true
      patterns:
        - type: EMAIL
          replacement: "[EMAIL_REDACTED]"
        - type: PHONE
          replacement: "[PHONE_REDACTED]"
        - type: CREDIT_CARD
          replacement: "[CC_REDACTED]"

    # Rate limiting
    rate-limits:
      assistant:
        per-user-per-hour: 50
        per-org-per-hour: 200
      design-analysis:
        per-org-per-day: 20
      pricing:
        per-org-per-hour: 100
```

---

> **End of document.** This strategy provides a comprehensive, phased approach to AI integration that respects Clenzy's existing architecture while progressively adding intelligence across all platform domains. Each phase builds on the previous one, ensuring incremental value delivery with manageable risk.
