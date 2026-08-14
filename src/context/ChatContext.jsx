import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { deleteChatAttachment } from '../lib/chat_storage';

const ChatContext = createContext({});

export const ChatProvider = ({ children }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState({});
  const [presence, setPresence] = useState({}); // { profileId: { isOnline, lastSeen } }
  const [typing, setTyping] = useState({}); // { conversationId: [profileIds] }
  const [unreadCounts, setUnreadCounts] = useState({});

  // 1. Fetch Conversations
  useEffect(() => {
    if (!user) return;

    const fetchConversations = async () => {
      const { data, error } = await supabase
        .from('conversation_members')
        .select(`
          conversation_id,
          role,
          last_read_message_id,
          conversations (*)
        `)
        .eq('profile_id', user.id)
        .order('conversations(last_message_at)', { ascending: false });

      if (!error && data) {
        setConversations(data.map(m => m.conversations));
      }
    };

    fetchConversations();
  }, [user]);

  // 2. Setup Realtime for Messages and Presence
  useEffect(() => {
    if (!user) return;

    // Messages Subscription
    const messageSub = supabase
      .channel('chat-messages')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages' 
      }, payload => {
        const newMessage = payload.new;
        
        // Add to messages state if we have the conversation loaded
        setMessages(prev => ({
          ...prev,
          [newMessage.conversation_id]: [...(prev[newMessage.conversation_id] || []), newMessage]
        }));

        // Re-order conversations list based on last message
        setConversations(prev => {
          const convIndex = prev.findIndex(c => c.id === newMessage.conversation_id);
          if (convIndex > -1) {
            const updated = [...prev];
            updated[convIndex].last_message_at = newMessage.created_at;
            updated[convIndex].last_message_id = newMessage.id;
            return updated.sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
          }
          return prev;
        });

        // Handle Unread Counts
        if (newMessage.sender_id !== user.id && (!activeConversation || activeConversation.id !== newMessage.conversation_id)) {
          setUnreadCounts(prev => ({
            ...prev,
            [newMessage.conversation_id]: (prev[newMessage.conversation_id] || 0) + 1
          }));
        }
      })
      .subscribe();

    // Presence Subscription
    const presenceChannel = supabase.channel('chat-presence');
    
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const newState = presenceChannel.presenceState();
        const newPresence = {};
        Object.keys(newState).forEach(key => {
          const state = newState[key][0];
          newPresence[state.profile_id] = { isOnline: true, typingIn: state.typingIn };
        });
        setPresence(newPresence);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            profile_id: user.id,
            online_at: new Date().toISOString(),
            typingIn: null
          });
        }
      });

    return () => {
      supabase.removeChannel(messageSub);
      supabase.removeChannel(presenceChannel);
    };
  }, [user, activeConversation]);

  // 3. Actions
  const sendMessage = async (conversationId, content, type = 'text', metadata = {}) => {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content,
        message_type: type,
        metadata
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const markAsRead = async (conversationId, messageId) => {
    await supabase
      .from('conversation_members')
      .update({ last_read_message_id: messageId })
      .eq('conversation_id', conversationId)
      .eq('profile_id', user.id);
      
    setUnreadCounts(prev => ({ ...prev, [conversationId]: 0 }));
  };

  const deleteMessage = async (message) => {
    try {
      // 1. If it's a file, delete from storage first
      if (message.message_type === 'file' && message.metadata?.file_path) {
        await deleteChatAttachment(message.metadata.file_path);
      }

      // 2. Delete from database
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', message.id)
        .eq('sender_id', user.id); // Ensure user is sender

      if (error) throw error;
      
      // Update local state by removing message
      setMessages(prev => {
        const convMessages = prev[message.conversation_id] || [];
        return {
          ...prev,
          [message.conversation_id]: convMessages.filter(m => m.id !== message.id)
        };
      });
      
    } catch (error) {
      console.error('Failed to delete message:', error);
      throw error;
    }
  };

  return (
    <ChatContext.Provider value={{
      conversations,
      activeConversation,
      setActiveConversation,
      messages,
      presence,
      typing,
      unreadCounts,
      sendMessage,
      markAsRead,
      deleteMessage
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);
