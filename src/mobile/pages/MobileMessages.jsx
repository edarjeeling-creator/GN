import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, ArrowLeft, Send, Search } from 'lucide-react';
import MobileCard from '../components/ui/MobileCard';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const ConversationView = ({ conversation, onBack }) => {
  const { messages, setMessages, sendMessage, markAsRead } = useChat();
  const { profile: user } = useAuth();
  const [inputText, setInputText] = useState('');
  const bottomRef = useRef(null);
  
  const convMessages = messages[conversation.id] || [];

  useEffect(() => {
    const fetchHistory = async () => {
      if (!messages[conversation.id]) {
        const { data, error } = await supabase
          .from('messages')
          .select(`*, profiles!messages_sender_id_fkey(name)`)
          .eq('conversation_id', conversation.id)
          .order('created_at', { ascending: true })
          .limit(50);
          
        if (!error && data) {
          setMessages(prev => ({ ...prev, [conversation.id]: data }));
        }
      }
    };
    fetchHistory();
  }, [conversation.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (convMessages.length > 0) {
      const lastMsg = convMessages[convMessages.length - 1];
      if (lastMsg.sender_id !== user.id) {
        markAsRead(conversation.id, lastMsg.id);
      }
    }
  }, [convMessages, conversation.id, user.id]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');
    await sendMessage(conversation.id, text, 'text');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'var(--mobile-bg)', zIndex: 10 }}>
      {/* Chat Header */}
      <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'var(--mobile-primary)', color: 'white' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'white', padding: '4px' }}>
          <ArrowLeft size={24} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
            {conversation.title?.charAt(0) || 'U'}
          </div>
          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{conversation.title || 'Conversation'}</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {convMessages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--mobile-text-secondary)', marginTop: '40px', fontSize: '14px' }}>No messages yet. Say hi!</div>
        ) : (
          convMessages.map((msg, idx) => {
            const isMine = msg.sender_id === user.id;
            return (
              <div key={msg.id || idx} style={{ alignSelf: isMine ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                <div style={{
                  backgroundColor: isMine ? 'var(--mobile-primary)' : 'white',
                  color: isMine ? 'white' : 'var(--mobile-text-primary)',
                  padding: '12px 16px',
                  borderRadius: isMine ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  fontSize: '15px',
                  lineHeight: 1.4
                }}>
                  {msg.content}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--mobile-text-secondary)', marginTop: '4px', textAlign: isMine ? 'right' : 'left' }}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '16px', backgroundColor: 'white', borderTop: '1px solid var(--mobile-border)', display: 'flex', gap: '12px' }}>
        <input 
          type="text" 
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          style={{ flex: 1, backgroundColor: 'var(--mobile-bg)', border: 'none', borderRadius: '24px', padding: '12px 16px', fontSize: '15px', outline: 'none' }}
        />
        <button 
          onClick={handleSend}
          disabled={!inputText.trim()}
          style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: inputText.trim() ? 'var(--mobile-primary)' : '#e5e7eb', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Send size={20} style={{ marginLeft: '4px' }} />
        </button>
      </div>
    </div>
  );
};

const MobileMessages = () => {
  const { conversations, unreadCounts, setActiveConversation, activeConversation } = useChat();

  if (activeConversation) {
    return <ConversationView conversation={activeConversation} onBack={() => setActiveConversation(null)} />;
  }

  return (
    <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', color: 'var(--mobile-text-primary)' }}>
        Messages
      </h2>

      <div style={{ marginBottom: '24px', position: 'relative' }}>
        <Search size={20} color="var(--mobile-text-secondary)" style={{ position: 'absolute', left: '16px', top: '12px' }} />
        <input 
          type="text" 
          placeholder="Search messages..."
          style={{ width: '100%', backgroundColor: 'white', border: 'none', borderRadius: '16px', padding: '12px 16px 12px 48px', fontSize: '15px', outline: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}
        />
      </div>

      {conversations.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '24px', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--mobile-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <MessageSquare size={40} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--mobile-text-primary)', marginBottom: '8px' }}>
            No Messages
          </h3>
          <p style={{ color: 'var(--mobile-text-secondary)', textAlign: 'center', maxWidth: '250px', fontSize: '14px' }}>
            You have no conversations yet.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '24px' }}>
          {conversations.map(conv => {
            const unread = unreadCounts[conv.id] || 0;
            return (
              <MobileCard key={conv.id} onClick={() => setActiveConversation(conv)} style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#e5e7eb', color: 'var(--mobile-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold' }}>
                  {conv.title?.charAt(0) || 'U'}
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--mobile-text-primary)' }}>{conv.title || 'Conversation'}</span>
                    <span style={{ fontSize: '12px', color: unread > 0 ? 'var(--mobile-primary)' : 'var(--mobile-text-secondary)' }}>
                      {conv.last_message_at ? new Date(conv.last_message_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: unread > 0 ? 'var(--mobile-text-primary)' : 'var(--mobile-text-secondary)', fontWeight: unread > 0 ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                      {unread > 0 ? `${unread} new messages` : 'View conversation...'}
                    </span>
                    {unread > 0 && (
                      <div style={{ backgroundColor: 'var(--mobile-primary)', color: 'white', fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '12px' }}>
                        {unread}
                      </div>
                    )}
                  </div>
                </div>
              </MobileCard>
            )
          })}
        </div>
      )}
    </div>
  );
};

export default MobileMessages;
