import { create } from 'zustand';

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  visible: boolean;
}

interface UiState {
  toast: ToastState;
  showToast: (message: string, type?: ToastState['type']) => void;
  hideToast: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  toast: { message: '', type: 'info', visible: false },

  showToast: (message, type = 'info') => {
    set({ toast: { message, type, visible: true } });
  },

  hideToast: () => {
    set((state) => ({ toast: { ...state.toast, visible: false } }));
  },
}));
