import { detectFileType, sanitizeFileName } from './file-signature';

describe('detectFileType', () => {
  it.each([
    ['PDF', Buffer.from('%PDF-1.7\n...'), 'application/pdf', 'pdf'],
    [
      'PNG',
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
      'image/png',
      'png',
    ],
    ['JPEG', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]), 'image/jpeg', 'jpg'],
  ])('recognises a %s from its first bytes', (_name, content, mime, extension) => {
    expect(detectFileType(content)).toEqual({ mime, extension });
  });

  it.each([
    ['a Windows executable named .pdf', Buffer.from('MZ\x90\x00 fake pdf')],
    ['an HTML page', Buffer.from('<html><script>alert(1)</script>')],
    ['a file shorter than any signature', Buffer.from([0xff])],
    ['an empty file', Buffer.alloc(0)],
  ])('rejects %s', (_name, content) => {
    expect(detectFileType(content)).toBeNull();
  });
});

describe('sanitizeFileName', () => {
  it('removes folders so a name can never be a path', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFileName('C:\\Users\\me\\constat.pdf')).toBe('constat.pdf');
  });

  it('removes quotes and control characters', () => {
    expect(sanitizeFileName('photo"\r\n.jpg')).toBe('photo.jpg');
  });

  it('falls back to a default name', () => {
    expect(sanitizeFileName('  ')).toBe('document');
  });
});
