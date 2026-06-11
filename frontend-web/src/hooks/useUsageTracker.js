import { useEffect, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export function useUsageTracker(source = 'web', action = 'read') {
  const { user } = useAuth();
  const activeSeconds = useRef(0);
  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    // Only track if user is logged in
    if (!userRef.current) return;

    let intervalId = setInterval(() => {
      // Only track if document is visible and tab is active
      if (document.visibilityState === 'visible') {
        activeSeconds.current += 10;
        
        // Every 30 seconds, sync to backend
        if (activeSeconds.current >= 30) {
          const mode = navigator.onLine ? 'online' : 'offline';
          const payload = {
            source,
            action,
            duration: activeSeconds.current,
            mode
          };

          api.post('/api/user/track', payload)
            .then(() => {
              activeSeconds.current = 0;
            })
            .catch(err => {
              // If failed or offline, we buffer the log in localStorage to sync later!
              const offlineQueue = JSON.parse(localStorage.getItem('pending_usage_logs') || '[]');
              offlineQueue.push({
                ...payload,
                timestamp: new Date().toISOString()
              });
              localStorage.setItem('pending_usage_logs', JSON.stringify(offlineQueue));
              activeSeconds.current = 0;
            });
        }
      }
    }, 10000);

    // Sync any queued offline logs when browser goes online
    const handleOnline = () => {
      if (!userRef.current) return;
      const offlineQueue = JSON.parse(localStorage.getItem('pending_usage_logs') || '[]');
      if (offlineQueue.length > 0) {
        Promise.all(offlineQueue.map(log => 
          api.post('/api/user/track', log)
        )).then(() => {
          localStorage.removeItem('pending_usage_logs');
        }).catch(err => console.error('Failed to sync offline usage logs:', err));
      }
    };

    window.addEventListener('online', handleOnline);
    
    // Trigger online check initially
    if (navigator.onLine) {
      handleOnline();
    }

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('online', handleOnline);
      
      // Flush remaining active seconds on unmount
      if (activeSeconds.current > 0 && userRef.current && navigator.onLine) {
        const mode = navigator.onLine ? 'online' : 'offline';
        api.post('/api/user/track', {
          source,
          action,
          duration: activeSeconds.current,
          mode
        }).catch(() => {});
      }
    };
  }, [source, action, user]);
}
