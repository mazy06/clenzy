import { apiClient } from '@/api/apiClient';
import { baitlyDataMode } from '@/config/baitlyDataMode';
import { useBaitlyDemoProfile } from '@/config/baitlyDemoProfileState';
export interface RestockItem { id: number; name: string; unit?: string; quantity: number; threshold: number; suggested: number; photoUrl?: string; catalogKey?: string }
export interface RestockLine { itemId: number; expected: number; observed: number; added: number; unitPrice: number }
export interface RestockRequest { requestKey: string; lines: RestockLine[] }
export interface RestockEntry { itemId: number; name: string; unit?: string; before: number; observed: number; added: number; after: number; unitPrice: number; amount: number; currency: string; expenseId?: number }
export interface RestockReceipt { requestKey: string; date: string; actor: string; entries: RestockEntry[] }
export interface RestockOverview { items: RestockItem[]; currency: string; history: RestockReceipt[] }
const demo = new Map<string, RestockOverview>();
function demoStock(id: number) {
  if (baitlyDataMode() !== 'demo') throw { status: 404 };
  const key = `${useBaitlyDemoProfile.getState().key}:${id}`;
  if (!demo.has(key)) demo.set(key, { currency: 'MAD', history: [], items: [
    { id: -21, name: 'Savon', catalogKey: 'hand-soap', unit: 'flacon', quantity: 1, threshold: 2, suggested: 4 },
    { id: -22, name: 'Papier toilette', catalogKey: 'toilet-paper', unit: 'rouleau', quantity: 2, threshold: 4, suggested: 6 },
    { id: -23, name: 'Capsules de café', catalogKey: 'coffee-capsules', unit: 'capsule', quantity: 4, threshold: 6, suggested: 10 },
  ] });
  return demo.get(key)!;
}
export const restockApi = {
  list: async (id: number): Promise<RestockOverview> => id < 0 ? JSON.parse(JSON.stringify(demoStock(id))) : apiClient.get(`/mobile/missions/${id}/restock`),
  record: async (id: number, request: RestockRequest): Promise<RestockReceipt> => {
    if (id >= 0) return apiClient.post(`/mobile/missions/${id}/restock`, request);
    const stock = demoStock(id); const existing = stock.history.find(receipt => receipt.requestKey === request.requestKey);
    if (existing) return existing;
    const entries = request.lines.map(line => {
      const item = stock.items.find(item => item.id === line.itemId);
      if (!item || item.quantity !== line.expected) throw { status: 409 };
      return { ...line, before: item.quantity, after: line.observed + line.added, name: item.name, currency: stock.currency,
        amount: Math.round(line.unitPrice * 100) * line.added / 100 };
    });
    const receipt = { requestKey: request.requestKey, date: new Date().toISOString(), actor: 'Démo', entries };
    stock.items = stock.items.map(item => ({ ...item, quantity: entries.find(line => line.itemId === item.id)?.after ?? item.quantity }));
    stock.history = [...stock.history, receipt]; return receipt;
  },
};
