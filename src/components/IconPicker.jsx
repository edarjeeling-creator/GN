import React, { useState } from 'react';
import * as LucideIcons from 'lucide-react';

const ICON_LIST = [
  'Users', 'BookOpen', 'Award', 'FileText', 'Phone', 'CheckCircle', 'Trophy', 
  'ImageIcon', 'Shield', 'Megaphone', 'Bell', 'GraduationCap', 'Star', 'Globe', 
  'Heart', 'Smile', 'Lightbulb', 'Briefcase', 'Target', 'Compass', 'Activity', 'Feather'
];

export default function IconPicker({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const CurrentIcon = LucideIcons[value] || LucideIcons.HelpCircle;
  
  const filteredIcons = ICON_LIST.filter(icon => icon.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative">
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-2 border border-slate-300 rounded-md bg-white hover:bg-slate-50 w-full text-left"
      >
        <CurrentIcon className="w-5 h-5 text-slate-700" />
        <span className="flex-1 text-sm text-slate-700">{value || 'Select an Icon'}</span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-64 bg-white border border-slate-200 rounded-md shadow-lg p-2 max-h-64 overflow-y-auto">
          <input 
            type="text" 
            placeholder="Search icons..." 
            className="w-full p-2 mb-2 border border-slate-200 rounded text-sm outline-none"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="grid grid-cols-4 gap-2">
            {filteredIcons.map(iconName => {
              const IconComp = LucideIcons[iconName];
              return (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => {
                    onChange(iconName);
                    setIsOpen(false);
                  }}
                  className={`p-2 rounded flex flex-col items-center justify-center hover:bg-blue-50 ${value === iconName ? 'bg-blue-100 text-blue-600' : 'text-slate-600'}`}
                  title={iconName}
                >
                  <IconComp className="w-5 h-5" />
                </button>
              );
            })}
          </div>
          {filteredIcons.length === 0 && <p className="text-center text-xs text-slate-500 py-2">No icons found</p>}
        </div>
      )}
    </div>
  );
}
