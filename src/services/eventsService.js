import { supabase } from '../lib/supabase';
import { startOfMonth, endOfMonth, format } from 'date-fns';

export const eventsService = {
  /**
   * Fetch events within a specific date range (e.g. for a month view)
   */
  async getEventsForDateRange(startDate, endDate) {
    const startStr = format(startDate, 'yyyy-MM-dd');
    const endStr = format(endDate, 'yyyy-MM-dd');
    
    // Using Supabase to filter events where either date or end_date falls within the range
    // Overlap condition: event.date <= endStr AND (event.end_date >= startStr OR (event.end_date is null AND event.date >= startStr))
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .lte('date', endStr)
      .or(`end_date.gte.${startStr},and(end_date.is.null,date.gte.${startStr})`)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });
      
    if (error) {
      console.error('Error fetching calendar events:', error);
      throw error;
    }
    return data;
  },

  /**
   * Fetch upcoming events from today onwards
   */
  async getUpcomingEvents(limit = 10) {
    const today = format(new Date(), 'yyyy-MM-dd');
    
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .or(`end_date.gte.${today},and(end_date.is.null,date.gte.${today})`)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(limit);
      
    if (error) {
      console.error('Error fetching upcoming events:', error);
      throw error;
    }
    return data;
  },

  /**
   * Fetch all events (use carefully)
   */
  async getAllEvents() {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('date', { ascending: false });
      
    if (error) {
      console.error('Error fetching all events:', error);
      throw error;
    }
    return data;
  },

  /**
   * Create a new event
   */
  async createEvent(eventData) {
    const { data, error } = await supabase
      .from('events')
      .insert([eventData])
      .select()
      .single();
      
    if (error) {
      console.error('Error creating event:', error);
      throw error;
    }
    return data;
  },

  /**
   * Update an existing event
   */
  async updateEvent(id, eventData) {
    const { data, error } = await supabase
      .from('events')
      .update(eventData)
      .eq('id', id)
      .select()
      .single();
      
    if (error) {
      console.error('Error updating event:', error);
      throw error;
    }
    return data;
  },

  /**
   * Delete an event
   */
  async deleteEvent(id) {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);
      
    if (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
    return true;
  }
};
