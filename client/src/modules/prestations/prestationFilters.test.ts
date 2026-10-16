import { describe, expect, it } from 'vitest';
import {
  buildPrestationFilters,
  categoryFromParam,
  legacyWorkOrdersTarget,
  parseAssignee,
  periodRange,
} from './prestationFilters';

const NOW = new Date(2026, 9, 15, 14, 30);

describe('periodRange', () => {
  it('bounds the coming week from today, both ends included', () => {
    expect(periodRange('next7', NOW)).toEqual({ from: '2026-10-15', to: '2026-10-21' });
  });

  it('stops the past period yesterday', () => {
    expect(periodRange('past30', NOW)).toEqual({ from: '2026-09-15', to: '2026-10-14' });
  });

  it('leaves dates open for all', () => {
    expect(periodRange('all', NOW)).toEqual({});
  });
});

describe('parseAssignee', () => {
  it('reads a team or a user', () => {
    expect(parseAssignee('team:3')).toEqual({ assigneeType: 'team', assigneeId: 3 });
    expect(parseAssignee('user:12')).toEqual({ assigneeType: 'user', assigneeId: 12 });
  });

  it('ignores anything else', () => {
    expect(parseAssignee('all')).toEqual({});
    expect(parseAssignee('robot:1')).toEqual({});
  });
});

describe('buildPrestationFilters', () => {
  it('maps the screen state to server filters', () => {
    expect(buildPrestationFilters({
      search: 'clim', category: 'request', status: 'PENDING', period: 'today', assignee: 'user:4', propertyId: 9,
    }, NOW)).toEqual({
      search: 'clim', type: 'all', status: 'PENDING', priority: 'all', propertyId: 9, category: 'request',
      from: '2026-10-15', to: '2026-10-15', assigneeType: 'user', assigneeId: 4,
    });
  });

  it('sends no category nor status when everything is shown', () => {
    const filters = buildPrestationFilters({ search: '', category: 'all', status: '', period: 'all', assignee: 'all' }, NOW);
    expect(filters.category).toBeUndefined();
    expect(filters.status).toBe('all');
  });
});

describe('categoryFromParam', () => {
  it('understands the old tab keys and the type parameter', () => {
    expect(categoryFromParam('interventions')).toBe('intervention');
    expect(categoryFromParam('service-requests')).toBe('request');
    expect(categoryFromParam('requests')).toBe('request');
    expect(categoryFromParam(null)).toBe('all');
  });
});

describe('legacyWorkOrdersTarget', () => {
  it('sends a manager from the old tabs to the Prestations view of the property map', () => {
    expect(legacyWorkOrdersTarget('?tab=service-requests')).toBe('/properties?tab=prestations&type=requests');
    expect(legacyWorkOrdersTarget('?tab=interventions&propertyId=5')).toBe('/properties?tab=prestations&type=interventions');
    expect(legacyWorkOrdersTarget('?tab=prestations')).toBe('/properties?tab=prestations');
  });

  it('keeps a provider on the Prestations tab, with their scope', () => {
    expect(legacyWorkOrdersTarget('?tab=service-requests&scope=inbox', true))
      .toBe('/interventions?tab=prestations&scope=inbox&type=requests');
    expect(legacyWorkOrdersTarget('?tab=prestations', true)).toBeNull();
  });

  it('opens the highlighted request directly', () => {
    expect(legacyWorkOrdersTarget('?tab=service-requests&highlight=7')).toBe('/service-requests/7');
    expect(legacyWorkOrdersTarget('?tab=service-requests&highlight=7', true)).toBe('/service-requests/7');
  });

  it('sends a manager from the Anomalies tab to the Anomalies view, opening the highlighted one', () => {
    expect(legacyWorkOrdersTarget('?tab=issues&highlight=12')).toBe('/properties?tab=issues&issue=12');
    expect(legacyWorkOrdersTarget('?tab=issues')).toBe('/properties?tab=issues');
    expect(legacyWorkOrdersTarget('?tab=issues', true)).toBeNull();
  });

  it('leaves the other tabs alone', () => {
    expect(legacyWorkOrdersTarget('?tab=calendar')).toBeNull();
    expect(legacyWorkOrdersTarget('')).toBeNull();
  });
});
