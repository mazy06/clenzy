import apiClient from '../apiClient';
import type { WalletDto, LedgerEntryDto } from '../../types/payment';

interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export const walletApi = {
  async getWallets(): Promise<WalletDto[]> {
    return apiClient.get<WalletDto[]>('/wallets');
  },

  async getBalance(walletId: number): Promise<WalletDto> {
    return apiClient.get<WalletDto>(`/wallets/${walletId}/balance`);
  },

  async getEntries(walletId: number, page = 0, size = 20): Promise<PaginatedResponse<LedgerEntryDto>> {
    return apiClient.get<PaginatedResponse<LedgerEntryDto>>(
      `/wallets/${walletId}/entries?page=${page}&size=${size}`
    );
  },
};
