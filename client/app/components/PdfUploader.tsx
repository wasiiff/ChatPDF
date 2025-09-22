'use client';

import { useState } from 'react';
import { UploadCloud } from 'lucide-react';

export default function PdfUploader({ onUpload }: { onUpload: (pdfId: string) => void }) {
  const [loading, setLoading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setLoading(true);
    try {
      const res = await fetch('http://localhost:4000/pdf/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      onUpload(data.pdfId);
    } catch (err) {
      console.log(err);
      alert('PDF upload failed!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 flex flex-col items-center justify-center gap-6 border border-gray-200 rounded-2xl bg-white shadow-lg animate-in fade-in duration-500">
      <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-4">
        <UploadCloud className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-xl font-bold text-gray-800 text-center">
        Upload Your PDF
      </h2>
      <p className="text-sm text-gray-500 text-center">
        Drag & drop or click below to upload a PDF and start asking questions.
      </p>
      <label
        className={`w-full flex flex-col items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 hover:border-blue-400 hover:bg-blue-50 ${
          loading ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleUpload}
          disabled={loading}
        />
        {loading ? (
          <p className="text-gray-600">Uploading PDF...</p>
        ) : (
          <p className="text-gray-600">Click or drag PDF here</p>
        )}
      </label>
      {loading && (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-gray-500">Uploading...</span>
        </div>
      )}
    </div>
  );
}
