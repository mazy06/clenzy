import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { usersApi, deferredPaymentsApi } from '../../../services/api';
import type { HostBalanceSummary, LockoutStatus } from '../../../services/api';
import type { UserDetailsData, UseUserDetailsReturn } from './userDetailsTypes';

export function useUserDetails(id: string | undefined): UseUserDetailsReturn {
  const { hasPermissionAsync } = useAuth();

  const [canManageUsers, setCanManageUsers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserDetailsData | null>(null);

  // Deferred payment state
  const [balance, setBalance] = useState<HostBalanceSummary | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [deferredToggling, setDeferredToggling] = useState(false);
  const [paymentLinkLoading, setPaymentLinkLoading] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');
  const [expandedProperty, setExpandedProperty] = useState<number | null>(null);

  // Lockout state
  const [lockoutStatus, setLockoutStatus] = useState<LockoutStatus | null>(null);
  const [lockoutLoading, setLockoutLoading] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const isAdminOrManager = canManageUsers;

  // Check permissions
  useEffect(() => {
    const checkPermissions = async () => {
      const result = await hasPermissionAsync('users:manage');
      setCanManageUsers(result);
    };
    checkPermissions();
  }, [hasPermissionAsync]);

  // Load user data
  useEffect(() => {
    const loadUser = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const userData = await usersApi.getById(Number(id));
        const convertedUser: UserDetailsData = {
          id: userData.id,
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          phoneNumber: userData.phoneNumber,
          role: userData.role?.toUpperCase() || 'HOST',
          status: userData.status?.toUpperCase() || 'ACTIVE',
          createdAt: userData.createdAt || '',
          updatedAt: userData.updatedAt,
          lastLoginAt: userData.lastLoginAt,
          companyName: userData.companyName,
          forfait: userData.forfait,
          city: userData.city,
          postalCode: userData.postalCode,
          propertyType: userData.propertyType,
          propertyCount: userData.propertyCount,
          surface: userData.surface,
          guestCapacity: userData.guestCapacity,
          bookingFrequency: userData.bookingFrequency,
          cleaningSchedule: userData.cleaningSchedule,
          calendarSync: userData.calendarSync,
          services: userData.services,
          servicesDevis: userData.servicesDevis,
          deferredPayment: userData.deferredPayment,
          organizationId: userData.organizationId,
          organizationName: userData.organizationName,
        };
        setUser(convertedUser);
      } catch {
        setError('Erreur lors du chargement de l\'utilisateur');
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [id]);

  // Load lockout status
  const loadLockoutStatus = useCallback(async () => {
    if (!user) return;
    setLockoutLoading(true);
    try {
      const data = await usersApi.getLockoutStatus(user.id);
      setLockoutStatus(data);
    } catch {
      setLockoutStatus(null);
    } finally {
      setLockoutLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && isAdminOrManager) {
      loadLockoutStatus();
    }
  }, [user, isAdminOrManager, loadLockoutStatus]);

  // Load balance for HOST users
  const loadBalance = useCallback(async () => {
    if (!user || user.role !== 'HOST') return;
    setBalanceLoading(true);
    try {
      const data = await deferredPaymentsApi.getHostBalance(user.id);
      setBalance(data);
    } catch {
      setBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && user.role === 'HOST' && isAdminOrManager) {
      loadBalance();
    }
  }, [user, isAdminOrManager, loadBalance]);

  // Handlers
  const handleUnlockUser = async () => {
    if (!user) return;
    setUnlocking(true);
    try {
      await usersApi.unlockUser(user.id);
      setSnackMessage('Utilisateur debloque avec succes');
      await loadLockoutStatus();
    } catch {
      setSnackMessage('Erreur lors du deblocage');
    } finally {
      setUnlocking(false);
    }
  };

  const handleToggleDeferredPayment = async () => {
    if (!user) return;
    setDeferredToggling(true);
    try {
      const newValue = !user.deferredPayment;
      await usersApi.update(user.id, { deferredPayment: newValue });
      setUser(prev => prev ? { ...prev, deferredPayment: newValue } : prev);
      setSnackMessage(newValue ? 'Paiement differe active' : 'Paiement differe desactive');
    } catch {
      setSnackMessage('Erreur lors de la mise a jour');
    } finally {
      setDeferredToggling(false);
    }
  };

  const handleSendPaymentLink = async () => {
    if (!user) return;
    setPaymentLinkLoading(true);
    try {
      const res = await deferredPaymentsApi.sendPaymentLink(user.id);
      await navigator.clipboard.writeText(res.sessionUrl);
      setSnackMessage('Lien de paiement copie dans le presse-papier !');
    } catch {
      setSnackMessage('Erreur lors de la creation du lien de paiement');
    } finally {
      setPaymentLinkLoading(false);
    }
  };

  return {
    user,
    loading,
    error,
    canManageUsers,
    balance,
    balanceLoading,
    deferredToggling,
    paymentLinkLoading,
    expandedProperty,
    setExpandedProperty,
    lockoutStatus,
    lockoutLoading,
    unlocking,
    snackMessage,
    setSnackMessage,
    handleToggleDeferredPayment,
    handleSendPaymentLink,
    handleUnlockUser,
  };
}
