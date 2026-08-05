import React from 'react';
import { ArrowLeft, Search, Users, MessageSquare, Plus } from 'lucide-react';
import { useChat } from '../../context/ChatContext';

const ChatSidebar = ({ onBack }) => {
  const { conversations, activeConversation, setActiveConversation, unreadCounts } = useChat();

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-100">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-500 hover:bg-gray-100 p-2 rounded-full">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-xl font-bold text-gray-800">Messages</h2>
        </div>
        <button className="text-blue-600 hover:bg-blue-50 p-2 rounded-full transition-colors">
          <Plus size={20} />
        </button>
      </div>

      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search messages..." 
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.map(conv => (
          <div 
            key={conv.id}
            onClick={() => setActiveConversation(conv)}
            className={`flex items-center justify-between p-4 cursor-pointer border-b border-gray-50 transition-colors ${activeConversation?.id === conv.id ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-white ${conv.type === 'group' ? 'bg-green-500' : 'bg-blue-500'}`}>
                {conv.type === 'group' ? <Users size={20} /> : <MessageSquare size={20} />}
              </div>
              <div className="truncate">
                <h3 className={`font-medium truncate ${unreadCounts[conv.id] > 0 ? 'text-gray-900 font-bold' : 'text-gray-700'}`}>
                  {conv.title || 'Conversation'}
                </h3>
                <p className={`text-sm truncate ${unreadCounts[conv.id] > 0 ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>
                  {/* Would show last message snippet here */}
                  Tap to view conversation...
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
              <span className="text-xs text-gray-400">
                {new Date(conv.last_message_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
              {unreadCounts[conv.id] > 0 && (
                <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {unreadCounts[conv.id]}
                </span>
              )}
            </div>
          </div>
        ))}
        {conversations.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            No conversations yet.
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatSidebar;
