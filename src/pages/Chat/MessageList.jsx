import React, { useEffect, useRef, useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import ChatFileAttachment from './ChatFileAttachment';
import { Trash2 } from 'lucide-react';

const MessageList = ({ conversation }) => {
  const { messages, setMessages, markAsRead, deleteMessage } = useChat();
  const { profile: user } = useAuth();
  const bottomRef = useRef(null);
  const [deletingId, setDeletingId] = useState(null);

  const convMessages = messages[conversation.id] || [];

  // Fetch history if not loaded
  useEffect(() => {
    const fetchHistory = async () => {
      if (!messages[conversation.id]) {
        const { data, error } = await supabase
          .from('messages')
          .select(`
            *,
            profiles!messages_sender_id_fkey(name)
          `)
          .eq('conversation_id', conversation.id)
          .order('created_at', { ascending: true })
          .limit(50);
          
        if (!error && data) {
          setMessages(prev => ({
            ...prev,
            [conversation.id]: data
          }));
        }
      }
    };
    fetchHistory();
  }, [conversation.id]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    
    // Mark as read when viewing
    if (convMessages.length > 0) {
      const lastMsg = convMessages[convMessages.length - 1];
      if (lastMsg.sender_id !== user.id) {
        markAsRead(conversation.id, lastMsg.id);
      }
    }
  }, [convMessages, conversation.id, user.id]);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/30">
      <div className="text-center">
        <p className="text-xs text-gray-400 font-medium bg-gray-100 inline-block px-3 py-1 rounded-full">
          Start of conversation
        </p>
      </div>

      {convMessages.map((msg, index) => {
        const isMine = msg.sender_id === user.id;
        const isFile = msg.message_type === 'file';
        
        const handleDelete = async () => {
          if (window.confirm('Are you sure you want to delete this message?')) {
            setDeletingId(msg.id);
            try {
              await deleteMessage(msg);
            } finally {
              setDeletingId(null);
            }
          }
        };

        return (
          <div key={msg.id || index} className={`flex group ${isMine ? 'justify-end' : 'justify-start'} items-end gap-2`}>
            {isMine && (
               <button 
                onClick={handleDelete}
                disabled={deletingId === msg.id}
                className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all disabled:opacity-50"
                title="Delete message"
              >
                <Trash2 size={16} />
              </button>
            )}
            <div className={`max-w-[75%] rounded-2xl px-5 py-3 ${isMine ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white border border-gray-100 shadow-sm text-gray-800 rounded-bl-sm'} ${deletingId === msg.id ? 'opacity-50' : ''}`}>
              {!isMine && msg.profiles?.name && (
                <p className="text-xs font-bold text-blue-600 mb-1">{msg.profiles.name}</p>
              )}
              
              {isFile && msg.metadata && (
                <ChatFileAttachment metadata={msg.metadata} isMine={isMine} />
              )}
              
              {msg.content && (
                <p className={`text-sm whitespace-pre-wrap ${isFile ? 'mt-2' : ''}`}>{msg.content}</p>
              )}
              
              <div className={`text-[10px] text-right mt-1 opacity-70 ${isMine ? 'text-blue-100' : 'text-gray-400'}`}>
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
};

export default MessageList;

