export type PaymentProviderType = 'STRIPE' | 'PAYTABS' | 'CMI' | 'PAYZONE' | 'PAYPAL';

export interface PaymentMethodConfig {
  id: number;
  providerType: PaymentProviderType;
  enabled: boolean;
  countryCodes: string[];
  sandboxMode: boolean;
  config: Record<string, unknown> | null;
}

export interface PaymentMethodConfigUpdate {
  enabled?: boolean;
  countryCodes?: string;
  sandboxMode?: boolean;
  apiKey?: string;
  apiSecret?: string;
}

export interface WalletDto {
  id: number;
  walletType: 'PLATFORM' | 'OWNER' | 'CONCIERGE' | 'ESCROW';
  ownerId: number | null;
  currency: string;
  balance: number;
}

export interface LedgerEntryDto {
  id: number;
  entryType: 'DEBIT' | 'CREDIT';
  amount: number;
  currency: string;
  balanceAfter: number;
  referenceType: string;
  referenceId: string;
  description: string;
  createdAt: string;
}

export interface SplitConfiguration {
  id: number;
  name: string;
  ownerShare: number;
  platformShare: number;
  conciergeShare: number;
  isDefault: boolean;
  active: boolean;
}

export interface SplitRatios {
  ownerShare: number;
  platformShare: number;
  conciergeShare: number;
}

export interface EscrowHoldDto {
  id: number;
  reservationId: number;
  amount: number;
  currency: string;
  status: 'HELD' | 'RELEASED' | 'REFUNDED' | 'EXPIRED';
  heldAt: string;
  releasedAt: string | null;
  releaseTrigger: string | null;
}

export const PAYMENT_PROVIDER_LABELS: Record<PaymentProviderType, string> = {
  STRIPE: 'Stripe (Europe)',
  PAYTABS: 'PayTabs (Arabie Saoudite)',
  CMI: 'CMI (Maroc)',
  PAYZONE: 'Payzone (Maroc)',
  PAYPAL: 'PayPal (Global)',
};

export const PAYMENT_PROVIDER_COUNTRIES: Record<PaymentProviderType, string[]> = {
  STRIPE: ['FR', 'MA', 'SA'],
  PAYTABS: ['SA', 'AE', 'BH', 'KW'],
  CMI: ['MA'],
  PAYZONE: ['MA'],
  PAYPAL: ['*'],
};
