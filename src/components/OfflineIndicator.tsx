import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 right-4 sm:right-auto z-50 flex items-center gap-2 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-xl border border-amber-300"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>Sem conexão com a internet — exibindo dados em cache.</span>
    </div>
  );
};
