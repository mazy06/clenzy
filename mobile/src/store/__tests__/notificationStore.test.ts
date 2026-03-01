beforeEach(() => {
  const { useNotificationStore } = require('../notificationStore');
  useNotificationStore.setState({
    unreadCount: 0,
    fcmToken: null,
  });
});

function getStore() {
  const { useNotificationStore } = require('../notificationStore');
  return useNotificationStore;
}

describe('notificationStore', () => {
  it('should have default values', () => {
    const state = getStore().getState();
    expect(state.unreadCount).toBe(0);
    expect(state.fcmToken).toBeNull();
  });

  it('should set FCM token', () => {
    getStore().getState().setFcmToken('fcm-token-123');
    expect(getStore().getState().fcmToken).toBe('fcm-token-123');
  });

  it('should set unread count', () => {
    getStore().getState().setUnreadCount(5);
    expect(getStore().getState().unreadCount).toBe(5);
  });

  it('should increment unread', () => {
    getStore().getState().incrementUnread();
    expect(getStore().getState().unreadCount).toBe(1);
    getStore().getState().incrementUnread();
    expect(getStore().getState().unreadCount).toBe(2);
  });

  it('should reset unread to 0', () => {
    getStore().getState().setUnreadCount(10);
    getStore().getState().resetUnread();
    expect(getStore().getState().unreadCount).toBe(0);
  });
});
