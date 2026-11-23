import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { Role } from '../../common/enums/role.enum';
import { todayIso } from '../../common/utils/date';
import { AuthService } from '../../modules/auth/auth.service';
import { ClaimsService } from '../../modules/claims/claims.service';
import { ClaimStatus } from '../../modules/claims/entities/claim-status.enum';
import { PoliciesService } from '../../modules/policies/policies.service';
import { PolicyType } from '../../modules/policies/policy.entity';
import { User } from '../../modules/users/user.entity';

/** Demo data listed in the README. Runs only on an empty database. */
const PASSWORD = 'Passw0rd!';

/** `days` from today, in the same local calendar as the API's own date checks. */
function isoDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return todayIso(date);
}

async function seed(): Promise<void> {
  // Reuses the real services, so seeded data follows the same rules and audit trail.
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const users = app.get(DataSource).getRepository(User);
    if ((await users.count()) > 0) {
      console.log('Database is not empty, seed skipped');
      return;
    }
    const auth = app.get(AuthService);
    const policies = app.get(PoliciesService);
    const claims = app.get(ClaimsService);

    const admin = await auth.createUser(
      { fullName: 'Leila Admin', email: 'admin@claimflow.tn', password: PASSWORD },
      Role.ADMIN,
    );
    const adjuster = await auth.createUser(
      { fullName: 'Sami Ben Ali', email: 'sami@claimflow.tn', password: PASSWORD },
      Role.ADJUSTER,
    );
    const amira = await auth.register({
      fullName: 'Amira Haddad',
      email: 'amira@claimflow.tn',
      password: PASSWORD,
    });
    await auth.register({
      fullName: 'Karim Jlassi',
      email: 'karim@claimflow.tn',
      password: PASSWORD,
    });
    console.log('Created 4 users');

    const auto = await policies.create({
      holderEmail: amira.email,
      type: PolicyType.AUTO,
      coverageLimit: 20_000_000,
      startDate: isoDate(-200),
      endDate: isoDate(165),
    });
    await policies.create({
      holderEmail: amira.email,
      type: PolicyType.HOME,
      coverageLimit: 50_000_000,
      startDate: isoDate(-30),
      endDate: isoDate(335),
    });
    console.log('Created 2 policies for amira@claimflow.tn');

    const asAmira = { id: amira.id, email: amira.email, role: Role.POLICYHOLDER };
    const asSami = { id: adjuster.id, email: adjuster.email, role: Role.ADJUSTER };
    const asAdmin = { id: admin.id, email: admin.email, role: Role.ADMIN };

    // One claim waiting for an adjuster...
    await claims.submit(asAmira, {
      policyId: auto.id,
      incidentDate: isoDate(-2),
      description: 'Side mirror broken by a passing scooter while parked in Lac 2.',
      amountClaimed: 350_000,
    });
    // ...and one already under review by Sami.
    const reviewed = await claims.submit(asAmira, {
      policyId: auto.id,
      incidentDate: isoDate(-10),
      description: 'Rear-ended at a red light on Avenue Habib Bourguiba; bumper and trunk damaged.',
      amountClaimed: 1_850_000,
    });
    await claims.assign(asAdmin, reviewed.id, adjuster.id);
    await claims.changeStatus(asSami, reviewed.id, {
      status: ClaimStatus.UNDER_REVIEW,
      comment: 'Garage estimate requested',
    });
    console.log('Created 2 claims (1 unassigned, 1 under review by sami@claimflow.tn)');
  } finally {
    await app.close();
  }
}

seed().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
