import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { createReadStream, ReadStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Repository } from 'typeorm';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { DocumentView, toDocumentView } from './claim.view';
import { ClaimsService } from './claims.service';
import { isFinal } from './domain/claim-workflow';
import { ACCEPTED_FILE_TYPES, detectFileType, sanitizeFileName } from './domain/file-signature';
import { ClaimDocument } from './entities/claim-document.entity';

export interface DocumentDownload {
  document: ClaimDocument;
  stream: ReadStream;
}

@Injectable()
export class ClaimDocumentsService implements OnModuleInit {
  private readonly uploadDir: string;

  constructor(
    @InjectRepository(ClaimDocument) private readonly documents: Repository<ClaimDocument>,
    private readonly claims: ClaimsService,
    config: ConfigService,
  ) {
    this.uploadDir = resolve(config.get<string>('UPLOAD_DIR', 'uploads'));
  }

  async onModuleInit(): Promise<void> {
    await mkdir(this.uploadDir, { recursive: true });
  }

  /**
   * Stores a supporting document (photo, police report, invoice...).
   * The type is detected from the file content, the name on disk is a random UUID,
   * and the DB row is only kept if the file was written (and vice versa).
   */
  async upload(
    actor: AuthUser,
    claimId: number,
    file?: Express.Multer.File,
  ): Promise<DocumentView> {
    if (!file) {
      throw new BadRequestException('A file is required (multipart field "file")');
    }
    const claim = await this.claims.getVisibleClaim(actor, claimId);
    if (isFinal(claim.status)) {
      throw new ConflictException('Documents cannot be added to a closed claim');
    }
    const type = detectFileType(file.buffer);
    if (!type) {
      throw new UnsupportedMediaTypeException(`Only ${ACCEPTED_FILE_TYPES} files are accepted`);
    }

    const storedName = `${randomUUID()}.${type.extension}`;
    const path = join(this.uploadDir, storedName);
    await writeFile(path, file.buffer, { flag: 'wx' });
    try {
      const document = await this.documents.save(
        this.documents.create({
          claimId: claim.id,
          originalName: sanitizeFileName(file.originalname),
          storedName,
          mimeType: type.mime,
          sizeBytes: file.size,
          uploadedById: actor.id,
        }),
      );
      const saved = await this.documents.findOneOrFail({
        where: { id: document.id },
        relations: { uploadedBy: true },
      });
      return toDocumentView(saved);
    } catch (error) {
      await rm(path, { force: true });
      throw error;
    }
  }

  async list(actor: AuthUser, claimId: number): Promise<DocumentView[]> {
    const claim = await this.claims.getVisibleClaim(actor, claimId);
    const documents = await this.documents.find({
      where: { claimId: claim.id },
      relations: { uploadedBy: true },
      order: { uploadedAt: 'ASC', id: 'ASC' },
    });
    return documents.map(toDocumentView);
  }

  async openForDownload(
    actor: AuthUser,
    claimId: number,
    documentId: number,
  ): Promise<DocumentDownload> {
    const claim = await this.claims.getVisibleClaim(actor, claimId);
    const document = await this.documents.findOne({ where: { id: documentId, claimId: claim.id } });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    // storedName is a server-generated UUID: no user input reaches the file path.
    return { document, stream: createReadStream(join(this.uploadDir, document.storedName)) };
  }
}
