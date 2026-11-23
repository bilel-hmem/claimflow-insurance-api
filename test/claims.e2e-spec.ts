import { INestApplication } from '@nestjs/common';
import { rm } from 'node:fs/promises';
import request from 'supertest';
import {
  API,
  auth,
  createTestApp,
  createWorld,
  isoDate,
  PDF,
  resetDatabase,
  TestUser,
  World,
} from './utils/test-app';

describe('Claims (e2e)', () => {
  let app: INestApplication;
  let w: World;
  const server = () => app.getHttpServer();

  const submit = (body: object = {}) =>
    request(server())
      .post(`${API}/claims`)
      .set(...auth(w.amira))
      .send({
        policyId: w.policyId,
        incidentDate: w.incidentDate,
        description: 'Rear-ended at a red light; rear bumper and trunk damaged.',
        amountClaimed: 1_850_000,
        ...body,
      });

  const move = (user: TestUser, claimId: number, body: object) =>
    request(server())
      .patch(`${API}/claims/${claimId}/status`)
      .set(...auth(user))
      .send(body);

  const assign = (claimId: number) =>
    request(server())
      .patch(`${API}/claims/${claimId}/assign`)
      .set(...auth(w.admin))
      .send({ adjusterId: w.adjuster.id })
      .expect(200);

  /** A claim already assigned and UNDER_REVIEW. */
  const claimUnderReview = async (): Promise<number> => {
    const claim = await submit().expect(201);
    await assign(claim.body.id);
    await move(w.adjuster, claim.body.id, { status: 'UNDER_REVIEW' }).expect(200);
    return claim.body.id;
  };

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    w = await createWorld(app);
  });

  afterAll(async () => {
    await app.close();
    await rm('tmp-test-uploads', { recursive: true, force: true });
  });

  it('runs a claim through its whole lifecycle with a full audit trail', async () => {
    const created = await submit().expect(201);
    const id = created.body.id;
    expect(created.body).toMatchObject({
      status: 'SUBMITTED',
      amountClaimedFormatted: '1850.000 TND',
      adjuster: null,
      availableTransitions: ['WITHDRAWN'],
    });
    expect(created.body.claimNumber).toMatch(/^CLM-\d{8}-[0-9A-F]{6}$/);

    const upload = await request(server())
      .post(`${API}/claims/${id}/documents`)
      .set(...auth(w.amira))
      .attach('file', PDF, { filename: 'constat amiable.pdf', contentType: 'application/pdf' })
      .expect(201);
    expect(upload.body).toMatchObject({
      originalName: 'constat amiable.pdf',
      mimeType: 'application/pdf',
    });

    await assign(id);
    const review = await move(w.adjuster, id, { status: 'UNDER_REVIEW' }).expect(200);
    expect(review.body.availableTransitions).toEqual(['APPROVED', 'REJECTED']);

    const approved = await move(w.adjuster, id, {
      status: 'APPROVED',
      amountApproved: 1_500_000,
      comment: 'Deductible applied',
    }).expect(200);
    expect(approved.body).toMatchObject({ status: 'APPROVED', amountApproved: 1_500_000 });

    const paid = await move(w.admin, id, { status: 'PAID' }).expect(200);
    expect(paid.body.status).toBe('PAID');
    expect(paid.body.closedAt).not.toBeNull();
    expect(paid.body.availableTransitions).toEqual([]);

    const timeline = await request(server())
      .get(`${API}/claims/${id}/timeline`)
      .set(...auth(w.amira))
      .expect(200);
    expect(
      timeline.body.map((e: { toStatus: string; changedBy: { role: string } }) => [
        e.toStatus,
        e.changedBy.role,
      ]),
    ).toEqual([
      ['SUBMITTED', 'POLICYHOLDER'],
      ['UNDER_REVIEW', 'ADJUSTER'],
      ['APPROVED', 'ADJUSTER'],
      ['PAID', 'ADMIN'],
    ]);
    expect(timeline.body[2].comment).toBe('Deductible applied');

    const download = await request(server())
      .get(`${API}/claims/${id}/documents/${upload.body.id}/download`)
      .set(...auth(w.adjuster))
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(download.headers['content-type']).toBe('application/pdf');
    expect(Buffer.compare(download.body as Buffer, PDF)).toBe(0);

    const report = await request(server())
      .get(`${API}/reports/claims-summary`)
      .set(...auth(w.admin))
      .expect(200);
    expect(report.body.byStatus).toMatchObject({ PAID: 1, SUBMITTED: 0 });
    expect(report.body.totals).toMatchObject({ claims: 1, amountPaid: 1_500_000 });
    expect(report.body.averageProcessingDays).toEqual(expect.any(Number));
  });

  describe('submission rules', () => {
    it('rejects an incident before the policy started', async () => {
      const res = await submit({ incidentDate: isoDate(-400) }).expect(422);
      expect(res.body.message).toContain('policy period');
    });

    it('rejects an incident in the future', async () => {
      await submit({ incidentDate: isoDate(1) }).expect(422);
    });

    it('rejects an amount above the coverage limit', async () => {
      const res = await submit({ amountClaimed: 5_000_001 }).expect(422);
      expect(res.body.message).toContain('5000.000 TND');
    });

    it('rejects claims on a cancelled policy', async () => {
      await request(server())
        .patch(`${API}/policies/${w.policyId}/cancel`)
        .set(...auth(w.admin))
        .expect(200);
      await submit().expect(422);
    });

    it("answers 404 for someone else's policy", async () => {
      await request(server())
        .post(`${API}/claims`)
        .set(...auth(w.karim))
        .send({
          policyId: w.policyId,
          incidentDate: w.incidentDate,
          description: 'Trying to claim on a policy that is not mine.',
          amountClaimed: 10_000,
        })
        .expect(404);
    });

    it('only lets policyholders file claims', async () => {
      await request(server())
        .post(`${API}/claims`)
        .set(...auth(w.adjuster))
        .send({})
        .expect(403);
    });
  });

  describe('workflow guards', () => {
    it('answers 409 for a move that does not exist', async () => {
      const claim = await submit().expect(201);
      const res = await move(w.admin, claim.body.id, { status: 'PAID' }).expect(409);
      expect(res.body.message).toBe('A claim cannot move from SUBMITTED to PAID');
    });

    it('answers 403 when the role may not make the move', async () => {
      const id = await claimUnderReview();
      await move(w.amira, id, { status: 'APPROVED', amountApproved: 1_000 }).expect(403);
      await move(w.admin, id, { status: 'APPROVED', amountApproved: 1_000 }).expect(403);
    });

    it('requires an amount to approve and a reason to reject', async () => {
      const id = await claimUnderReview();
      const approve = await move(w.adjuster, id, { status: 'APPROVED' }).expect(400);
      expect(approve.body.message).toContain('amountApproved must be an integer number');
      await move(w.adjuster, id, { status: 'REJECTED' }).expect(400);
    });

    it('never approves more than was claimed', async () => {
      const id = await claimUnderReview();
      await move(w.adjuster, id, { status: 'APPROVED', amountApproved: 1_850_001 }).expect(422);
    });

    it('stores the rejection reason and closes the claim', async () => {
      const id = await claimUnderReview();
      const res = await move(w.adjuster, id, {
        status: 'REJECTED',
        rejectionReason: 'Damage pre-dates the policy start date.',
      }).expect(200);
      expect(res.body).toMatchObject({
        status: 'REJECTED',
        rejectionReason: 'Damage pre-dates the policy start date.',
      });
      expect(res.body.closedAt).not.toBeNull();
    });

    it('lets the policyholder withdraw a claim that is not yet under review', async () => {
      const claim = await submit().expect(201);
      const res = await move(w.amira, claim.body.id, { status: 'WITHDRAWN' }).expect(200);
      expect(res.body.status).toBe('WITHDRAWN');
    });

    it('accepts only one of two simultaneous decisions', async () => {
      const id = await claimUnderReview();
      const [a, b] = await Promise.all([
        move(w.adjuster, id, { status: 'APPROVED', amountApproved: 1_000_000 }),
        move(w.adjuster, id, { status: 'REJECTED', rejectionReason: 'Duplicate of another claim' }),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);

      const timeline = await request(server())
        .get(`${API}/claims/${id}/timeline`)
        .set(...auth(w.admin))
        .expect(200);
      expect(timeline.body).toHaveLength(3);
    });
  });

  describe('visibility', () => {
    it('hides a claim from other policyholders and from adjusters it is not assigned to', async () => {
      const claim = await submit().expect(201);
      const id = claim.body.id;

      await request(server())
        .get(`${API}/claims/${id}`)
        .set(...auth(w.karim))
        .expect(404);
      await request(server())
        .get(`${API}/claims/${id}`)
        .set(...auth(w.adjuster))
        .expect(404);
      await move(w.adjuster, id, { status: 'UNDER_REVIEW' }).expect(404);

      await assign(id);
      await request(server())
        .get(`${API}/claims/${id}`)
        .set(...auth(w.adjuster))
        .expect(200);
    });

    it('scopes the list to the current user', async () => {
      await submit().expect(201);
      const unassigned = await submit().expect(201);

      const mine = await request(server())
        .get(`${API}/claims`)
        .set(...auth(w.amira))
        .expect(200);
      expect(mine.body.meta.total).toBe(2);

      const others = await request(server())
        .get(`${API}/claims`)
        .set(...auth(w.karim))
        .expect(200);
      expect(others.body.meta.total).toBe(0);

      await assign(unassigned.body.id);
      const queue = await request(server())
        .get(`${API}/claims?unassigned=true`)
        .set(...auth(w.admin))
        .expect(200);
      expect(queue.body.meta.total).toBe(1);

      const assigned = await request(server())
        .get(`${API}/claims`)
        .set(...auth(w.adjuster))
        .expect(200);
      expect(assigned.body.meta.total).toBe(1);
    });
  });

  describe('documents', () => {
    it('rejects a file whose content is not really a PDF or image', async () => {
      const claim = await submit().expect(201);
      const res = await request(server())
        .post(`${API}/claims/${claim.body.id}/documents`)
        .set(...auth(w.amira))
        .attach('file', Buffer.from('MZ\x90\x00 this is an executable'), {
          filename: 'invoice.pdf',
          contentType: 'application/pdf',
        })
        .expect(415);
      expect(res.body.message).toBe('Only PDF, PNG or JPEG files are accepted');
    });

    it('rejects files over 5 MB', async () => {
      const claim = await submit().expect(201);
      const big = Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024)]);
      await request(server())
        .post(`${API}/claims/${claim.body.id}/documents`)
        .set(...auth(w.amira))
        .attach('file', big, { filename: 'big.pdf', contentType: 'application/pdf' })
        .expect(413);
    });

    it('refuses documents on a closed claim', async () => {
      const claim = await submit().expect(201);
      await move(w.amira, claim.body.id, { status: 'WITHDRAWN' }).expect(200);
      await request(server())
        .post(`${API}/claims/${claim.body.id}/documents`)
        .set(...auth(w.amira))
        .attach('file', PDF, { filename: 'late.pdf', contentType: 'application/pdf' })
        .expect(409);
    });

    it("does not let other users list or download a claim's documents", async () => {
      const claim = await submit().expect(201);
      const doc = await request(server())
        .post(`${API}/claims/${claim.body.id}/documents`)
        .set(...auth(w.amira))
        .attach('file', PDF, { filename: 'a.pdf', contentType: 'application/pdf' })
        .expect(201);

      await request(server())
        .get(`${API}/claims/${claim.body.id}/documents`)
        .set(...auth(w.karim))
        .expect(404);
      await request(server())
        .get(`${API}/claims/${claim.body.id}/documents/${doc.body.id}/download`)
        .set(...auth(w.karim))
        .expect(404);
    });
  });
});
