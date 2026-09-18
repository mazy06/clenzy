import { expect, it } from 'vitest';
import { serviceRequestSchemaFor } from './serviceRequestSchema';
import { interventionSchemaFor } from './interventionSchema';

it('accepts a remote service without inventing a property while retaining the deadline',() => {
  const request={title:'Comptabilité',description:'',serviceItemCode:'accounting-lmnp',serviceType:'OTHER',
    propertyId:0,priority:'NORMAL',estimatedDurationHours:1,desiredDate:'2026-10-01T09:00'};
  expect(serviceRequestSchemaFor(false).safeParse(request).success).toBe(true);
  expect(serviceRequestSchemaFor(true).safeParse(request).success).toBe(false);
  expect(serviceRequestSchemaFor(false).safeParse({...request,desiredDate:''}).success).toBe(false);
});
it('keeps a requestor mandatory for remote missions',() => {
  const mission={title:'Traduction',serviceItemCode:'marketing-translation',type:'OTHER',status:'PENDING',
    propertyId:0,requestorId:7,priority:'NORMAL',estimatedDurationHours:1,scheduledDate:'2026-10-01T09:00'};
  expect(interventionSchemaFor(false).safeParse(mission).success).toBe(true);
  expect(interventionSchemaFor(true).safeParse(mission).success).toBe(false);
  expect(interventionSchemaFor(false).safeParse({...mission,requestorId:0}).success).toBe(false);
});
