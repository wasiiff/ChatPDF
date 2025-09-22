import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatModule } from './chat/chat.module';
import { PdfModule } from './pdf/pdf.module';
import * as dotenv from 'dotenv';
dotenv.config();

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGO_URI || 'mongodb+srv://wasifbinnasir:wasifbinnasir@cluster0.h8sdsew.mongodb.net/PdfAnalyzer?retryWrites=true&w=majority&appName=Cluster0'),
    ChatModule,
    PdfModule,
  ],
})
export class AppModule {}
