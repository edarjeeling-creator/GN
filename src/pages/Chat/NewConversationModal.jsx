import React, { useState, useEffect } from 'react';
import { X, Search, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

const NewConversationModal = ({ isOpen, onClose }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const { profile } = useAuth();
  const { createConversation } = useChat();

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, role')
        .eq('school_id', profile?.school_id)
        .neq('id', profile?.id)
        .order('name');
      
      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = async (otherUser) => {
    try {
      await createConversation(otherUser.id, otherUser.name);
      onClose();
    } catch (err) {
      alert('Failed to start conversation. Please try again.');
    }
  };

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(search.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">New Message</h2>
          <button onClick={onClose} className="text-gray-400 hover:bg-gray-100 p-2 rounded-full">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search people..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="animate-spin text-blue-500" size={24} />
            </div>
          ) : filteredUsers.length > 0 ? (
            filteredUsers.map(user => (
              <button
                key={user.id}
                onClick={() => handleStartChat(user)}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  {user.name?.charAt(0) || '?'}
                </div>
                <div>
                  <h3 className="font-medium text-gray-800">{user.name}</h3>
                  <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                </div>
              </button>
            ))
          ) : (
            <div className="text-center p-8 text-gray-500 text-sm">
              No users found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewConversationModal;
