export interface DetectedFileType {
  mime: string;
  extension: string;
}

/**
 * Accepted document types, recognised by their first bytes ("magic numbers").
 * The Content-Type sent by the client is ignored: renaming malware.exe to
 * report.pdf does not make it a PDF.
 */
const SIGNATURES: readonly (DetectedFileType & { bytes: readonly number[] })[] = [
  { mime: 'application/pdf', extension: 'pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  {
    mime: 'image/png',
    extension: 'png',
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  { mime: 'image/jpeg', extension: 'jpg', bytes: [0xff, 0xd8, 0xff] },
];

export const ACCEPTED_FILE_TYPES = 'PDF, PNG or JPEG';
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export function detectFileType(content: Buffer): DetectedFileType | null {
  const match = SIGNATURES.find(
    ({ bytes }) =>
      content.length >= bytes.length && bytes.every((byte, index) => content[index] === byte),
  );
  return match ? { mime: match.mime, extension: match.extension } : null;
}

/** Keeps only a safe display name: no folders, no control characters, max 255 chars. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f"]/g, '').trim();
  return (cleaned || 'document').slice(0, 255);
}
