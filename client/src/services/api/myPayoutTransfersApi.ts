import apiClient from '../apiClient';
import type { PaymentScope } from './paymentConnectApi';
import type { TransferState, TransferSource, TransferDetail } from './payoutTransfersApi';

export interface MyTransfer {
  id: number; source: TransferSource; description: string; amount: number; currency: string;
  state: TransferState; createdAt: string; updatedAt: string;
}
export interface MyTransferPage { content: MyTransfer[]; totalElements: number; totalPages: number }
export interface MyTransferDetail {
  transfer: MyTransfer;
  events: Array<{ state: TransferState; createdAt: string }>;
  bankPayouts: TransferDetail['bankPayouts'];
  recoveries?: TransferDetail['recoveries'];
}
export const myPayoutTransfersApi = {
  list: (scope: PaymentScope, page: number) => apiClient.get<MyTransferPage>(`/my-payout-transfers?scope=${scope}&page=${page}`),
  detail: (scope: PaymentScope, id: number) => apiClient.get<MyTransferDetail>(`/my-payout-transfers/${id}?scope=${scope}`),
};
