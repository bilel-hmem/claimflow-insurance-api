import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthUser } from '../../common/interfaces/auth-user.interface';
import { Paginated } from '../../common/utils/paginate';
import { ClaimDocumentsService } from './claim-documents.service';
import { ClaimView, DocumentView, TimelineEntry } from './claim.view';
import { ClaimsService } from './claims.service';
import { MAX_FILE_BYTES } from './domain/file-signature';
import { AssignClaimDto } from './dto/assign-claim.dto';
import { ChangeClaimStatusDto } from './dto/change-status.dto';
import { ClaimQueryDto } from './dto/claim-query.dto';
import { SubmitClaimDto } from './dto/submit-claim.dto';

@ApiTags('Claims')
@ApiBearerAuth()
@Controller('claims')
export class ClaimsController {
  constructor(
    private readonly claims: ClaimsService,
    private readonly documents: ClaimDocumentsService,
  ) {}

  /** File a claim on one of your active policies. */
  @Roles(Role.POLICYHOLDER)
  @Post()
  submit(@CurrentUser() actor: AuthUser, @Body() dto: SubmitClaimDto): Promise<ClaimView> {
    return this.claims.submit(actor, dto);
  }

  /**
   * Policyholders see their claims, adjusters the claims assigned to them, admins everything.
   * Admins can also filter with `adjusterId` or `unassigned=true`.
   */
  @Get()
  list(
    @CurrentUser() actor: AuthUser,
    @Query() query: ClaimQueryDto,
  ): Promise<Paginated<ClaimView>> {
    return this.claims.list(actor, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ClaimView> {
    return this.claims.findOne(actor, id);
  }

  /** Assign (or reassign) an open claim to a claims adjuster. */
  @Roles(Role.ADMIN)
  @Patch(':id/assign')
  assign(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignClaimDto,
  ): Promise<ClaimView> {
    return this.claims.assign(actor, id, dto.adjusterId);
  }

  /**
   * Move the claim through the workflow. Invalid moves answer 409, moves your role
   * cannot make answer 403. `amountApproved` is required for APPROVED,
   * `rejectionReason` for REJECTED.
   */
  @Patch(':id/status')
  changeStatus(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeClaimStatusDto,
  ): Promise<ClaimView> {
    return this.claims.changeStatus(actor, id, dto);
  }

  /** Every status change, who made it and when. */
  @Get(':id/timeline')
  timeline(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TimelineEntry[]> {
    return this.claims.timeline(actor, id);
  }

  /** Attach a PDF, PNG or JPEG (max 5 MB). The type is checked from the file content. */
  @Post(':id/documents')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES, files: 1 } }))
  uploadDocument(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<DocumentView> {
    return this.documents.upload(actor, id, file);
  }

  @Get(':id/documents')
  listDocuments(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DocumentView[]> {
    return this.documents.list(actor, id);
  }

  @Get(':id/documents/:documentId/download')
  async download(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('documentId', ParseIntPipe) documentId: number,
  ): Promise<StreamableFile> {
    const { document, stream } = await this.documents.openForDownload(actor, id, documentId);
    return new StreamableFile(stream, {
      type: document.mimeType,
      length: document.sizeBytes,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(document.originalName)}`,
    });
  }
}
