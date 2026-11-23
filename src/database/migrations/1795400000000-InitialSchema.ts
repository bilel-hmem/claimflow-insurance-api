import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema. Money columns are BIGINT millimes (1 TND = 1000 millimes).
 * CHECK constraints (MySQL 8.0.16+) protect the data even if the code had a bug;
 * TypeORM does not manage them on MySQL, so they only live in migrations.
 */
export class InitialSchema1795400000000 implements MigrationInterface {
  name = 'InitialSchema1795400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const statuses = `'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PAID', 'WITHDRAWN'`;

    await queryRunner.query(`
      CREATE TABLE \`users\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`full_name\` varchar(100) NOT NULL,
        \`email\` varchar(180) NOT NULL,
        \`password_hash\` varchar(255) NOT NULL,
        \`role\` enum ('POLICYHOLDER', 'ADJUSTER', 'ADMIN') NOT NULL DEFAULT 'POLICYHOLDER',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`UQ_users_email\` (\`email\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await queryRunner.query(`
      CREATE TABLE \`policies\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`policy_number\` varchar(24) NOT NULL,
        \`holder_id\` int NOT NULL,
        \`type\` enum ('AUTO', 'HEALTH', 'HOME') NOT NULL,
        \`coverage_limit\` bigint NOT NULL,
        \`start_date\` date NOT NULL,
        \`end_date\` date NOT NULL,
        \`status\` enum ('ACTIVE', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`UQ_policies_number\` (\`policy_number\`),
        INDEX \`IDX_policies_holder\` (\`holder_id\`),
        CONSTRAINT \`CHK_policies_coverage_positive\` CHECK (\`coverage_limit\` > 0),
        CONSTRAINT \`CHK_policies_period\` CHECK (\`end_date\` > \`start_date\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await queryRunner.query(`
      CREATE TABLE \`claims\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`claim_number\` varchar(24) NOT NULL,
        \`policy_id\` int NOT NULL,
        \`assigned_adjuster_id\` int NULL,
        \`incident_date\` date NOT NULL,
        \`description\` text NOT NULL,
        \`amount_claimed\` bigint NOT NULL,
        \`amount_approved\` bigint NULL,
        \`status\` enum (${statuses}) NOT NULL DEFAULT 'SUBMITTED',
        \`rejection_reason\` varchar(500) NULL,
        \`submitted_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`closed_at\` datetime(6) NULL,
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`UQ_claims_number\` (\`claim_number\`),
        INDEX \`IDX_claims_policy\` (\`policy_id\`),
        INDEX \`IDX_claims_adjuster_status\` (\`assigned_adjuster_id\`, \`status\`),
        INDEX \`IDX_claims_status_submitted\` (\`status\`, \`submitted_at\`),
        CONSTRAINT \`CHK_claims_amount_claimed_positive\` CHECK (\`amount_claimed\` > 0),
        CONSTRAINT \`CHK_claims_amount_approved_range\`
          CHECK (\`amount_approved\` IS NULL OR (\`amount_approved\` > 0 AND \`amount_approved\` <= \`amount_claimed\`)),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await queryRunner.query(`
      CREATE TABLE \`claim_documents\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`claim_id\` int NOT NULL,
        \`original_name\` varchar(255) NOT NULL,
        \`stored_name\` varchar(64) NOT NULL,
        \`mime_type\` varchar(100) NOT NULL,
        \`size_bytes\` int NOT NULL,
        \`uploaded_by\` int NOT NULL,
        \`uploaded_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX \`IDX_claim_documents_claim\` (\`claim_id\`),
        INDEX \`IDX_claim_documents_uploaded_by\` (\`uploaded_by\`),
        UNIQUE INDEX \`UQ_claim_documents_stored_name\` (\`stored_name\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await queryRunner.query(`
      CREATE TABLE \`claim_status_history\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`claim_id\` int NOT NULL,
        \`from_status\` enum (${statuses}) NULL,
        \`to_status\` enum (${statuses}) NOT NULL,
        \`changed_by\` int NOT NULL,
        \`comment\` varchar(500) NULL,
        \`changed_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX \`IDX_claim_history_claim_changed\` (\`claim_id\`, \`changed_at\`),
        INDEX \`IDX_claim_history_changed_by\` (\`changed_by\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    const foreignKeys: [string, string, string, string][] = [
      ['policies', 'FK_policies_holder', 'holder_id', 'users'],
      ['claims', 'FK_claims_policy', 'policy_id', 'policies'],
      ['claims', 'FK_claims_adjuster', 'assigned_adjuster_id', 'users'],
      ['claim_documents', 'FK_claim_documents_claim', 'claim_id', 'claims'],
      ['claim_documents', 'FK_claim_documents_uploader', 'uploaded_by', 'users'],
      ['claim_status_history', 'FK_claim_history_claim', 'claim_id', 'claims'],
      ['claim_status_history', 'FK_claim_history_user', 'changed_by', 'users'],
    ];
    for (const [table, name, column, target] of foreignKeys) {
      await queryRunner.query(
        `ALTER TABLE \`${table}\` ADD CONSTRAINT \`${name}\` FOREIGN KEY (\`${column}\`) REFERENCES \`${target}\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table, name] of [
      ['claim_status_history', 'FK_claim_history_user'],
      ['claim_status_history', 'FK_claim_history_claim'],
      ['claim_documents', 'FK_claim_documents_uploader'],
      ['claim_documents', 'FK_claim_documents_claim'],
      ['claims', 'FK_claims_adjuster'],
      ['claims', 'FK_claims_policy'],
      ['policies', 'FK_policies_holder'],
    ]) {
      await queryRunner.query(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${name}\``);
    }
    for (const table of [
      'claim_status_history',
      'claim_documents',
      'claims',
      'policies',
      'users',
    ]) {
      await queryRunner.query(`DROP TABLE \`${table}\``);
    }
  }
}
