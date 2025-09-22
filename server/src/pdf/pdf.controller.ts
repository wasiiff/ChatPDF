import { Controller, Post, UploadedFile, UseInterceptors, Logger } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PdfService } from './pdf.service';

@Controller('pdf')
export class PdfController {
  private readonly logger = new Logger(PdfController.name);

  constructor(private readonly pdfService: PdfService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file')) // multer in-memory upload
  async uploadPdf(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      this.logger.error('❌ No file uploaded');
      throw new Error('No file uploaded');
    }

    this.logger.log(`📤 Received file: ${file.originalname}, size=${file.size} bytes`);
    const result = await this.pdfService.processPdf(file);
    this.logger.log(`✅ Upload complete. pdfId=${result.pdfId}, chunks=${result.pages}`);
    return result;
  }
}
