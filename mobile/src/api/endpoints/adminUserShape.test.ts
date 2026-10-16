import { fromAdminUser, toAdminUser } from './adminUserShape';

type U = { id: number; roles: string[]; phone?: string; enabled: boolean };
it('whenServerSendsASingleRole_thenScreensReceiveARolesList', () => {
  const user = toAdminUser<U>({ id: 1, role: 'HOST', phoneNumber: '+33 6', status: 'ACTIVE' });
  expect(user).toMatchObject({ roles: ['HOST'], phone: '+33 6', enabled: true });
  expect(toAdminUser<U>({ id: 2 }).roles).toEqual([]);
});
it('whenSavingAUser_thenServerFieldsAreSent', () => {
  expect(fromAdminUser({ firstName: 'A', roles: ['TECHNICIAN'], phone: '06', enabled: false }))
    .toEqual({ firstName: 'A', role: 'TECHNICIAN', phoneNumber: '06', status: 'SUSPENDED' });
});
