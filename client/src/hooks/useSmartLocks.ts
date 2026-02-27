import { useState, useCallback, useMemo, useEffect } from 'react';
import storageService, { STORAGE_KEYS } from '../services/storageService';
import { useTranslation } from './useTranslation';
import { smartLockApi, type SmartLockDeviceDto } from '../services/api/smartLockApi';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SmartLockDevice {
  id: string;
  name: string;
  propertyId: number;
  propertyName: string;
  roomName: string | null;
  externalDeviceId: string | null;
  status: string;
  lockState: string;
  batteryLevel: number | null;
  createdAt: string;
}

export type SmartLockView = 'offers' | 'config-form' | 'devices';

export interface SmartLockFormState {
  activeStep: number;
  selectedPropertyId: number | null;
  selectedPropertyName: string;
  roomName: string;
  deviceName: string;
  externalDeviceId: string;
}

const INITIAL_FORM: SmartLockFormState = {
  activeStep: 0,
  selectedPropertyId: null,
  selectedPropertyName: '',
  roomName: '',
  deviceName: '',
  externalDeviceId: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadDevices(): SmartLockDevice[] {
  return storageService.getJSON<SmartLockDevice[]>(STORAGE_KEYS.SMART_LOCK_DEVICES) || [];
}

function saveDevices(devices: SmartLockDevice[]): void {
  storageService.setJSON(STORAGE_KEYS.SMART_LOCK_DEVICES, devices);
}

function generateId(): string {
  return `lock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Map backend DTO to local SmartLockDevice format */
function mapDtoToDevice(dto: SmartLockDeviceDto): SmartLockDevice {
  return {
    id: String(dto.id),
    name: dto.name,
    propertyId: dto.propertyId,
    propertyName: dto.propertyName || `Propriete #${dto.propertyId}`,
    roomName: dto.roomName || null,
    externalDeviceId: dto.externalDeviceId || null,
    status: dto.status,
    lockState: dto.lockState || 'UNKNOWN',
    batteryLevel: dto.batteryLevel,
    createdAt: dto.createdAt || new Date().toISOString(),
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSmartLocks() {
  const { t } = useTranslation();

  // ── Devices state (persisted locally + synced with backend) ──
  const [devices, setDevices] = useState<SmartLockDevice[]>(loadDevices);
  const [isLoading, setIsLoading] = useState(false);
  const [useBackend, setUseBackend] = useState(false);

  // ── Lock action loading state ──
  const [lockingDeviceId, setLockingDeviceId] = useState<string | null>(null);

  // ── View state ──
  const [currentView, setCurrentView] = useState<SmartLockView>(() =>
    loadDevices().length > 0 ? 'devices' : 'offers',
  );

  // ── Form state ──
  const [form, setForm] = useState<SmartLockFormState>(INITIAL_FORM);

  const hasDevices = devices.length > 0;

  // ── Try to load devices from backend on mount ──
  useEffect(() => {
    let cancelled = false;

    async function fetchDevices() {
      try {
        setIsLoading(true);
        const backendDevices = await smartLockApi.getAll();
        if (!cancelled && backendDevices && Array.isArray(backendDevices)) {
          const mapped = backendDevices.map(mapDtoToDevice);
          setDevices(mapped);
          saveDevices(mapped);
          setUseBackend(true);

          if (mapped.length > 0) {
            setCurrentView('devices');
          }
        }
      } catch {
        // Backend unavailable — use local storage data
        setUseBackend(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchDevices();
    return () => { cancelled = true; };
  }, []);

  // ── View navigation ──
  const setView = useCallback((view: SmartLockView) => {
    setCurrentView(view);
  }, []);

  // ── Device CRUD ──
  const addDevice = useCallback(
    async (device: Omit<SmartLockDevice, 'id' | 'createdAt' | 'status' | 'lockState' | 'batteryLevel'>) => {
      if (useBackend) {
        try {
          const dto = await smartLockApi.create({
            name: device.name,
            propertyId: device.propertyId,
            roomName: device.roomName || undefined,
            externalDeviceId: device.externalDeviceId || undefined,
          });
          const newDevice = mapDtoToDevice(dto);
          setDevices((prev) => {
            const updated = [...prev, newDevice];
            saveDevices(updated);
            return updated;
          });
          return;
        } catch {
          // Fallback to local
        }
      }

      const newDevice: SmartLockDevice = {
        ...device,
        id: generateId(),
        status: 'ACTIVE',
        lockState: 'UNKNOWN',
        batteryLevel: null,
        createdAt: new Date().toISOString(),
      };
      setDevices((prev) => {
        const updated = [...prev, newDevice];
        saveDevices(updated);
        return updated;
      });
    },
    [useBackend],
  );

  const removeDevice = useCallback(
    async (id: string) => {
      if (useBackend) {
        try {
          const numericId = parseInt(id, 10);
          if (!isNaN(numericId)) {
            await smartLockApi.delete(numericId);
          }
        } catch {
          // Continue with local removal
        }
      }

      setDevices((prev) => {
        const updated = prev.filter((d) => d.id !== id);
        saveDevices(updated);
        return updated;
      });
    },
    [useBackend],
  );

  // ── Lock / Unlock ──
  const toggleLock = useCallback(
    async (deviceId: string, lock: boolean) => {
      const numericId = parseInt(deviceId, 10);
      if (isNaN(numericId)) return;

      setLockingDeviceId(deviceId);
      try {
        if (lock) {
          await smartLockApi.lock(numericId);
        } else {
          await smartLockApi.unlock(numericId);
        }

        // Update local state
        setDevices((prev) => {
          const updated = prev.map((d) =>
            d.id === deviceId
              ? { ...d, lockState: lock ? 'LOCKED' : 'UNLOCKED' }
              : d,
          );
          saveDevices(updated);
          return updated;
        });
      } catch {
        // Error handling — keep current state
      } finally {
        setLockingDeviceId(null);
      }
    },
    [],
  );

  // ── Form helpers ──
  const setFormField = useCallback(
    <K extends keyof SmartLockFormState>(key: K, value: SmartLockFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const resetForm = useCallback(() => {
    setForm(INITIAL_FORM);
  }, []);

  const startConfigFlow = useCallback(() => {
    setForm(INITIAL_FORM);
    setCurrentView('config-form');
  }, []);

  // ── Stepper logic ──
  const configSteps = useMemo(
    () => [
      t('dashboard.smartLock.config.stepProperty') || 'Propriete',
      t('dashboard.smartLock.config.stepRoom') || 'Piece',
      t('dashboard.smartLock.config.stepDevice') || 'Appareil',
      t('dashboard.smartLock.config.stepConfirm') || 'Confirmation',
    ],
    [t],
  );

  const canGoNextConfig = useMemo(() => {
    switch (form.activeStep) {
      case 0:
        return form.selectedPropertyId !== null;
      case 1:
        return true; // room is optional
      case 2:
        return form.deviceName.trim().length > 0;
      case 3:
        return true; // confirm step
      default:
        return false;
    }
  }, [form.activeStep, form.selectedPropertyId, form.deviceName]);

  const handleConfigNext = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      activeStep: Math.min(prev.activeStep + 1, 3),
    }));
  }, []);

  const handleConfigBack = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      activeStep: Math.max(prev.activeStep - 1, 0),
    }));
  }, []);

  const handleConfigSubmit = useCallback(() => {
    addDevice({
      name: form.deviceName.trim(),
      propertyId: form.selectedPropertyId!,
      propertyName: form.selectedPropertyName,
      roomName: form.roomName.trim() || null,
      externalDeviceId: form.externalDeviceId.trim() || null,
    });
    resetForm();
    setCurrentView('devices');
  }, [form, addDevice, resetForm]);

  return {
    // View
    currentView,
    setView,

    // Devices
    devices,
    addDevice,
    removeDevice,
    hasDevices,
    isLoading,

    // Lock actions
    toggleLock,
    lockingDeviceId,

    // Form
    form,
    setFormField,
    resetForm,
    startConfigFlow,

    // Stepper
    configSteps,
    canGoNextConfig,
    handleConfigNext,
    handleConfigBack,
    handleConfigSubmit,
  };
}
