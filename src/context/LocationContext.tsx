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

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported');
      return;
    }

    setStatus('tracking');

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
      // Execução 100% silenciosa: sem popups, sem alerts, sem travar o aplicativo
      if (error.code === error.PERMISSION_DENIED) {
        setStatus('denied');
      } else {
        console.debug('Aviso silencioso de localização física:', error.message);
      }
    };

    // 1. Obtenção imediata da latitude e longitude física de alta precisão
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 15000,
    });

    // 2. Rastreamento contínuo em segundo plano (atualiza latitude/longitude conforme o usuário se movimenta)
    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 20000,
    });

    return () => {
      if (watchId !== undefined) {
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
    }),
    [coords, status, lastUpdated]
  );

  return <LocationContext.Provider value={contextValue}>{children}</LocationContext.Provider>;
};

export const useUserLocation = () => useContext(LocationContext);
