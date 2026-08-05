import React, { useState } from 'react';
import { Paperclip, Send, Mic, Smile } from 'lucide-react';
import { useChat } from '../../context/ChatContext';

const MessageInput = ({ conversationId }) => {
  const [text, setText] = useState('');
  const { sendMessage } = useChat();
  const [isSending, setIsSending] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() || isSending) return;

    setIsSending(true);
    try {
      await sendMessage(conversationId, text.trim());
      setText('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form onSubmit={handleSend} className="p-4 bg-white border-t border-gray-100 flex items-center gap-3">
      <button type="button" className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-50 transition-colors">
        <Paperclip size={20} />
      </button>
      
      <div className="flex-1 relative">
        <input 
          type="text" 
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..." 
          className="w-full pl-4 pr-10 py-3 bg-gray-50 border-none rounded-full focus:ring-2 focus:ring-blue-500 outline-none text-sm"
        />
        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          <Smile size={18} />
        </button>
      </div>

      {text.trim() ? (
        <button 
          type="submit" 
          disabled={isSending}
          className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
        >
          <Send size={18} className="ml-1" />
        </button>
      ) : (
        <button type="button" className="text-gray-400 hover:text-blue-600 p-3 rounded-full hover:bg-blue-50 transition-colors">
          <Mic size={20} />
        </button>
      )}
    </form>
  );
};

export default MessageInput;
