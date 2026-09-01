import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, parseISO, startOfDay } from 'date-fns';
import { eventsService } from '../services/eventsService';

const CalendarWidget = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEventsForCurrentMonth = async () => {
      try {
        setLoading(true);
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);
        
        const data = await eventsService.getEventsForDateRange(startDate, endDate);
        setEvents(data || []);
      } catch (err) {
        console.error("Failed to load events", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEventsForCurrentMonth();
  }, [currentDate]);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleDateClick = (day) => setSelectedDate(day);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const isEventOnDay = (event, day) => {
    const eventStart = startOfDay(parseISO(event.date));
    const eventEnd = event.end_date ? startOfDay(parseISO(event.end_date)) : eventStart;
    const currentDay = startOfDay(day);
    return currentDay >= eventStart && currentDay <= eventEnd;
  };

  const selectedDayEvents = events.filter(event => isEventOnDay(event, selectedDate));
  const hasEvents = (day) => events.some(event => isEventOnDay(event, day));

  return (
    <Card className="h-full flex flex-col bg-slate-900 border-slate-800 text-white shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
      <CardHeader className="pb-2 flex flex-row items-center justify-between border-b border-slate-800">
        <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-100">
          <CalendarIcon size={20} className="text-brand-400" /> 
          School Calendar
        </CardTitle>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1 hover:bg-slate-800 rounded-md transition-colors text-slate-400 hover:text-white">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold w-24 text-center text-slate-200">
            {format(currentDate, 'MMM yyyy')}
          </span>
          <button onClick={nextMonth} className="p-1 hover:bg-slate-800 rounded-md transition-colors text-slate-400 hover:text-white">
            <ChevronRight size={18} />
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-4 flex-1 flex flex-col xl:flex-row gap-6 relative z-10">
        
        {/* Calendar Grid */}
        <div className="flex-1">
          <div className="grid grid-cols-7 text-center mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day, i) => (
              <div key={i} className="text-xs font-bold text-slate-500">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, i) => {
              const isSelected = isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, monthStart);
              const isToday = isSameDay(day, new Date());
              const dayHasEvent = hasEvents(day);

              return (
                <div 
                  key={i} 
                  onClick={() => handleDateClick(day)}
                  className={`
                    flex items-center justify-center h-10 w-full rounded-md cursor-pointer text-sm transition-all relative
                    ${!isCurrentMonth ? 'text-slate-600' : 'text-slate-300 hover:bg-slate-800'}
                    ${isSelected ? 'bg-brand-500 text-white hover:bg-brand-600 font-bold' : ''}
                    ${isToday && !isSelected ? 'bg-slate-800 text-brand-400 font-bold border border-slate-700' : ''}
                  `}
                >
                  {format(day, 'd')}
                  {dayHasEvent && (
                    <div className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-brand-500'}`}></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Date Events */}
        <div className="flex-1 min-w-[200px] border-t xl:border-t-0 xl:border-l border-slate-800 pt-4 xl:pt-0 xl:pl-6 flex flex-col">
          <h4 className="text-sm font-bold text-slate-300 mb-4 pb-2 border-b border-slate-800">
            {isSameDay(selectedDate, new Date()) ? 'Today, ' : ''}{format(selectedDate, 'MMM do, yyyy')}
          </h4>
          
          <div className="flex-1 overflow-y-auto max-h-[220px] pr-2 space-y-3 custom-scrollbar">
            {loading ? (
              <div className="text-xs text-slate-500 italic">Loading events...</div>
            ) : selectedDayEvents.length === 0 ? (
              <div className="text-xs text-slate-500 italic">No events scheduled.</div>
            ) : (
              selectedDayEvents.map(event => (
                <div key={event.id} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 border-l-2 border-l-brand-500">
                  <div className="font-semibold text-sm text-slate-200 mb-1">{event.title}</div>
                  <div className="flex flex-col gap-1 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Clock size={12} className="text-brand-400/70" /> 
                      {event.is_all_day ? 'All Day' : `${event.start_time || ''} ${event.end_time ? '– ' + event.end_time : ''}`}
                    </span>
                    {event.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin size={12} className="text-amber-400/70" /> {event.location}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </CardContent>
    </Card>
  );
};

export default CalendarWidget;
