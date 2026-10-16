import apiClient from '../apiClient';
export interface BaitlyRestockReceipt {
  requestKey: string; date: string; actor: string;
  entries: { itemId: number; name: string; before: number; observed: number; added: number; after: number; amount: number; currency: string; expenseId?: number }[];
}
export const baitlyRestockApi = {
  history: async (id: number): Promise<BaitlyRestockReceipt[]> => {
    const result = await apiClient.get<{ history: BaitlyRestockReceipt[] }>(`/mobile/missions/${id}/restock`);
    return result.history;
  },
};
