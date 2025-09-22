'use client';

import { useState } from 'react';
import PdfUploader from './PdfUploader';
import ChatBox from './ChatBot';

export default function ChatPage() {
  const [pdfId, setPdfId] = useState<string | undefined>();

  return (
    <main className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {!pdfId ? (
        <PdfUploader onUpload={setPdfId} />
      ) : (
        <ChatBox pdfId={pdfId} />
      )}
    </main>
  );
}
