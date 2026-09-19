import React from 'react';
import { Phone, Shield, HeartPulse, Building2, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';

export default function CampusEmergencyContacts() {
  const contacts = [
    {
      role: 'Principal Office',
      desc: 'School Administration',
      phone: '+91 354 225 4321',
      icon: Building2,
      color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
    },
    {
      role: 'Main Campus Gate',
      desc: 'Security & Visitor Control',
      phone: '+91 98001 23456',
      icon: Shield,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    },
    {
      role: 'First Aid & Medical Room',
      desc: 'Campus Health Assistance',
      phone: '+91 98002 34567',
      icon: HeartPulse,
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/20'
    },
    {
      role: 'Estate / Maintenance In-Charge',
      desc: 'Electrical, Water & Facility Support',
      phone: '+91 98003 45678',
      icon: Phone,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    }
  ];

  return (
    <Card className="bg-slate-900 border border-slate-800 text-white shadow-xl overflow-hidden relative rounded-2xl">
      <div className="absolute top-0 right-0 w-60 h-60 bg-rose-500/5 rounded-full blur-3xl pointer-events-none"></div>
      
      <CardHeader className="p-5 pb-3 border-b border-slate-800 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-white">
          <AlertTriangle size={18} className="text-amber-400" />
          Campus Emergency & Key Contacts
        </CardTitle>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
          Quick Dial
        </span>
      </CardHeader>

      <CardContent className="p-5 pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {contacts.map((c, i) => {
            const Icon = c.icon;
            const telLink = `tel:${c.phone.replace(/[^0-9+]/g, '')}`;

            return (
              <div 
                key={i} 
                className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col justify-between space-y-2.5 hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg border shrink-0 ${c.color}`}>
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-white truncate">{c.role}</h4>
                    <p className="text-[11px] text-slate-400 truncate">{c.desc}</p>
                  </div>
                </div>

                <a 
                  href={telLink} 
                  className="w-full py-2 px-3 rounded-lg bg-slate-700 hover:bg-emerald-600 text-slate-200 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <Phone size={12} className="text-emerald-400 group-hover:text-white" />
                  <span className="font-mono">{c.phone}</span>
                </a>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
