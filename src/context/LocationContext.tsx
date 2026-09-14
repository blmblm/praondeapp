import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

export interface UserCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface LocationContextType {
  coords: UserCoordinates | null;
  status: 'idle' | 'tracking' | 'granted' | 'denied' | 'unsupported';
  lastUpdated: Date | null;
  getDistanceKmTo: (targetLat?: number | string, targetLon?: number | string) => number | null;
  requestLocation: () => void;
}

const STORAGE_COORDS_KEY = 'praonde_last_user_coords';

// Haversine formula para distância precisa em quilômetros
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Raio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Number(d.toFixed(1));
}

const LocationContext = createContext<LocationContextType>({
  coords: null,
  status: 'idle',
  lastUpdated: null,
  getDistanceKmTo: () => null,
  requestLocation: () => {},
});

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Inicializa já com as últimas coordenadas salvas em cache local para resposta instantânea
  const [coords, setCoords] = useState<UserCoordinates | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_COORDS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.latitude === 'number' && typeof parsed?.longitude === 'number') {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    // Coordenadas padrão da Grande São Paulo / ABC enquanto detecta o GPS físico
    return {
      latitude: -23.6575,
      longitude: -46.5312,
    };
  });

  const [status, setStatus] = useState<'idle' | 'tracking' | 'granted' | 'denied' | 'unsupported'>('idle');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const handleSuccess = (pos: GeolocationPosition) => {
    const newCoords: UserCoordinates = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    };

    setCoords(newCoords);
    setStatus('granted');
    setLastUpdated(new Date());

    try {
      localStorage.setItem(STORAGE_COORDS_KEY, JSON.stringify(newCoords));
    } catch {
      // ignore
    }
  };

  const handleError = (error: GeolocationPositionError) => {
    if (error.code === error.PERMISSION_DENIED) {
      setStatus('denied');
    } else {
      console.debug('Aviso silencioso de localização:', error.message);
    }
  };

  const requestLocation = () => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setStatus('unsupported');
      return;
    }
    setStatus('tracking');
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 15000,
    });
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setStatus('unsupported');
      return;
    }

    let watchId: number | undefined;

    // Se a API de Permissions for suportada, checamos se o usuário já havia autorizado previamente
    // Se 'granted', ativa o rastreamento em segundo plano de forma 100% silenciosa e automática (sem abrir popup)
    if ('permissions' in navigator && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((perm) => {
          if (perm.state === 'granted') {
            setStatus('tracking');
            navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
              enableHighAccuracy: true,
              maximumAge: 10000,
              timeout: 15000,
            });
            watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
              enableHighAccuracy: false,
              maximumAge: 5000,
              timeout: 20000,
            });
          } else {
            setStatus(perm.state === 'denied' ? 'denied' : 'idle');
          }

          perm.onchange = () => {
            if (perm.state === 'granted') {
              setStatus('tracking');
              navigator.geolocation.getCurrentPosition(handleSuccess, handleError);
            } else if (perm.state === 'denied') {
              setStatus('denied');
            }
          };
        })
        .catch(() => {
          // Não abre popup de permissão automaticamente no carregamento da página
          setStatus('idle');
        });
    } else {
      // Navegador antigo ou sem API de permissões: não interrompe a abertura do app
      setStatus('idle');
    }

    return () => {
      if (watchId !== undefined && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  const getDistanceKmTo = (targetLat?: number | string, targetLon?: number | string): number | null => {
    if (!coords || targetLat === undefined || targetLon === undefined) return null;
    const latNum = typeof targetLat === 'string' ? parseFloat(targetLat) : targetLat;
    const lonNum = typeof targetLon === 'string' ? parseFloat(targetLon) : targetLon;
    if (isNaN(latNum) || isNaN(lonNum)) return null;
    return calculateDistanceKm(coords.latitude, coords.longitude, latNum, lonNum);
  };

  const contextValue = useMemo(
    () => ({
      coords,
      status,
      lastUpdated,
      getDistanceKmTo,
      requestLocation,
    }),
    [coords, status, lastUpdated]
  );

  return <LocationContext.Provider value={contextValue}>{children}</LocationContext.Provider>;
};

export const useUserLocation = () => useContext(LocationContext);
