import { createContext, useState, useEffect, useContext } from 'react';
import { supabase, setClientSchoolId } from '../lib/supabase';

const SubscriptionContext = createContext();

export const useSubscription = () => useContext(SubscriptionContext);

export const SubscriptionProvider = ({ children }) => {
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const resolveSchool = async () => {
      try {
        setLoading(true);
        
        // 1. Get hostname or allow query override for testing (e.g. localhost?school_domain=demo.smartgrades.com)
        const params = new URLSearchParams(window.location.search);
        let domain = params.get('school_domain') || window.location.hostname;
        
        // If local development, default to localhost
        if (domain === '127.0.0.1') {
          domain = 'localhost';
        }

        // 2. Fetch the school details from Supabase using direct select (not proxied since 'schools' is global)
        const { data, error: fetchError } = await supabase
          .from('schools')
          .select('*')
          .eq('custom_domain', domain)
          .single();

        if (fetchError || !data) {
          // If not found, try to fallback to 'localhost' default mock school so the app doesn't break
          console.warn(`Domain ${domain} not found, falling back to localhost`);
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('schools')
            .select('*')
            .eq('custom_domain', 'localhost')
            .single();

          if (fallbackError || !fallbackData) {
            throw new Error(fetchError?.message || "School tenant could not be resolved.");
          }
          
          setSchool(fallbackData);
          setClientSchoolId(fallbackData.id);
        } else {
          setSchool(data);
          setClientSchoolId(data.id);
        }
      } catch (err) {
        console.error("Subscription resolution error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    resolveSchool();
  }, []);

  // Graceful degradation states based on subscription
  const isSuspended = school?.license_status === 'suspended';
  const isReadOnly = school?.license_status === 'read_only' || isSuspended;
  const isLimited = school?.license_status === 'limited';
  const hasWarning = school?.license_status === 'warning' || school?.license_status === 'grace';

  return (
    <SubscriptionContext.Provider value={{
      school,
      loading,
      error,
      isReadOnly,
      isLimited,
      isSuspended,
      hasWarning,
      subscriptionPlan: school?.subscription_plan,
      allowedStudents: school?.allowed_students || 0,
      allowedTeachers: school?.allowed_teachers || 0
    }}>
      {loading ? (
        <div style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(to right, #0f172a, #1e293b)',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid rgba(255,255,255,0.1)',
            borderTopColor: '#38bdf8',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '1rem'
          }} />
          <p style={{ fontSize: '1.1rem', fontWeight: '500', color: '#94a3b8' }}>Resolving School Portal...</p>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : error ? (
        <div style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          color: '#ef4444',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Configuration Error</h2>
          <p style={{ color: '#94a3b8', maxWidth: '500px', marginBottom: '1.5rem' }}>
            We could not resolve this domain to a registered school tenant.
          </p>
          <code style={{ background: '#1e293b', padding: '0.5rem 1rem', borderRadius: '0.25rem', color: '#f8fafc' }}>
            Domain: {window.location.hostname}
          </code>
        </div>
      ) : (
        children
      )}
    </SubscriptionContext.Provider>
  );
};
