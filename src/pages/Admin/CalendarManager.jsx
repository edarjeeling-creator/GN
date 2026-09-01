import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Calendar, MapPin, Clock } from 'lucide-react';
import { eventsService } from '../../services/eventsService';
import { format, parseISO } from 'date-fns';
import { useAuth } from '../../context/AuthContext';

const EVENT_TYPES = [
  'Academic',
  'Exam',
  'Holiday',
  'Assembly',
  'Sports',
  'Cultural',
  'Meeting',
  'PTM',
  'Other'
];

const CalendarManager = () => {
  const { profile } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [currentEventId, setCurrentEventId] = useState(null);

  const initialFormState = {
    title: '',
    date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    location: '',
    description: '',
    event_type: 'Other',
    is_all_day: true,
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const data = await eventsService.getUpcomingEvents(50); // Get next 50 events
      setEvents(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.date) {
      alert("Title and Start Date are required.");
      return;
    }

    try {
      setLoading(true);
      const eventPayload = {
        ...formData,
        created_by: profile?.id,
        // Ensure empty time strings are sent as null for Supabase if not all day
        start_time: formData.is_all_day ? null : (formData.start_time || null),
        end_time: formData.is_all_day ? null : (formData.end_time || null),
        end_date: formData.end_date || null
      };

      if (isEditing && currentEventId) {
        await eventsService.updateEvent(currentEventId, eventPayload);
        alert('Event updated successfully!');
      } else {
        await eventsService.createEvent(eventPayload);
        alert('Event created successfully!');
      }

      setFormData(initialFormState);
      setIsEditing(false);
      setCurrentEventId(null);
      fetchEvents();
    } catch (err) {
      alert('Error saving event: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (event) => {
    setIsEditing(true);
    setCurrentEventId(event.id);
    setFormData({
      title: event.title || '',
      date: event.date || '',
      end_date: event.end_date || '',
      start_time: event.start_time || '',
      end_time: event.end_time || '',
      location: event.location || '',
      description: event.description || '',
      event_type: event.event_type || 'Other',
      is_all_day: event.is_all_day !== false, // default true if null
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      try {
        setLoading(true);
        await eventsService.deleteEvent(id);
        alert('Event deleted successfully!');
        fetchEvents();
      } catch (err) {
        alert('Error deleting event: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setCurrentEventId(null);
    setFormData(initialFormState);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Event Form */}
      <div style={{ background: 'var(--surface-color)', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isEditing ? <Edit2 size={20} /> : <Plus size={20} />}
          {isEditing ? 'Edit Event' : 'Add New Event'}
        </h3>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <label style={{ flex: 1, minWidth: '250px' }}>
              <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Event Title *</span>
              <input type="text" className="input-field" name="title" value={formData.title} onChange={handleInputChange} required style={{ width: '100%' }} />
            </label>
            <label style={{ flex: 1, minWidth: '250px' }}>
              <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Event Type</span>
              <select className="input-field" name="event_type" value={formData.event_type} onChange={handleInputChange} style={{ width: '100%' }}>
                {EVENT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <label style={{ flex: 1, minWidth: '200px' }}>
              <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Start Date *</span>
              <input type="date" className="input-field" name="date" value={formData.date} onChange={handleInputChange} required style={{ width: '100%' }} />
            </label>
            <label style={{ flex: 1, minWidth: '200px' }}>
              <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>End Date (Optional)</span>
              <input type="date" className="input-field" name="end_date" value={formData.end_date} onChange={handleInputChange} style={{ width: '100%' }} />
            </label>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0', cursor: 'pointer' }}>
            <input type="checkbox" name="is_all_day" checked={formData.is_all_day} onChange={handleInputChange} style={{ width: '18px', height: '18px' }} />
            <span style={{ fontWeight: 600 }}>All Day Event</span>
          </label>

          {!formData.is_all_day && (
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '1rem', background: 'var(--background-color)', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
              <label style={{ flex: 1, minWidth: '150px' }}>
                <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Start Time</span>
                <input type="time" className="input-field" name="start_time" value={formData.start_time} onChange={handleInputChange} style={{ width: '100%' }} />
              </label>
              <label style={{ flex: 1, minWidth: '150px' }}>
                <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>End Time</span>
                <input type="time" className="input-field" name="end_time" value={formData.end_time} onChange={handleInputChange} style={{ width: '100%' }} />
              </label>
            </div>
          )}

          <label>
            <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Location (Optional)</span>
            <input type="text" className="input-field" name="location" value={formData.location} onChange={handleInputChange} style={{ width: '100%' }} />
          </label>

          <label>
            <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Description (Optional)</span>
            <textarea className="input-field" name="description" value={formData.description} onChange={handleInputChange} rows={3} style={{ width: '100%', resize: 'vertical' }} />
          </label>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <button type="submit" className="primary-button" style={{ padding: '0.75rem 2rem' }}>
              {isEditing ? 'Update Event' : 'Save Event'}
            </button>
            {isEditing && (
              <button type="button" onClick={handleCancelEdit} style={{ padding: '0.75rem 2rem', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Events List */}
      <div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          Upcoming Events
        </h3>
        
        {loading && events.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading events...</div>
        ) : error ? (
          <div style={{ padding: '1rem', color: '#ef4444', backgroundColor: '#fef2f2', borderRadius: '0.5rem' }}>{error}</div>
        ) : events.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--surface-color)', borderRadius: '0.5rem' }}>
            No upcoming events found.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {events.map((event) => {
              const startDateStr = format(parseISO(event.date), 'dd MMM yyyy');
              const timeStr = event.is_all_day ? 'All Day' : `${event.start_time || ''} ${event.end_time ? '– ' + event.end_time : ''}`;

              return (
                <div key={event.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--surface-color)', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                  
                  <div style={{ display: 'flex', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '60px', padding: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '0.5rem' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{format(parseISO(event.date), 'MMM')}</span>
                      <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{format(parseISO(event.date), 'dd')}</span>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{event.title}</span>
                        {event.event_type && (
                          <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: '#e2e8f0', color: '#475569', fontWeight: 600 }}>
                            {event.event_type}
                          </span>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Clock size={14} /> {timeStr}</span>
                        {event.location && <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><MapPin size={14} /> {event.location}</span>}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => handleEdit(event)} style={{ padding: '0.5rem', border: 'none', background: 'transparent', color: '#3b82f6', cursor: 'pointer', borderRadius: '0.25rem' }} onMouseOver={e => e.currentTarget.style.background = '#eff6ff'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDelete(event.id)} style={{ padding: '0.5rem', border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', borderRadius: '0.25rem' }} onMouseOver={e => e.currentTarget.style.background = '#fef2f2'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                      <Trash2 size={18} />
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarManager;
