import { useState, useCallback, useMemo, useEffect } from 'react';
import storageService, { STORAGE_KEYS } from '../services/storageService';
import {
  type PropertyNoiseData,
  generateMockNoiseHistory,
  generateMockAlerts,
} from './useNoiseMonitoring';
import { useTranslation } from './useTranslation';
import { noiseDevicesApi, type NoiseDeviceDto } from '../services/api/noiseApi';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NoiseDevice {
  id: string;
  type: 'minut' | 'clenzy';
  name: string;
  propertyId: number;
  propertyName: string;
  roomName: string | null;
  status: 'active';
  createdAt: string;
}

export type NoiseView =
  | 'offers'
  | 'minut-detail'
  | 'clenzy-detail'
  | 'config-form'
  | 'devices';

export interface NoiseDeviceFormState {
  deviceType: 'minut' | 'clenzy';
  activeStep: number;
  selectedPropertyId: number | null;
  selectedPropertyName: string;
  roomName: string;
  deviceName: string;
}

const INITIAL_FORM: NoiseDeviceFormState = {
  deviceType: 'minut',
  activeStep: 0,
  selectedPropertyId: null,
  selectedPropertyName: '',
  roomName: '',
  deviceName: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadDevices(): NoiseDevice[] {
  return storageService.getJSON<NoiseDevice[]>(STORAGE_KEYS.NOISE_DEVICES) || [];
}

function saveDevices(devices: NoiseDevice[]): void {
  storageService.setJSON(STORAGE_KEYS.NOISE_DEVICES, devices);
}

function generateId(): string {
  return `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Map backend DTO to local NoiseDevice format */
function mapDtoToDevice(dto: NoiseDeviceDto): NoiseDevice {
  return {
    id: String(dto.id),
    type: dto.deviceType.toLowerCase() === 'minut' ? 'minut' : 'clenzy',
    name: dto.name,
    propertyId: dto.propertyId,
    propertyName: dto.propertyName || `Propriete #${dto.propertyId}`,
    roomName: dto.roomName || null,
    status: 'active',
    createdAt: dto.createdAt || new Date().toISOString(),
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNoiseDevices() {
  const { t } = useTranslation();

  // ── Devices state (persisted locally + synced with backend) ──
  const [devices, setDevices] = useState<NoiseDevice[]>(loadDevices);
  const [isLoading, setIsLoading] = useState(false);
  const [useBackend, setUseBackend] = useState(false);

  // ── View state ──
  const [currentView, setCurrentView] = useState<NoiseView>(() =>
    loadDevices().length > 0 ? 'devices' : 'offers',
  );

  // ── Form state ──
  const [form, setForm] = useState<NoiseDeviceFormState>(INITIAL_FORM);

  const hasDevices = devices.length > 0;

  // ── Try to load devices from backend on mount ──
  useEffect(() => {
    let cancelled = false;

    async function fetchDevices() {
      try {
        setIsLoading(true);
        const backendDevices = await noiseDevicesApi.getAll();
        if (!cancelled && backendDevices && Array.isArray(backendDevices)) {
          const mapped = backendDevices.map(mapDtoToDevice);
          setDevices(mapped);
          saveDevices(mapped);
          setUseBackend(true);

          // Update view if we received devices
          if (mapped.length > 0) {
            setCurrentView('devices');
          }
        }
      } catch {
        // Backend unavailable — use local storage data (mock mode)
        setUseBackend(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchDevices();
    return () => { cancelled = true; };
  }, []);

  // ── View navigation ──
  const setView = useCallback((view: NoiseView) => {
    setCurrentView(view);
  }, []);

  // ── Device CRUD ──
  const addDevice = useCallback(
    async (device: Omit<NoiseDevice, 'id' | 'createdAt'>) => {
      // Try backend first
      if (useBackend) {
        try {
          const dto = await noiseDevicesApi.create({
            deviceType: device.type.toUpperCase(),
            name: device.name,
            propertyId: device.propertyId,
            roomName: device.roomName || undefined,
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

      // Local fallback
      const newDevice: NoiseDevice = {
        ...device,
        id: generateId(),
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
      // Try backend first
      if (useBackend) {
        try {
          const numericId = parseInt(id, 10);
          if (!isNaN(numericId)) {
            await noiseDevicesApi.delete(numericId);
          }
        } catch {
          // Continue with local removal even if backend fails
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

  // ── Form helpers ──
  const setFormField = useCallback(
    <K extends keyof NoiseDeviceFormState>(key: K, value: NoiseDeviceFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const resetForm = useCallback(() => {
    setForm(INITIAL_FORM);
  }, []);

  const startConfigFlow = useCallback(
    (type: 'minut' | 'clenzy') => {
      setForm({ ...INITIAL_FORM, deviceType: type });
      setCurrentView('config-form');
    },
    [],
  );

  // ── Stepper logic ──
  const configSteps = useMemo(
    () => [
      t('dashboard.noise.config.stepProperty') || 'Propriete',
      t('dashboard.noise.config.stepRoom') || 'Piece',
      t('dashboard.noise.config.stepName') || 'Nom',
      t('dashboard.noise.config.stepConfirm') || 'Confirmation',
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
      type: form.deviceType,
      name: form.deviceName.trim(),
      propertyId: form.selectedPropertyId!,
      propertyName: form.selectedPropertyName,
      roomName: form.roomName.trim() || null,
      status: 'active',
    });
    resetForm();
    setCurrentView('devices');
  }, [form, addDevice, resetForm]);

  // ── Mock chart data per device (fallback when backend has no real data) ──
  const deviceNoiseData: PropertyNoiseData[] = useMemo(() => {
    return devices.map((device, idx) => {
      const label = device.roomName
        ? `${device.propertyName} - ${device.roomName}`
        : device.propertyName;
      const baseLevel = 42 + idx * 3;
      const history = generateMockNoiseHistory(label, baseLevel);
      const alerts = generateMockAlerts(label, history);
      const levels = history.map((h) => h.decibels);

      return {
        propertyId: device.propertyId,
        propertyName: label,
        currentLevel: levels[levels.length - 1] || 0,
        averageLevel: Math.round(levels.reduce((a, b) => a + b, 0) / levels.length),
        maxLevel: Math.max(...levels),
        history,
        alerts,
      };
    });
  }, [devices]);

  const deviceChartData = useMemo(() => {
    if (deviceNoiseData.length === 0) return [];
    const firstProp = deviceNoiseData[0];
    return firstProp.history.map((point, idx) => {
      const entry: Record<string, string | number> = { time: point.time };
      deviceNoiseData.forEach((prop) => {
        entry[prop.propertyName] = prop.history[idx]?.decibels || 0;
      });
      return entry;
    });
  }, [deviceNoiseData]);

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

    // Chart data
    deviceNoiseData,
    deviceChartData,
  };
}
