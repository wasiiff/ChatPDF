import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation, ConversationDocument } from './schemas/chat.schema';
import { SendMessageDto } from './dto/send-message.dto';
import * as dotenv from 'dotenv';
dotenv.config();

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/hf_transformers';
import { StateGraph, MessagesAnnotation } from '@langchain/langgraph';
import { MongoClient } from 'mongodb';

// ✅ Utility: normalize messages into { role, content }
function normalizeMessages(
  messages: any[],
): { role: string; content: string }[] {
  return (messages || []).map((m) => {
    if (m.role && m.content) return { role: m.role, content: m.content };
    if (typeof m._getType === 'function') {
      const type = m._getType();
      if (type === 'human') return { role: 'user', content: m.content };
      if (type === 'ai') return { role: 'ai', content: m.content };
      if (type === 'system') return { role: 'system', content: m.content };
    }
    throw new Error('Unsupported message format: ' + JSON.stringify(m));
  });
}

@Injectable()
export class ChatService {
  private model: any;
  private graph: any;
  private logger = new Logger(ChatService.name);

  constructor(
    @InjectModel(Conversation.name)
    private convModel: Model<ConversationDocument>,
  ) {
    this.model = new ChatGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL_NAME || 'models/gemini-2.0-flash',
    });

    // 🔎 Retrieval node
    const retrievalNode = async (state: any) => {
      this.logger.log(
        `🔎 Searching in db=PdfAnalyzer, collection=pdfs for pdfId=${state.pdfId}`,
      );
      const normalized = normalizeMessages(state.messages || []);
      const lastUserMessage = normalized.filter((m) => m.role === 'user').pop();

      if (!lastUserMessage) {
        this.logger.warn('⚠️ No user message found in state');
        return {
          ...state,
          context: '',
          messages: normalized,
          pdfId: state.pdfId,
        }; // ✅ keep pdfId
      }

      if (!state.pdfId) {
        this.logger.warn(
          `⚠️ No pdfId in state (query="${lastUserMessage.content}")`,
        );
        return {
          ...state,
          context: '',
          messages: normalized,
          pdfId: state.pdfId,
        }; // ✅ keep pdfId
      }

      this.logger.log(
        `🔎 Retrieving context for pdfId=${state.pdfId}, query="${lastUserMessage.content}"`,
      );

      const client = new MongoClient(process.env.MONGO_URI!);
      await client.connect();
      try {
        const collection = client.db('PdfAnalyzer').collection('pdfs');

        const embeddings = new HuggingFaceTransformersEmbeddings({
          modelName: 'Xenova/all-MiniLM-L6-v2',
        });

        const queryVector = await embeddings.embedQuery(
          lastUserMessage.content,
        );

        const results = await collection
          .aggregate([
            { $match: { pdfId: state.pdfId } }, // ✅ ensure we filter by pdfId
            {
              $vectorSearch: {
                queryVector,
                path: 'vector',
                numCandidates: 10,
                limit: 5,
              },
            },
          ])
          .toArray();

        this.logger.log(`📥 Retrieved ${results.length} chunks`);
        const context = results.map((r) => r.content).join('\n');

        return { ...state, context, messages: normalized, pdfId: state.pdfId }; // ✅ keep pdfId
      } catch (err) {
        this.logger.error(`❌ Retrieval error: ${err.message}`, err.stack);
        return {
          ...state,
          context: '',
          messages: normalized,
          pdfId: state.pdfId,
        }; // ✅ keep pdfId
      } finally {
        await client.close();
      }
    };

    // 🤖 Model node
    const callModel = async (state: any) => {
      const normalized = normalizeMessages(state.messages || []);
      const lastUserMessage = normalized.filter((m) => m.role === 'user').pop();

      this.logger.log(
        `🤖 Calling Gemini (context length=${state.context?.length || 0}, user="${lastUserMessage?.content}")`,
      );

      const chatMessages = [
        {
          role: 'system',
          content: `You are a helpful PDF assistant. Use ONLY the provided document excerpts when possible. 
If the answer is not in the document, reply: "The document does not provide this information."

Document context:
${state.context || '(no relevant excerpts found)'}`,
        },
        ...normalized.filter((m: any) => m.role !== 'system'),
      ];

      this.logger.debug(
        `📤 Sending ${chatMessages.length} messages to model (last user="${lastUserMessage?.content}")`,
      );

      const response = await this.model.invoke(chatMessages);

      this.logger.log(
        `✅ Model responded with ${response.content?.length || 0} characters`,
      );

      return {
        ...state,
        pdfId: state.pdfId, // ✅ explicitly keep it here too
        messages: [...normalized, { role: 'ai', content: response.content }],
      };
    };

    // Build graph
    this.graph = new StateGraph(MessagesAnnotation)
      .addNode('retrieve', retrievalNode)
      .addNode('chatbot', callModel)
      .addEdge('__start__', 'retrieve')
      .addEdge('retrieve', 'chatbot')
      .compile();
  }

  async handleMessage(dto: SendMessageDto) {
    this.logger.log(
      `📨 Incoming="${dto.message}" (pdfId=${dto.pdfId || 'none'})`,
    );

    let conversation: (Conversation & { _id: Types.ObjectId }) | null = null;

    if (dto.conversationId) {
      conversation = (await this.convModel
        .findById(dto.conversationId)
        .lean()
        .exec()) as any;
    }

    if (!conversation) {
      const created = await this.convModel.create({
        messages: [],
        summaries: [],
        pdfId: dto.pdfId,
      });
      conversation = created.toObject() as any;
    }

    // ✅ Normalize + add new user message before invoking graph
    const incomingState = {
      ...conversation,
      messages: normalizeMessages([
        ...(conversation?.messages || []),
        { role: 'user', content: dto.message },
      ]),
      pdfId: dto.pdfId ?? conversation?.pdfId, // ✅ put last to guarantee it sticks
    };

    this.logger.debug(
      `➡️ State before graph: pdfId=${incomingState.pdfId}, messages=${incomingState.messages.length}`,
    );

    this.logger.debug(
      `➡️ State before graph: ${incomingState.messages.length} messages`,
    );

    const newState = await this.graph.invoke(incomingState);

    const update: Partial<Conversation> = {};
    if (newState.messages)
      update.messages = normalizeMessages(newState.messages);
    if (newState.pdfId) update.pdfId = newState.pdfId;

    const saved = (await this.convModel
      .findByIdAndUpdate(conversation!._id, update, { new: true })
      .lean()
      .exec()) as any;

    const lastAi = saved?.messages
      ?.slice()
      .reverse()
      .find((m) => m.role === 'ai');

    this.logger.log(
      `💬 Updated conversationId=${saved?._id}, lastAI="${lastAi?.content?.slice(
        0,
        80,
      )}"`,
    );

    return {
      conversationId: saved?._id?.toString(),
      ai: lastAi,
      messages: saved?.messages || [],
    };
  }
}
