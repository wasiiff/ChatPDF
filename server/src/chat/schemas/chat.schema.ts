import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ConversationDocument = Conversation & Document;

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ default: [] })
  messages: Array<{ role: string; content: string }>;

  @Prop({ default: [] })
  summaries: string[];

  @Prop()
  pdfId?: string;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
