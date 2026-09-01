import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Search, Clock, MapPin, Calendar as CalendarIcon, List } from 'lucide-react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  startOfWeek, 
  endOfWeek,
  parseISO,
  isAfter,
  startOfDay
} from 'date-fns';
import { eventsService } from '../../services/eventsService';

const MobileCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('month'); // 'month' or 'agenda'

  useEffect(() => {
    if (view === 'month') {
      fetchEventsForCurrentMonth();
    } else {
      fetchUpcomingEvents();
    }
  }, [currentDate, view]);

  const fetchEventsForCurrentMonth = async () => {
    try {
      setLoading(true);
      setError(null);
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const startDate = startOfWeek(monthStart);
      const endDate = endOfWeek(monthEnd);
      
      const data = await eventsService.getEventsForDateRange(startDate, endDate);
      setEvents(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUpcomingEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await eventsService.getUpcomingEvents(20);
      setEvents(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleDateClick = (day) => {
    setSelectedDate(day);
    // On mobile, sometimes clicking a date in month view scrolls down to the events list
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const dateFormat = "d";
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
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '24px', minHeight: '100vh', backgroundColor: 'var(--mobile-bg)' }}>
      
      {/* Header & View Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: 'var(--mobile-text-primary)' }}>Calendar</h2>
        
        <div style={{ display: 'flex', backgroundColor: '#e2e8f0', borderRadius: '8px', padding: '4px' }}>
          <button 
            onClick={() => setView('month')}
            style={{ 
              padding: '6px 12px', 
              borderRadius: '6px', 
              border: 'none', 
              background: view === 'month' ? 'white' : 'transparent', 
              color: view === 'month' ? 'var(--mobile-primary)' : 'var(--mobile-text-secondary)',
              fontWeight: view === 'month' ? 'bold' : 'normal',
              boxShadow: view === 'month' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer'
            }}
          >
            <CalendarIcon size={16} /> Month
          </button>
          <button 
            onClick={() => setView('agenda')}
            style={{ 
              padding: '6px 12px', 
              borderRadius: '6px', 
              border: 'none', 
              background: view === 'agenda' ? 'white' : 'transparent', 
              color: view === 'agenda' ? 'var(--mobile-primary)' : 'var(--mobile-text-secondary)',
              fontWeight: view === 'agenda' ? 'bold' : 'normal',
              boxShadow: view === 'agenda' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer'
            }}
          >
            <List size={16} /> Agenda
          </button>
        </div>
      </div>

      {view === 'month' && (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          {/* Month Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
              {format(currentDate, 'MMMM yyyy')}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={prevMonth} style={{ background: '#f1f5f9', border: 'none', padding: '8px', borderRadius: '50%', cursor: 'pointer' }}>
                <ChevronLeft size={20} color="var(--mobile-text-primary)" />
              </button>
              <button onClick={nextMonth} style={{ background: '#f1f5f9', border: 'none', padding: '8px', borderRadius: '50%', cursor: 'pointer' }}>
                <ChevronRight size={20} color="var(--mobile-text-primary)" />
              </button>
            </div>
          </div>
          
          {/* Calendar Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', gap: '8px' }}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
              <div key={i} style={{ fontSize: '13px', color: 'var(--mobile-text-secondary)', marginBottom: '8px', fontWeight: 'bold' }}>{day}</div>
            ))}
            
            {loading && events.length === 0 ? (
              <div style={{ gridColumn: 'span 7', padding: '40px', color: 'var(--mobile-text-secondary)' }}>Loading events...</div>
            ) : (
              days.map((day, i) => {
                const isSelected = isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, monthStart);
                const isToday = isSameDay(day, new Date());
                const hasEvent = hasEvents(day);

                return (
                  <div 
                    key={i} 
                    onClick={() => handleDateClick(day)}
                    style={{ 
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      opacity: isCurrentMonth ? 1 : 0.3
                    }}
                  >
                    <div style={{ 
                      width: '36px', 
                      height: '36px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      borderRadius: '50%',
                      backgroundColor: isSelected ? 'var(--mobile-primary)' : (isToday ? '#dcfce7' : 'transparent'),
                      color: isSelected ? 'white' : (isToday ? '#166534' : 'var(--mobile-text-primary)'),
                      fontSize: '15px',
                      fontWeight: (isSelected || isToday) ? 'bold' : 'normal',
                      position: 'relative'
                    }}>
                      {format(day, dateFormat)}
                      
                      {/* Event Indicator */}
                      {hasEvent && (
                        <div style={{
                          position: 'absolute',
                          bottom: '3px',
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          backgroundColor: isSelected ? 'white' : 'var(--mobile-primary)'
                        }} />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Selected Day Events */}
          <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 'bold', color: 'var(--mobile-text-primary)' }}>
              {isSameDay(selectedDate, new Date()) ? 'Today, ' : ''}{format(selectedDate, 'dd MMMM yyyy')}
            </h4>
            
            {error ? (
              <div style={{ color: '#ef4444', fontSize: '14px', backgroundColor: '#fef2f2', padding: '12px', borderRadius: '8px' }}>Unable to load calendar events. Please try again.</div>
            ) : loading && selectedDayEvents.length === 0 ? (
              <div style={{ color: 'var(--mobile-text-secondary)', fontSize: '14px' }}>Loading...</div>
            ) : selectedDayEvents.length === 0 ? (
              <div style={{ color: 'var(--mobile-text-secondary)', fontSize: '15px', fontStyle: 'italic', textAlign: 'center', padding: '24px' }}>No events scheduled</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {selectedDayEvents.map(event => (
                  <div key={event.id} style={{ display: 'flex', flexDirection: 'column', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', borderLeft: '4px solid var(--mobile-primary)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '16px', color: 'var(--mobile-text-primary)', marginBottom: '8px' }}>{event.title}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--mobile-text-secondary)', fontSize: '14px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={16} /> 
                        {event.is_all_day ? 'All Day' : `${event.start_time || ''} ${event.end_time ? '– ' + event.end_time : ''}`}
                      </span>
                      {event.location && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MapPin size={16} /> {event.location}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'agenda' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error ? (
            <div style={{ color: '#ef4444', fontSize: '14px', backgroundColor: '#fef2f2', padding: '12px', borderRadius: '8px' }}>Unable to load calendar events. Please try again.</div>
          ) : loading && events.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--mobile-text-secondary)' }}>Loading events...</div>
          ) : events.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'white', borderRadius: '16px', color: 'var(--mobile-text-secondary)' }}>No upcoming events scheduled.</div>
          ) : (
            events.map((event, index) => {
              const eventDate = parseISO(event.date);
              const eventEnd = event.end_date ? parseISO(event.end_date) : eventDate;
              // Event is past if its end_date is entirely in the past (before today)
              const isPast = !isAfter(eventEnd, startOfDay(new Date())) && !isSameDay(eventEnd, new Date());
              
              // Add a month header if it's the first event of a new month
              const showMonthHeader = index === 0 || !isSameMonth(eventDate, parseISO(events[index - 1].date));

              return (
                <React.Fragment key={event.id}>
                  {showMonthHeader && (
                    <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--mobile-text-secondary)', textTransform: 'uppercase', margin: '8px 0 0 0', letterSpacing: '1px' }}>
                      {format(eventDate, 'MMMM yyyy')}
                    </h3>
                  )}
                  
                  <div style={{ display: 'flex', backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', opacity: isPast ? 0.6 : 1, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', minWidth: '70px', backgroundColor: isSameDay(eventDate, new Date()) ? 'var(--mobile-primary)' : '#f8fafc', color: isSameDay(eventDate, new Date()) ? 'white' : 'var(--mobile-text-primary)' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>{format(eventDate, 'EEE')}</span>
                      <span style={{ fontSize: '24px', fontWeight: 800 }}>{format(eventDate, 'dd')}</span>
                    </div>
                    
                    <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 'bold', color: 'var(--mobile-text-primary)' }}>
                        {event.title}
                      </h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--mobile-text-secondary)', fontSize: '13px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={14} /> 
                          {event.is_all_day ? 'All Day' : `${event.start_time || ''} ${event.end_time ? '– ' + event.end_time : ''}`}
                        </span>
                        {event.location && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MapPin size={14} /> {event.location}
                          </span>
                        )}
                      </div>
                      {event.description && (
                        <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: 'var(--mobile-text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default MobileCalendar;
