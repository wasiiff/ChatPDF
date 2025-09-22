import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

type Message = { role: string; content: string };

export interface ChatRequest {
  conversationId?: string;
  pdfId?: string;       // ✅ support PDF context
  message: string;
}

export interface ChatResponse {
  conversationId: string;
  ai: Message;
  summaries: string[];
  messages: Message[];
}

export const chatApi = createApi({
  reducerPath: 'chatApi',
  baseQuery: fetchBaseQuery({ baseUrl: 'http://localhost:4000/' }),
  endpoints: (builder) => ({
    sendMessage: builder.mutation<ChatResponse, ChatRequest>({
      query: (body) => ({
        url: 'chat',
        method: 'POST',
        body,
      }),
    }),
  }),
});

export const { useSendMessageMutation } = chatApi;
