import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Search, Calendar as CalendarIcon, MapPin, Clock } from 'lucide-react';
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
  startOfDay
} from 'date-fns';
import { eventsService } from '../../services/eventsService';

const MobileCalendarWidget = ({ style = {} }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchEventsForCurrentMonth();
  }, [currentDate]);

  const fetchEventsForCurrentMonth = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // We fetch events from the start of the visible calendar grid to the end of the visible grid
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

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleDateClick = (day) => setSelectedDate(day);

  // Generate the calendar grid days
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

  // Get events for the selected day
  const selectedDayEvents = events.filter(event => isEventOnDay(event, selectedDate));

  // Check if a day has events
  const hasEvents = (day) => {
    return events.some(event => isEventOnDay(event, day));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', ...style }}>
      
      {/* Month Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>
          {format(currentDate, 'MMMM yyyy')}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ 
            backgroundColor: '#1a1a1a', 
            color: 'white', 
            padding: '6px 16px', 
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px'
          }}>
            <Search size={16} /> Search
          </div>
          <button onClick={prevMonth} style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer' }}>
            <ChevronLeft size={20} color="var(--mobile-text-primary)" />
          </button>
          <button onClick={nextMonth} style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer' }}>
            <ChevronRight size={20} color="var(--mobile-text-primary)" />
          </button>
        </div>
      </div>
      
      {/* Calendar Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', gap: '8px' }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <div key={i} style={{ fontSize: '13px', color: 'var(--mobile-text-secondary)', marginBottom: '8px' }}>{day}</div>
        ))}
        
        {loading && events.length === 0 ? (
          <div style={{ gridColumn: 'span 7', padding: '20px', color: 'var(--mobile-text-secondary)' }}>Loading events...</div>
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
                  opacity: isCurrentMonth ? 1 : 0.4
                }}
              >
                <div style={{ 
                  width: '32px', 
                  height: '32px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  borderRadius: '50%',
                  backgroundColor: isSelected ? 'var(--mobile-primary)' : (isToday ? 'rgba(92, 184, 92, 0.1)' : 'transparent'),
                  color: isSelected ? 'white' : (isToday ? 'var(--mobile-primary)' : 'var(--mobile-text-primary)'),
                  fontSize: '14px',
                  fontWeight: (isSelected || isToday) ? 'bold' : 'normal',
                  position: 'relative'
                }}>
                  {format(day, dateFormat)}
                  
                  {/* Event Indicator Dot */}
                  {hasEvent && (
                    <div style={{
                      position: 'absolute',
                      bottom: '2px',
                      width: '4px',
                      height: '4px',
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
      <div style={{ marginTop: '16px', borderTop: '1px solid var(--mobile-border)', paddingTop: '16px' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 'bold' }}>
          {isSameDay(selectedDate, new Date()) ? 'Today, ' : ''}{format(selectedDate, 'dd MMMM yyyy')}
        </h4>
        
        {error ? (
          <div style={{ color: '#ef4444', fontSize: '14px' }}>Unable to load calendar events. Please try again.</div>
        ) : loading && selectedDayEvents.length === 0 ? (
          <div style={{ color: 'var(--mobile-text-secondary)', fontSize: '14px' }}>Loading...</div>
        ) : selectedDayEvents.length === 0 ? (
          <div style={{ color: 'var(--mobile-text-secondary)', fontSize: '14px', fontStyle: 'italic' }}>No events scheduled</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {selectedDayEvents.map(event => (
              <div key={event.id} style={{ display: 'flex', flexDirection: 'column', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '12px', borderLeft: '4px solid var(--mobile-primary)' }}>
                <span style={{ fontWeight: 'bold', fontSize: '15px', color: 'var(--mobile-text-primary)', marginBottom: '4px' }}>{event.title}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--mobile-text-secondary)', fontSize: '13px' }}>
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileCalendarWidget;
