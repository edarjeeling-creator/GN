import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { deleteChatAttachment } from '../lib/chat_storage';

const ChatContext = createContext({});

export const ChatProvider = ({ children }) => {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState({});
  const [presence, setPresence] = useState({}); // { profileId: { isOnline, lastSeen } }
  const [typing, setTyping] = useState({}); // { conversationId: [profileIds] }
  const [unreadCounts, setUnreadCounts] = useState({});

  // 1. Fetch Conversations
  useEffect(() => {
    if (!profile) return;

    const fetchConversations = async () => {
      const { data, error } = await supabase
        .from('conversation_members')
        .select(`
          conversation_id,
          role,
          last_read_message_id,
          conversations (*)
        `)
        .eq('profile_id', profile.id)
        .order('conversations(last_message_at)', { ascending: false });

      if (!error && data) {
        setConversations(data.map(m => m.conversations));
      }
    };

    fetchConversations();
  }, [profile]);

  // 2. Setup Realtime for Messages and Presence
  useEffect(() => {
    if (!profile) return;

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
        if (newMessage.sender_id !== profile.id && (!activeConversation || activeConversation.id !== newMessage.conversation_id)) {
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
            profile_id: profile.id,
            online_at: new Date().toISOString(),
            typingIn: null
          });
        }
      });

    return () => {
      supabase.removeChannel(messageSub);
      supabase.removeChannel(presenceChannel);
    };
  }, [profile, activeConversation]);

  // 3. Actions
  const createConversation = async (otherUserId, title = null) => {
    try {
      // First check if a direct conversation already exists in our loaded state
      // (This is a simplified check. A robust check would query the DB, 
      // but this prevents the most common duplicates)
      const { data: existingConvs } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('profile_id', profile.id);
        
      if (existingConvs && existingConvs.length > 0) {
        const { data: sharedConvs } = await supabase
          .from('conversation_members')
          .select('conversation_id, conversations!inner(type)')
          .eq('profile_id', otherUserId)
          .in('conversation_id', existingConvs.map(c => c.conversation_id))
          .eq('conversations.type', 'direct');

        if (sharedConvs && sharedConvs.length > 0) {
          const existingConvId = sharedConvs[0].conversation_id;
          const existingConv = conversations.find(c => c.id === existingConvId) || { id: existingConvId, type: 'direct' };
          setActiveConversation(existingConv);
          return existingConv;
        }
      }

      
// Fallback UUID generator
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

      const newConvId = generateUUID();

      const { error: convError } = await supabase
        .from('conversations')
        .insert({
          id: newConvId,
          type: 'direct',
          title: title,
          school_id: profile?.school_id || '00000000-0000-0000-0000-000000000000',
          created_by: profile.id
        });

      if (convError) {
        console.error("Conversation insert error:", convError);
        const errDump = { 
          message: convError.message, 
          code: convError.code, 
          details: convError.details, 
          hint: convError.hint,
          raw: JSON.stringify(convError)
        };
        throw new Error(`Failed to insert conversation: ${JSON.stringify(errDump)}`);
      }

      const members = [
        { conversation_id: newConvId, profile_id: profile.id, role: 'admin' },
        { conversation_id: newConvId, profile_id: otherUserId, role: 'member' }
      ];

      const { error: membersError } = await supabase
        .from('conversation_members')
        .insert(members);

      if (membersError) {
        console.error("Members insert error:", membersError);
        throw new Error(`Failed to insert conversation members: ${JSON.stringify(membersError)}`);
      }
      
      const newConv = { 
        id: newConvId, 
        type: 'direct', 
        title: title, 
        created_by: profile.id,
        school_id: profile?.school_id || '00000000-0000-0000-0000-000000000000',
        created_at: new Date().toISOString()
      };
      setActiveConversation(newConv);
      setConversations(prev => [newConv, ...prev]);
      
      return newConv;
    } catch (error) {
      console.error('Failed to create conversation:', error); console.log('Error keys:', Object.keys(error || {}));
      throw error;
    }
  };

  const sendMessage = async (conversationId, content, type = 'text', metadata = {}) => {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: profile.id,
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
      .eq('profile_id', profile.id);
      
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
        .eq('sender_id', profile.id); // Ensure user is sender

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
      createConversation,
      sendMessage,
      markAsRead,
      deleteMessage
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);
