import assistant from '../../public/images/assistant/baitly-assistant.webp';
import received from '../../public/images/finance-kpis/received.png';
import pending from '../../public/images/finance-kpis/pending.png';
import transfer from '../../public/images/finance-kpis/transfer.png';
import documents from '../../public/images/finance-kpis/documents.png';
import revenue from '../../public/images/dashboard-kpis/revenue.webp';
import bookings from '../../public/images/dashboard-kpis/bookings.webp';
import occupancy from '../../public/images/dashboard-kpis/occupancy.webp';
import rating from '../../public/images/dashboard-kpis/rating.webp';
import timeSaved from '../../public/images/portfolio-metrics/time-saved.webp';
import automated from '../../public/images/portfolio-metrics/automated-actions.webp';
import review from '../../public/images/portfolio-metrics/pending-review.webp';
import { AGENT_PORTRAITS } from '../../src/modules/supervision/core/agentPortraitAssets';

/** Canonical PMS artwork bundled by Vite: the public site needs no PMS server. */
export const SITE_AGENT_PORTRAITS = AGENT_PORTRAITS;
export const SITE_PRODUCT_ARTWORK = { assistant, received, pending, transfer, documents, revenue, bookings, occupancy, rating, timeSaved, automated, review };
