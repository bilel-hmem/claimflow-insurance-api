/** Kept in its own file: entity files import each other, and an enum must exist before decorators run. */
export enum ClaimStatus {
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PAID = 'PAID',
  WITHDRAWN = 'WITHDRAWN',
}
