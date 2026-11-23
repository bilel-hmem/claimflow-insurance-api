import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { API_PREFIX, configureApp } from '../../src/app.setup';
import { Role } from '../../src/common/enums/role.enum';
import { User } from '../../src/modules/users/user.entity';

export const API = `/${API_PREFIX}`;
export const PASSWORD = 'Passw0rd!';

export interface TestUser {
  id: number;
  email: string;
  token: string;
}

export interface World {
  admin: TestUser;
  adjuster: TestUser;
  amira: TestUser;
  karim: TestUser;
  policyId: number;
  /** Yesterday, inside the policy period */
  incidentDate: string;
}

/** Same pipes, filters and prefix as production. Listens on a random port. */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.listen(0);
  return app;
}

export async function resetDatabase(app: INestApplication): Promise<void> {
  const dataSource = app.get(DataSource);
  const database = String(dataSource.options.database);
  if (!database.endsWith('_test')) {
    throw new Error(`Refusing to truncate tables in "${database}"`);
  }
  const runner = dataSource.createQueryRunner();
  try {
    await runner.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of [
      'claim_status_history',
      'claim_documents',
      'claims',
      'policies',
      'users',
    ]) {
      await runner.query(`TRUNCATE TABLE \`${table}\``);
    }
    await runner.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    await runner.release();
  }
}

/** YYYY-MM-DD, `days` from today (local time, like the API). */
export function isoDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function auth(user: TestUser): [string, string] {
  return ['Authorization', `Bearer ${user.token}`];
}

async function login(app: INestApplication, email: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post(`${API}/auth/login`)
    .send({ email, password: PASSWORD })
    .expect(200);
  return res.body.accessToken;
}

export async function registerPolicyholder(app: INestApplication, name: string): Promise<TestUser> {
  const email = `${name.toLowerCase()}@claimflow.test`;
  const res = await request(app.getHttpServer())
    .post(`${API}/auth/register`)
    .send({ fullName: name, email, password: PASSWORD })
    .expect(201);
  return { id: res.body.id, email, token: await login(app, email) };
}

/** The first admin cannot be created through the API (by design), so it is promoted in the DB. */
async function createAdmin(app: INestApplication): Promise<TestUser> {
  const user = await registerPolicyholder(app, 'Admin');
  await app.get(DataSource).getRepository(User).update(user.id, { role: Role.ADMIN });
  return { ...user, token: await login(app, user.email) };
}

/**
 * Admin, adjuster, two policyholders, and an active AUTO policy for Amira
 * (5,000 TND coverage, started 300 days ago, ends in 60 days).
 */
export async function createWorld(app: INestApplication): Promise<World> {
  const server = app.getHttpServer();
  const admin = await createAdmin(app);

  const adjusterRes = await request(server)
    .post(`${API}/users`)
    .set(...auth(admin))
    .send({
      fullName: 'Sami Adjuster',
      email: 'sami@claimflow.test',
      password: PASSWORD,
      role: 'ADJUSTER',
    })
    .expect(201);
  const adjuster = {
    id: adjusterRes.body.id,
    email: 'sami@claimflow.test',
    token: await login(app, 'sami@claimflow.test'),
  };

  const amira = await registerPolicyholder(app, 'Amira');
  const karim = await registerPolicyholder(app, 'Karim');

  const policy = await request(server)
    .post(`${API}/policies`)
    .set(...auth(admin))
    .send({
      holderEmail: amira.email,
      type: 'AUTO',
      coverageLimit: 5_000_000,
      startDate: isoDate(-300),
      endDate: isoDate(60),
    })
    .expect(201);

  return { admin, adjuster, amira, karim, policyId: policy.body.id, incidentDate: isoDate(-1) };
}

export const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n');
