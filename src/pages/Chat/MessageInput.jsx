import React, { useState, useRef } from 'react';
import { Paperclip, Send, Mic, Smile, X, File, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { uploadChatAttachment, getAttachmentUrl } from '../../lib/chat_storage';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit
const ALLOWED_FILE_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'text/plain', 'text/csv'
];

const MessageInput = ({ conversationId }) => {
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const { sendMessage } = useChat();
  const { profile } = useAuth();
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError('File size must be less than 10MB');
      return;
    }

    if (!ALLOWED_FILE_TYPES.includes(selectedFile.type)) {
      setError('Invalid file type. Please upload images, PDFs, or documents.');
      return;
    }

    setFile(selectedFile);
    setError('');
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!text.trim() && !file) || isSending) return;

    setIsSending(true);
    setError('');
    try {
      let attachmentMetadata = null;

      if (file) {
        const institutionId = profile?.school_id || 'default';
        const { path, error: uploadError } = await uploadChatAttachment(file, institutionId, conversationId);
        
        if (uploadError || !path) {
          throw new Error(uploadError?.message || 'Failed to upload file');
        }

        attachmentMetadata = {
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          file_path: path
        };
      }

      await sendMessage(
        conversationId, 
        text.trim(), 
        file ? 'file' : 'text', 
        attachmentMetadata || {}
      );
      
      setText('');
      removeFile();
    } catch (err) {
      console.error('Failed to send message:', err);
      setError(err.message || 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const isImage = file?.type?.startsWith('image/');

  return (
    <div className="flex flex-col bg-white border-t border-gray-100">
      {error && (
        <div className="px-4 py-2 bg-red-50 text-red-600 text-sm">
          {error}
        </div>
      )}
      
      {file && (
        <div className="px-4 pt-3 pb-1 flex items-center gap-3">
          <div className="relative flex items-center gap-3 bg-gray-50 p-2 rounded-lg border border-gray-200 pr-10 max-w-sm">
            <div className="p-2 bg-white rounded-md shadow-sm">
              {isImage ? <ImageIcon size={20} className="text-blue-500" /> : <File size={20} className="text-blue-500" />}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
              <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <button 
              type="button" 
              onClick={removeFile}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSend} className="p-4 flex items-center gap-3">
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
        />
        <button 
          type="button" 
          onClick={() => fileInputRef.current?.click()}
          disabled={isSending}
          className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <Paperclip size={20} />
        </button>
        
        <div className="flex-1 relative">
          <input 
            type="text" 
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={isSending}
            placeholder={file ? "Add an optional message..." : "Type a message..."} 
            className="w-full pl-4 pr-10 py-3 bg-gray-50 border-none rounded-full focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-70"
          />
          <button type="button" disabled={isSending} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-50">
            <Smile size={18} />
          </button>
        </div>

        {text.trim() || file ? (
          <button 
            type="submit" 
            disabled={isSending}
            className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center"
          >
            {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-1" />}
          </button>
        ) : (
          <button type="button" className="text-gray-400 hover:text-blue-600 p-3 rounded-full hover:bg-blue-50 transition-colors">
            <Mic size={20} />
          </button>
        )}
      </form>
    </div>
  );
};

export default MessageInput;

