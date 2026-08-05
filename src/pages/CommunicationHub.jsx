import React, { useState } from 'react';
import { MessageSquare, Users, Bell, Search, Star, MessageCircle, FileText, Settings } from 'lucide-react';
import { useChat } from '../context/ChatContext';
import { useNavigate } from 'react-router-dom';
import Chat from './Chat/Chat'; // We will build this next

const CommunicationHub = () => {
  const { unreadCounts, conversations } = useChat();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' or 'chat'

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  if (activeTab === 'chat') {
    return <Chat onBack={() => setActiveTab('dashboard')} />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Communication Hub</h1>
          <p className="text-gray-500 mt-1">Your central workspace for school communications</p>
        </div>
        <button 
          onClick={() => setActiveTab('chat')}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <MessageSquare size={20} />
          Open Chat
          {totalUnread > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full ml-2">
              {totalUnread}
            </span>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard icon={<Bell className="text-orange-500" />} title="Announcements" value="3 New" bg="bg-orange-50" />
        <StatCard icon={<MessageCircle className="text-blue-500" />} title="Unread Messages" value={totalUnread} bg="bg-blue-50" />
        <StatCard icon={<Users className="text-green-500" />} title="Active Groups" value="12" bg="bg-green-50" />
        <StatCard icon={<FileText className="text-purple-500" />} title="ERP Discussions" value="5 Pending" bg="bg-purple-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Discussions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <MessageSquare className="text-blue-500" /> Recent Activity
              </h2>
              <button onClick={() => setActiveTab('chat')} className="text-blue-600 text-sm hover:underline">View All</button>
            </div>
            
            <div className="space-y-4">
              {conversations.slice(0, 5).map(conv => (
                <div key={conv.id} className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg cursor-pointer border border-transparent hover:border-gray-100 transition-all" onClick={() => setActiveTab('chat')}>
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${conv.type === 'group' ? 'bg-green-500' : 'bg-blue-500'}`}>
                      {conv.type === 'group' ? <Users size={20} /> : <MessageSquare size={20} />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">{conv.title || 'Direct Message'}</h3>
                      <p className="text-sm text-gray-500 truncate max-w-md">Latest message snippet would go here...</p>
                    </div>
                  </div>
                  {unreadCounts[conv.id] > 0 && (
                    <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                      {unreadCounts[conv.id]}
                    </span>
                  )}
                </div>
              ))}
              {conversations.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No recent conversations found.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <ActionButton icon={<Search />} label="Search Messages & Files" />
              <ActionButton icon={<Users />} label="Create New Group" />
              <ActionButton icon={<Bell />} label="Post Announcement" color="text-orange-500" />
              <ActionButton icon={<Star />} label="Saved Messages" color="text-yellow-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, title, value, bg }) => (
  <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
    <div className={`p-4 rounded-lg ${bg}`}>
      {icon}
    </div>
    <div>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
    </div>
  </div>
);

const ActionButton = ({ icon, label, color = "text-gray-600" }) => (
  <button className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg text-left transition-colors border border-transparent hover:border-gray-200">
    <span className={color}>{icon}</span>
    <span className="font-medium text-gray-700">{label}</span>
  </button>
);

export default CommunicationHub;
