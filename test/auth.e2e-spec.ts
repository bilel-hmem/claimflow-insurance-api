import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  API,
  auth,
  createTestApp,
  createWorld,
  PASSWORD,
  registerPolicyholder,
  resetDatabase,
} from './utils/test-app';

describe('Auth, users and policies (e2e)', () => {
  let app: INestApplication;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('public sign-up always creates a policyholder', async () => {
    const res = await request(server())
      .post(`${API}/auth/register`)
      .send({ fullName: 'Amira', email: 'Amira@ClaimFlow.test', password: PASSWORD })
      .expect(201);
    expect(res.body).toMatchObject({ email: 'amira@claimflow.test', role: 'POLICYHOLDER' });
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('refuses a role in the sign-up body', async () => {
    const res = await request(server())
      .post(`${API}/auth/register`)
      .send({ fullName: 'Mallory', email: 'm@claimflow.test', password: PASSWORD, role: 'ADMIN' })
      .expect(400);
    expect(res.body.message).toContain('property role should not exist');
  });

  it('rejects a wrong password and protects routes', async () => {
    await registerPolicyholder(app, 'Amira');
    await request(server())
      .post(`${API}/auth/login`)
      .send({ email: 'amira@claimflow.test', password: 'Wr0ngPassword' })
      .expect(401);
    await request(server()).get(`${API}/claims`).expect(401);
  });

  it('only admins create staff accounts and issue policies', async () => {
    const amira = await registerPolicyholder(app, 'Amira');
    await request(server())
      .post(`${API}/users`)
      .set(...auth(amira))
      .send({ fullName: 'Me Admin', email: 'x@claimflow.test', password: PASSWORD, role: 'ADMIN' })
      .expect(403);
    await request(server())
      .post(`${API}/policies`)
      .set(...auth(amira))
      .send({})
      .expect(403);
  });

  it('issues a policy and shows it only to its holder', async () => {
    const w = await createWorld(app);

    const mine = await request(server())
      .get(`${API}/policies`)
      .set(...auth(w.amira))
      .expect(200);
    expect(mine.body.meta.total).toBe(1);
    expect(mine.body.data[0]).toMatchObject({
      type: 'AUTO',
      status: 'ACTIVE',
      coverageLimitFormatted: '5000.000 TND',
      holder: { email: w.amira.email },
    });

    await request(server())
      .get(`${API}/policies/${w.policyId}`)
      .set(...auth(w.karim))
      .expect(404);
  });

  it('validates policy dates', async () => {
    const w = await createWorld(app);
    const res = await request(server())
      .post(`${API}/policies`)
      .set(...auth(w.admin))
      .send({
        holderEmail: w.amira.email,
        type: 'HOME',
        coverageLimit: 1_000_000,
        startDate: '2026-12-31',
        endDate: '2026-01-01',
      })
      .expect(400);
    expect(res.body.message).toBe('endDate must be after startDate');
  });

  it('exposes a public health check', async () => {
    const res = await request(server()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
  });
});
