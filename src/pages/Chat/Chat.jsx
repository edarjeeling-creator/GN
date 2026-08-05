import React from 'react';
import { ArrowLeft, Users, MessageSquare, Info, MoreVertical } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import ChatSidebar from './ChatSidebar';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

const Chat = ({ onBack }) => {
  const { activeConversation, setActiveConversation } = useChat();

  return (
    <div className="flex h-[calc(100vh-80px)] bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden m-6">
      {/* Sidebar */}
      <div className={`w-full md:w-80 border-r border-gray-100 flex flex-col bg-gray-50/50 ${activeConversation ? 'hidden md:flex' : 'flex'}`}>
        <ChatSidebar onBack={onBack} />
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col bg-white ${!activeConversation ? 'hidden md:flex' : 'flex'}`}>
        {activeConversation ? (
          <>
            {/* Header */}
            <div className="h-16 border-b border-gray-100 flex items-center justify-between px-6 bg-white">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setActiveConversation(null)}
                  className="md:hidden text-gray-500 hover:bg-gray-100 p-2 rounded-full"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${activeConversation.type === 'group' ? 'bg-green-500' : 'bg-blue-500'}`}>
                  {activeConversation.type === 'group' ? <Users size={20} /> : <MessageSquare size={20} />}
                </div>
                <div>
                  <h2 className="font-bold text-gray-800">{activeConversation.title || 'Conversation'}</h2>
                  <p className="text-xs text-green-500 font-medium">Online</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="text-gray-500 hover:bg-gray-100 p-2 rounded-full">
                  <Info size={20} />
                </button>
                <button className="text-gray-500 hover:bg-gray-100 p-2 rounded-full">
                  <MoreVertical size={20} />
                </button>
              </div>
            </div>

            {/* Message List */}
            <MessageList conversation={activeConversation} />

            {/* Input Area */}
            <MessageInput conversationId={activeConversation.id} />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <MessageSquare size={48} className="mb-4 opacity-20" />
            <p className="text-lg font-medium">Select a conversation to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
