import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

const DiscussionPanel = ({ entityType, entityId, schoolId, title = "Internal Discussion", onClose }) => {
  const { user } = useAuth();
  const { sendMessage } = useChat();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const bottomRef = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !entityId) return;

    const initConversation = async () => {
      // 1. Check if conversation_link exists
      const { data: linkData, error: linkError } = await supabase
        .from('conversation_links')
        .select('conversation_id')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .maybeSingle();

      let convId;

      if (linkData) {
        convId = linkData.conversation_id;
      } else {
        // Create new conversation
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert({
            type: 'entity',
            title: title,
            school_id: schoolId || 'd3b07384-d113-4956-a5ec-9af2c61146e5',
            created_by: user.id
          })
          .select()
          .single();

        if (newConv) {
          convId = newConv.id;
          
          // Link it
          await supabase.from('conversation_links').insert({
            conversation_id: convId,
            entity_type: entityType,
            entity_id: entityId
          });

          // Add current user as member
          await supabase.from('conversation_members').insert({
            conversation_id: convId,
            profile_id: user.id,
            role: 'admin'
          });
        }
      }

      if (convId) {
        setConversation({ id: convId });
        // Fetch messages
        const { data: msgs } = await supabase
          .from('messages')
          .select('*, profiles(name)')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true });
        
        if (msgs) setMessages(msgs);

        // Ensure user is member
        await supabase.from('conversation_members')
          .upsert({ conversation_id: convId, profile_id: user.id }, { onConflict: 'conversation_id,profile_id' });
      }
      setLoading(false);
    };

    initConversation();
  }, [entityId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() || !conversation) return;

    const tempText = text;
    setText('');
    
    try {
      const { data } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          sender_id: user.id,
          content: tempText,
          message_type: 'system'
        })
        .select('*, profiles(name)')
        .single();
        
      if (data) {
        setMessages(prev => [...prev, data]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-4 text-gray-500 text-center">Loading discussion...</div>;

  return (
    <div className="flex flex-col h-[400px] bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <MessageSquare size={18} className="text-blue-600" />
          {title}
        </h3>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30">
        {messages.map((msg, idx) => (
          <div key={msg.id || idx} className="text-sm">
            <span className="font-bold text-blue-700 mr-2">{msg.profiles?.name || 'User'}:</span>
            <span className="text-gray-800">{msg.content}</span>
          </div>
        ))}
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-10">No notes yet. Be the first to start the discussion.</div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="p-3 border-t border-gray-200 bg-white flex gap-2">
        <input 
          type="text" 
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Add a note..." 
          className="flex-1 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button type="submit" className="bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700">
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};

export default DiscussionPanel;
