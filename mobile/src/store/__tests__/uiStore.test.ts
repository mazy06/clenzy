beforeEach(() => {
  const { useUiStore } = require('../uiStore');
  useUiStore.setState({
    toast: { message: '', type: 'info', visible: false },
  });
});

function getStore() {
  const { useUiStore } = require('../uiStore');
  return useUiStore;
}

describe('uiStore', () => {
  it('should have default toast state', () => {
    const state = getStore().getState();
    expect(state.toast.visible).toBe(false);
    expect(state.toast.message).toBe('');
    expect(state.toast.type).toBe('info');
  });

  it('should show toast with default type', () => {
    getStore().getState().showToast('Operation reussie');
    const state = getStore().getState();
    expect(state.toast.visible).toBe(true);
    expect(state.toast.message).toBe('Operation reussie');
    expect(state.toast.type).toBe('info');
  });

  it('should show toast with custom type', () => {
    getStore().getState().showToast('Erreur!', 'error');
    const state = getStore().getState();
    expect(state.toast.visible).toBe(true);
    expect(state.toast.message).toBe('Erreur!');
    expect(state.toast.type).toBe('error');
  });

  it('should hide toast preserving message', () => {
    getStore().getState().showToast('Test', 'success');
    getStore().getState().hideToast();
    const state = getStore().getState();
    expect(state.toast.visible).toBe(false);
    expect(state.toast.message).toBe('Test');
  });
});
