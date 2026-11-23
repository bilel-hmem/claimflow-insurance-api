import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { formatMillimes } from '../../common/utils/money';
import { ClaimStatus } from '../claims/entities/claim-status.enum';

export interface ClaimsSummary {
  byStatus: Record<ClaimStatus, number>;
  totals: {
    claims: number;
    amountClaimed: number;
    amountApproved: number;
    amountPaid: number;
    amountPaidFormatted: string;
  };
  /** Average days from submission to a final decision, null when nothing is closed yet. */
  averageProcessingDays: number | null;
  generatedAt: Date;
}

type Numeric = number | string | null;

@Injectable()
export class ReportsService {
  constructor(private readonly dataSource: DataSource) {}

  async claimsSummary(): Promise<ClaimsSummary> {
    const rows = await this.dataSource.query<
      { status: ClaimStatus; count: Numeric; claimed: Numeric; approved: Numeric }[]
    >(`
      SELECT status,
             COUNT(*) AS count,
             COALESCE(SUM(amount_claimed), 0) AS claimed,
             COALESCE(SUM(amount_approved), 0) AS approved
      FROM claims
      GROUP BY status
    `);
    const [timing] = await this.dataSource.query<{ avgSeconds: Numeric }[]>(`
      SELECT AVG(TIMESTAMPDIFF(SECOND, submitted_at, closed_at)) AS avgSeconds
      FROM claims
      WHERE closed_at IS NOT NULL
    `);

    const byStatus = Object.fromEntries(
      Object.values(ClaimStatus).map((status) => [status, 0]),
    ) as Record<ClaimStatus, number>;
    let claims = 0;
    let amountClaimed = 0;
    let amountApproved = 0;
    let amountPaid = 0;
    for (const row of rows) {
      const count = Number(row.count);
      byStatus[row.status] = count;
      claims += count;
      amountClaimed += Number(row.claimed);
      amountApproved += Number(row.approved);
      if (row.status === ClaimStatus.PAID) {
        amountPaid = Number(row.approved);
      }
    }

    const avgSeconds = timing?.avgSeconds === null ? null : Number(timing?.avgSeconds);
    return {
      byStatus,
      totals: {
        claims,
        amountClaimed,
        amountApproved,
        amountPaid,
        amountPaidFormatted: formatMillimes(amountPaid),
      },
      averageProcessingDays:
        avgSeconds === null || Number.isNaN(avgSeconds)
          ? null
          : Math.round((avgSeconds / 86_400) * 100) / 100,
      generatedAt: new Date(),
    };
  }
}
