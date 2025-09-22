import { Injectable, Logger } from '@nestjs/common';
import pdfParse from 'pdf-parse';
import { MongoClient } from 'mongodb';
import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/hf_transformers';
import { randomUUID } from 'crypto';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  async processPdf(file: Express.Multer.File) {
    const pdfId = randomUUID();
    this.logger.log(`📄 Processing new PDF (pdfId=${pdfId})`);

    // Ensure file exists
    if (!file?.buffer) {
      this.logger.error('❌ File buffer is missing!');
      throw new Error('Invalid file upload');
    }

    // Parse PDF
    this.logger.log('🔍 Extracting text from PDF...');
    const pdfData = await pdfParse(file.buffer);
    const text = pdfData.text;
    this.logger.log(`✅ Extracted ${text.length} characters of text`);

    // Split into ~1000-char chunks
    const chunks = text.match(/.{1,1000}/gs) || [];
    this.logger.log(`📝 Split text into ${chunks.length} chunks`);

    // Load local HuggingFace model
    const embeddings = new HuggingFaceTransformersEmbeddings({
      modelName: 'Xenova/all-MiniLM-L6-v2',
    });

    const client = new MongoClient(process.env.MONGO_URI!);
    await client.connect();
    const collection = client.db('PdfAnalyzer').collection('pdfs');
    this.logger.log('🗄️ Connected to MongoDB, inserting chunks...');

    let count = 0;
    for (const chunk of chunks) {
      const vector = await embeddings.embedQuery(chunk);
      await collection.insertOne({ pdfId, content: chunk, vector });
      count++;
      if (count % 10 === 0) {
        this.logger.debug(`📥 Inserted ${count}/${chunks.length} chunks...`);
      }
    }

    await client.close();
    this.logger.log(`✅ Finished processing PDF (pdfId=${pdfId}), stored ${count} chunks`);

    return { pdfId, pages: chunks.length };
  }
}
