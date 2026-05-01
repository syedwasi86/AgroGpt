import { useEffect, useRef, useState } from 'react';

export type ConnectivityStatus = 'online' | 'local-only' | 'offline';

/**
 * useConnectivity hook
 * 1. navigator.onLine as base state.
 * 2. Adds a "Relaxed Probe" to high-availability endpoint.
 * 3. 3-second "Grace Period" (3 consecutive failed probes) before switching to Offline.
 * 4. Distinguishes 'online', 'local-only' (internet works but Gemini fails), and 'offline'.
 */
export function useConnectivity(geminiProbe?: () => Promise<boolean>) {
  const [status, setStatus] = useState<ConnectivityStatus>('online');
  const consecutiveFailures = useRef(0);
  const probeInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  async function relaxedProbe() {
    try {
      // Use a lightweight, high-availability endpoint (like Google's favicon)
      // rather than the heavy Gemini API which might have strict CORS/VPN blocks.
      // mode: 'no-cors' allows us to fetch without CORS issues, even if we can't read the body.
      await fetch('https://www.google.com/favicon.ico', { 
        mode: 'no-cors', 
        cache: 'no-store',
        signal: AbortSignal.timeout(2000)
      });
      return true;
    } catch {
      return false;
    }
  }

  const performCheck = async () => {
    const isAdapterOnline = navigator.onLine;
    
    if (!isAdapterOnline) {
      // If hardware/adapter is off, we are definitely offline.
      consecutiveFailures.current = 3; 
      setStatus('offline');
      return;
    }

    const hasInternet = await relaxedProbe();
    
    if (hasInternet) {
      consecutiveFailures.current = 0;
      
      // If internet works, check if Gemini is reachable
      if (geminiProbe) {
        const isGeminiUp = await geminiProbe();
        setStatus(isGeminiUp ? 'online' : 'local-only');
      } else {
        setStatus('online');
      }
    } else {
      consecutiveFailures.current++;
      // Only switch to offline after 3 consecutive failures
      if (consecutiveFailures.current >= 3) {
        setStatus('offline');
      }
    }
  };

  useEffect(() => {
    // Initial check
    performCheck();

    // Check frequently (every 1.5s) to satisfy the 3s grace period requirement
    // while keeping overhead low.
    probeInterval.current = setInterval(performCheck, 1500);

    const handleOnline = () => {
      consecutiveFailures.current = 0;
      performCheck();
    };
    
    const handleOffline = () => {
      consecutiveFailures.current = 3;
      setStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (probeInterval.current) clearInterval(probeInterval.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geminiProbe]);

  return status;
}
