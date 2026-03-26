import type { WidgetState, StateEvent } from './types';

type Listener = (state: WidgetState, event: StateEvent) => void;

const today = new Date();
const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

export function createInitialState(defaults?: Partial<WidgetState>): WidgetState {
  return {
    page: 'search',
    checkIn: null,
    checkOut: null,
    adults: defaults?.adults ?? 2,
    children: defaults?.children ?? 0,
    calendarOpen: false,
    calendarBaseMonth: currentMonth,
    guestsOpen: false,
    selectedPropertyType: null,
    availability: new Map(),
    propertyTypes: [],
    pricing: null,
    pricingLoading: false,
    addons: [],
    loading: false,
    error: null,
    guestForm: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      message: '',
    },
    guestFormErrors: {},
    ...defaults,
  };
}

export class StateManager {
  private state: WidgetState;
  private listeners: Map<StateEvent | '*', Set<Listener>> = new Map();

  constructor(initial: WidgetState) {
    this.state = initial;
  }

  get(): WidgetState {
    return this.state;
  }

  set(partial: Partial<WidgetState>, event: StateEvent = 'stateChange'): void {
    this.state = { ...this.state, ...partial };
    this.emit(event);
  }

  on(event: StateEvent | '*', listener: Listener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => this.listeners.get(event)?.delete(listener);
  }

  private emit(event: StateEvent): void {
    this.listeners.get(event)?.forEach(fn => fn(this.state, event));
    this.listeners.get('*')?.forEach(fn => fn(this.state, event));
  }

  destroy(): void {
    this.listeners.clear();
  }
}
