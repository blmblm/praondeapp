import React, { createContext, useContext, useEffect, useState, useMemo, useRef, useCallback } from 'react';

export interface UserCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface LocationContextType {
  coords: UserCoordinates | null;
  status: 'idle' | 'tracking' | 'granted' | 'denied' | 'unsupported';
  lastUpdated: Date | null;
  getDistanceKmTo: (
    targetLat?: number | string | null,
    targetLon?: number | string | null,
    targetCity?: string | null
  ) => number | null;
  requestLocation: () => void;
  refreshLocation: () => Promise<void>;
  userOriginCity: string;
  setUserOriginCity: (cityName: string) => void;
  userCoords: UserCoordinates | null;
  isUsingRealGps: boolean;
  userLocationLabel: string;
  // Aliases para compatibilidade retroativa
  setUserSelectedCity: (cityName: string | null) => void;
  selectedCityCoords: UserCoordinates | null;
  selectedCityName: string | null;
}

const STORAGE_COORDS_KEY = 'praonde_real_gps_v4';
const STORAGE_USER_ORIGIN_CITY_KEY = 'praonde_user_origin_city';

export function normalizeCityKey(str?: string | null): string {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Coordenadas das principais cidades brasileiras para referência de geolocalização e cálculo Haversine
export const BRAZIL_CITY_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
  'praia grande': { latitude: -24.0058, longitude: -46.4029 },
  'santos': { latitude: -23.9608, longitude: -46.3336 },
  'sao vicente': { latitude: -23.9631, longitude: -46.3919 },
  'guaruja': { latitude: -23.9931, longitude: -46.2564 },
  'cubatao': { latitude: -23.8950, longitude: -46.4253 },
  'bertioga': { latitude: -23.8544, longitude: -46.1383 },
  'mongagua': { latitude: -24.0931, longitude: -46.6208 },
  'itanhaem': { latitude: -24.1831, longitude: -46.7889 },
  'peruibe': { latitude: -24.3200, longitude: -46.9983 },
  'santo andre': { latitude: -23.6575, longitude: -46.5312 },
  'sao bernardo do campo': { latitude: -23.6944, longitude: -46.5654 },
  'sao caetano do sul': { latitude: -23.6229, longitude: -46.5547 },
  'diadema': { latitude: -23.6865, longitude: -46.6234 },
  'maua': { latitude: -23.6687, longitude: -46.4614 },
  'ribeirao pires': { latitude: -23.7142, longitude: -46.4137 },
  'sao paulo': { latitude: -23.5505, longitude: -46.6333 },
  'campinas': { latitude: -22.9099, longitude: -47.0626 },
  'osasco': { latitude: -23.5329, longitude: -46.7919 },
  'guarulhos': { latitude: -23.4542, longitude: -46.5333 },
  'barueri': { latitude: -23.5111, longitude: -46.8764 },
  'cotia': { latitude: -23.6036, longitude: -46.9189 },
  'mogi das cruzes': { latitude: -23.5208, longitude: -46.1854 },
  'sorocaba': { latitude: -23.5015, longitude: -47.4526 },
  'ribeirao preto': { latitude: -21.1704, longitude: -47.8103 },
  'bauru': { latitude: -22.3147, longitude: -49.0606 },
  'carapicuiba': { latitude: -23.5222, longitude: -46.8356 },
  'franca': { latitude: -20.5386, longitude: -47.4008 },
  'itaquaquecetuba': { latitude: -23.4861, longitude: -46.3483 },
  'jundiai': { latitude: -23.1857, longitude: -46.8978 },
  'piracicaba': { latitude: -22.7338, longitude: -47.6476 },
  'sao jose dos campos': { latitude: -23.2237, longitude: -45.9009 },
  'sao jose do rio preto': { latitude: -20.8114, longitude: -49.3758 },
  'ubatuba': { latitude: -23.4338, longitude: -45.0838 },
  'limeira': { latitude: -22.5644, longitude: -47.4017 },
  'mairipora': { latitude: -23.3186, longitude: -46.5867 },
  'ourinhos': { latitude: -22.9789, longitude: -49.8706 },
  'pindamonhangaba': { latitude: -22.9242, longitude: -45.4614 },
  'rio de janeiro': { latitude: -22.9068, longitude: -43.1729 },
  'belo horizonte': { latitude: -19.9167, longitude: -43.9345 },
  'curitiba': { latitude: -25.4284, longitude: -49.2733 },
  'porto alegre': { latitude: -30.0346, longitude: -51.2177 },
  'salvador': { latitude: -12.9777, longitude: -38.5016 },
  'recife': { latitude: -8.0476, longitude: -34.8770 },
  'fortaleza': { latitude: -3.7172, longitude: -38.5433 },
  'brasilia': { latitude: -15.7975, longitude: -47.8919 },
};

export const CITY_DISPLAY_NAMES: Record<string, string> = {
  'praia grande': 'Praia Grande',
  'santos': 'Santos',
  'sao vicente': 'São Vicente',
  'guaruja': 'Guarujá',
  'cubatao': 'Cubatão',
  'bertioga': 'Bertioga',
  'mongagua': 'Mongaguá',
  'itanhaem': 'Itanhaém',
  'peruibe': 'Peruíbe',
  'santo andre': 'Santo André',
  'sao bernardo do campo': 'São Bernardo do Campo',
  'sao caetano do sul': 'São Caetano do Sul',
  'diadema': 'Diadema',
  'maua': 'Mauá',
  'ribeirao pires': 'Ribeirão Pires',
  'sao paulo': 'São Paulo',
  'campinas': 'Campinas',
  'osasco': 'Osasco',
  'guarulhos': 'Guarulhos',
  'barueri': 'Barueri',
  'cotia': 'Cotia',
  'mogi das cruzes': 'Mogi das Cruzes',
  'sorocaba': 'Sorocaba',
  'ribeirao preto': 'Ribeirão Preto',
  'bauru': 'Bauru',
  'carapicuiba': 'Carapicuíba',
  'franca': 'Franca',
  'itaquaquecetuba': 'Itaquaquecetuba',
  'jundiai': 'Jundiaí',
  'piracicaba': 'Piracicaba',
  'sao jose dos campos': 'São José dos Campos',
  'sao jose do rio preto': 'São José do Rio Preto',
  'ubatuba': 'Ubatuba',
  'limeira': 'Limeira',
  'mairipora': 'Mairiporã',
  'ourinhos': 'Ourinhos',
  'pindamonhangaba': 'Pindamonhangaba',
  'rio de janeiro': 'Rio de Janeiro',
  'belo horizonte': 'Belo Horizonte',
  'curitiba': 'Curitiba',
  'porto alegre': 'Porto Alegre',
  'salvador': 'Salvador',
  'recife': 'Recife',
  'fortaleza': 'Fortaleza',
  'brasilia': 'Brasília',
};

// Detecta automaticamente a cidade mais próxima das coordenadas atuais do usuário (Reverse Geocoding Geodésico)
export function detectClosestCity(lat: number, lon: number): string {
  let closestKey = 'sao paulo';
  let minDistance = Infinity;

  for (const [key, val] of Object.entries(BRAZIL_CITY_COORDINATES)) {
    const dist = calculateDistanceKm(lat, lon, val.latitude, val.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      closestKey = key;
    }
  }

  return CITY_DISPLAY_NAMES[closestKey] || closestKey;
}

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
  refreshLocation: async () => {},
  userOriginCity: 'Praia Grande',
  setUserOriginCity: () => {},
  userCoords: { latitude: -24.0058, longitude: -46.4029 },
  isUsingRealGps: false,
  userLocationLabel: 'Praia Grande',
  setUserSelectedCity: () => {},
  selectedCityCoords: null,
  selectedCityName: null,
});

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Purga chaves legadas e mockadas ao iniciar, resetando cache antigo de São Paulo para Praia Grande
  useEffect(() => {
    try {
      localStorage.removeItem('praonde_last_user_coords');
      localStorage.removeItem('praonde_user_coords');
      localStorage.removeItem('praonde_user_coords_v2');
      localStorage.removeItem('praonde_user_coords_v3');

      const isManual = localStorage.getItem('praonde_user_is_manual_origin') === 'true';
      const savedCity = localStorage.getItem(STORAGE_USER_ORIGIN_CITY_KEY);
      
      // Se não houver seleção manual explícita ou se for o antigo default São Paulo, reseta para Praia Grande
      if (!isManual || !savedCity || savedCity.trim().toLowerCase() === 'sao paulo') {
        localStorage.setItem(STORAGE_USER_ORIGIN_CITY_KEY, 'Praia Grande');
        localStorage.setItem(
          STORAGE_COORDS_KEY,
          JSON.stringify({ latitude: -24.0058, longitude: -46.4029, timestamp: Date.now() })
        );
        setUserOriginCityState('Praia Grande');
        setCoords({ latitude: -24.0058, longitude: -46.4029 });
      }
    } catch {}
  }, []);

  const watchIdRef = useRef<number | null>(null);

  // Cidade de origem do usuário ("Onde EU estou", padrão Praia Grande se não especificado)
  const [userOriginCity, setUserOriginCityState] = useState<string>(() => {
    try {
      const isManual = localStorage.getItem('praonde_user_is_manual_origin') === 'true';
      const saved = localStorage.getItem(STORAGE_USER_ORIGIN_CITY_KEY);
      if (saved && typeof saved === 'string' && saved.trim()) {
        if (!isManual && saved.trim().toLowerCase() === 'sao paulo') {
          return 'Praia Grande';
        }
        return saved.trim();
      }
    } catch {}
    return 'Praia Grande';
  });

  const setUserOriginCity = (cityName: string) => {
    if (!cityName || !cityName.trim()) return;
    const clean = cityName.trim();
    setUserOriginCityState(clean);

    // Sincroniza imediatamente as coordenadas da cidade escolhida
    const norm = normalizeCityKey(clean);
    const found = BRAZIL_CITY_COORDINATES[norm];
    if (found) {
      const newCoords: UserCoordinates = { latitude: found.latitude, longitude: found.longitude };
      setCoords(newCoords);
      try {
        localStorage.setItem(STORAGE_COORDS_KEY, JSON.stringify({ ...newCoords, timestamp: Date.now() }));
      } catch {}
    }

    try {
      localStorage.setItem(STORAGE_USER_ORIGIN_CITY_KEY, clean);
      localStorage.setItem('praonde_user_is_manual_origin', 'true');
    } catch {}
  };

  // Coordenadas da cidade de origem do usuário
  const userOriginCoords = useMemo<UserCoordinates>(() => {
    const norm = normalizeCityKey(userOriginCity);
    const found = BRAZIL_CITY_COORDINATES[norm];
    if (found) {
      return { latitude: found.latitude, longitude: found.longitude };
    }
    // Fallback padrão seguro: Praia Grande
    return { latitude: -24.0058, longitude: -46.4029 };
  }, [userOriginCity]);

  // Inicializa com as últimas coordenadas reais salvas em cache se existirem e forem válidas (máximo 60 minutos)
  const [coords, setCoords] = useState<UserCoordinates | null>(() => {
    try {
      const isManual = localStorage.getItem('praonde_user_is_manual_origin') === 'true';
      const saved = localStorage.getItem(STORAGE_COORDS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const lat = parseFloat(String(parsed?.latitude));
        const lng = parseFloat(String(parsed?.longitude));

        if (!isNaN(lat) && !isNaN(lng)) {
          // Se for a coordenada antiga de São Paulo e não for manual, força Praia Grande
          const isSpCenter = Math.abs(lat - (-23.5505)) < 0.05 && Math.abs(lng - (-46.6333)) < 0.05;
          if (isSpCenter && !isManual) {
            return { latitude: -24.0058, longitude: -46.4029 };
          }
          return { latitude: lat, longitude: lng, accuracy: parsed.accuracy };
        }
      }
    } catch {
      // ignore
    }
    return { latitude: -24.0058, longitude: -46.4029 };
  });

  const [status, setStatus] = useState<'idle' | 'tracking' | 'granted' | 'denied' | 'unsupported'>(() => {
    try {
      const consent = localStorage.getItem('praonde_location_consent_v2');
      if (consent === 'granted') return 'granted';
      if (consent === 'denied') return 'denied';
    } catch {}
    return 'idle';
  });

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const cityCoord = useMemo(() => {
    const norm = normalizeCityKey(userOriginCity);
    return BRAZIL_CITY_COORDINATES[norm] || null;
  }, [userOriginCity]);

  // Coordenadas ativas do usuário: GPS real se concedido e presente dentro da região da cidade do usuário
  const isUsingRealGps = Boolean(
    status === 'granted' &&
    coords &&
    (!cityCoord || calculateDistanceKm(coords.latitude, coords.longitude, cityCoord.latitude, cityCoord.longitude) <= 25)
  );

  const userCoords = useMemo<UserCoordinates>(() => {
    if (status === 'granted' && coords) {
      if (cityCoord) {
        // Se o GPS/cache estiver a mais de 25km da cidade selecionada (ex: antena celular em São Paulo vs usuário em Praia Grande),
        // NUNCA use a coordenada errada da outra cidade! Retorna a coordenada exata de Praia Grande!
        const distToCity = calculateDistanceKm(coords.latitude, coords.longitude, cityCoord.latitude, cityCoord.longitude);
        if (distToCity > 25) {
          return { latitude: cityCoord.latitude, longitude: cityCoord.longitude };
        }
      }
      return coords;
    }

    if (cityCoord) {
      return { latitude: cityCoord.latitude, longitude: cityCoord.longitude };
    }
    return userOriginCoords;
  }, [status, coords, cityCoord, userOriginCoords]);

  const userLocationLabel = useMemo<string>(() => {
    if (isUsingRealGps && coords) {
      return `GPS Ativo (${userOriginCity})`;
    }
    return userOriginCity;
  }, [isUsingRealGps, coords, userOriginCity]);

  const handleSuccess = useCallback((pos: GeolocationPosition) => {
    const newCoords: UserCoordinates = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    };

    setCoords((prev) => {
      if (prev) {
        // Se a diferença de posição for menor que 500 metros, ignora a oscilação natural do GPS do celular (jitter).
        // Isso impede que a tela fique mudando, reordenando ou piscando eventos sozinha no celular!
        const distKm = calculateDistanceKm(prev.latitude, prev.longitude, newCoords.latitude, newCoords.longitude);
        if (distKm < 0.5) {
          return prev;
        }
      }

      // Detecção de cidade somente quando houver deslocamento real significativo (> 500 metros)
      const isManual = typeof window !== 'undefined' && localStorage.getItem('praonde_user_is_manual_origin') === 'true';
      if (!isManual || (pos.coords.accuracy && pos.coords.accuracy < 5000)) {
        const detectedCity = detectClosestCity(newCoords.latitude, newCoords.longitude);
        if (detectedCity) {
          setUserOriginCityState((currCity) => (currCity === detectedCity ? currCity : detectedCity));
          try {
            localStorage.setItem(STORAGE_USER_ORIGIN_CITY_KEY, detectedCity);
          } catch {}
        }
      }

      try {
        localStorage.setItem(STORAGE_COORDS_KEY, JSON.stringify({ ...newCoords, timestamp: Date.now() }));
        localStorage.setItem('praonde_location_consent_v2', 'granted');
      } catch {}

      return newCoords;
    });

    setStatus('granted');
    setLastUpdated(new Date());
  }, []);

  const handleError = useCallback((error: GeolocationPositionError) => {
    console.warn('[GPS] Não foi possível obter geolocalização física precisa:', error.message);
    if (error.code === error.PERMISSION_DENIED) {
      setStatus('denied');
    } else {
      setStatus((prev) => (coords ? 'granted' : 'idle'));
    }
  }, [coords]);

  // Executa a chamada do navegador para obter o GPS em tempo real e registrar atualizações contínuas
  const executeGeolocation = useCallback((forceFresh: boolean = false) => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setStatus('unsupported');
      return;
    }
    setStatus('tracking');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handleSuccess(pos);
      },
      (err) => {
        console.warn('[GPS] Tentativa com alta precisão falhou, tentando modo balanceado/rede:', err.message);
        navigator.geolocation.getCurrentPosition(
          handleSuccess,
          (err2) => {
            console.warn('[GPS] Tentativa modo balanceado status:', err2.message);
            if (err2.code === err2.PERMISSION_DENIED) {
              setStatus('denied');
            } else {
              setStatus((prev) => (coords ? 'granted' : 'idle'));
            }
          },
          { enableHighAccuracy: false, maximumAge: forceFresh ? 0 : 30000, timeout: 8000 }
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: forceFresh ? 0 : 5000,
        timeout: 6000,
      }
    );

    // Continuous watchPosition para capturar deslocamentos reais (ex: viagem de carro/ônibus/metrô)
    if ('watchPosition' in navigator.geolocation) {
      if (watchIdRef.current !== null) {
        try {
          navigator.geolocation.clearWatch(watchIdRef.current);
        } catch {}
      }
      try {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            handleSuccess(pos);
          },
          (watchErr) => {
            console.warn('[GPS] WatchPosition status:', watchErr.message);
          },
          {
            enableHighAccuracy: true,
            maximumAge: 10000,
            timeout: 15000,
          }
        );
      } catch (e) {
        console.warn('[GPS] Falha ao iniciar watchPosition:', e);
      }
    }
  }, [handleSuccess, coords]);

  // Força atualização imediata da localização (limpando qualquer cache antigo)
  const refreshLocation = useCallback(async (): Promise<void> => {
    try {
      localStorage.removeItem(STORAGE_COORDS_KEY);
    } catch {}
    return new Promise<void>((resolve) => {
      if (typeof window === 'undefined' || !('geolocation' in navigator)) {
        setStatus('unsupported');
        resolve();
        return;
      }
      setStatus('tracking');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          handleSuccess(pos);
          resolve();
        },
        (err) => {
          console.warn('[GPS] Refresh com alta precisão falhou, tentando modo balanceado:', err.message);
          navigator.geolocation.getCurrentPosition(
            (pos2) => {
              handleSuccess(pos2);
              resolve();
            },
            (err2) => {
              handleError(err2);
              resolve();
            },
            { enableHighAccuracy: false, maximumAge: 0, timeout: 10000 }
          );
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    });
  }, [handleSuccess, handleError]);

  // Solicita localização com autorização automática sem exibir modal de permissão
  const requestLocation = useCallback(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setStatus('unsupported');
      return;
    }

    try {
      localStorage.setItem('praonde_location_consent_v2', 'granted');
    } catch {}

    executeGeolocation(true);
  }, [executeGeolocation]);

  // Atualização automática ao retornar ao aplicativo (mudança de foco / visibilidade)
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        const consent = localStorage.getItem('praonde_location_consent_v2');
        if (consent === 'granted') {
          // Re-executa GPS limpo para detectar nova localização quando o usuário retorna ao app
          executeGeolocation(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        try {
          navigator.geolocation.clearWatch(watchIdRef.current);
        } catch {}
        watchIdRef.current = null;
      }
    };
  }, [executeGeolocation]);

  // Fallback rápido via detecção de IP se o GPS do navegador ainda não tiver respondido
  useEffect(() => {
    let active = true;
    const detectIpLocation = async () => {
      if (coords || status === 'granted') return;
      try {
        let signal: AbortSignal | undefined = undefined;
        let timer: any = null;
        if (typeof AbortController !== 'undefined') {
          const controller = new AbortController();
          signal = controller.signal;
          timer = setTimeout(() => {
            try {
              controller.abort();
            } catch {}
          }, 3500);
        }

        const res = await fetch('https://ipwho.is/', { signal });
        if (timer) clearTimeout(timer);

        if (res.ok && active) {
          const data = await res.json();
          if (data && data.success && data.country_code === 'BR' && data.latitude && data.longitude) {
            const isManual = typeof window !== 'undefined' && localStorage.getItem('praonde_user_is_manual_origin') === 'true';
            if (!isManual) {
              const detected = detectClosestCity(data.latitude, data.longitude);
              if (detected && active) {
                // Apenas preenche se o usuário ainda não tiver nenhuma cidade salva em cache
                setUserOriginCityState((prev) => {
                  const currentSaved = localStorage.getItem(STORAGE_USER_ORIGIN_CITY_KEY);
                  if (!currentSaved) {
                    try {
                      localStorage.setItem(STORAGE_USER_ORIGIN_CITY_KEY, detected);
                    } catch {}
                    return detected;
                  }
                  return prev;
                });
              }
            }
          }
        }
      } catch {
        // Silencioso se bloqueado por rede
      }
    };

    detectIpLocation();
    return () => {
      active = false;
    };
  }, [coords, status]);

  // Inicialização de localização: NUNCA força o popup/solicitação de permissão do navegador ao abrir
  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setStatus('unsupported');
      return;
    }

    try {
      localStorage.setItem('praonde_location_consent_v2', 'granted');
    } catch {}

    // Apenas busca o GPS automaticamente se o navegador já tiver a permissão concedida sem perguntar
    if ('permissions' in navigator) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((perm) => {
          if (perm.state === 'granted') {
            executeGeolocation(true);
          } else {
            // Se for 'prompt', NÃO dispara o navegador para evitar qualquer popup ou confirmação na tela
            // A detecção silenciosa por IP ou cidade padrão assume de forma 100% invisível
            setStatus('idle');
          }
          perm.onchange = () => {
            if (perm.state === 'granted') {
              executeGeolocation(true);
            }
          };
        })
        .catch(() => {
          setStatus('idle');
        });
    } else {
      setStatus('idle');
    }
  }, [executeGeolocation]);

  // Cálculo da distância exata entre o usuário ("EU") e as coordenadas do evento consultado
  const getDistanceKmTo = useCallback((
    targetLat?: number | string | null,
    targetLon?: number | string | null,
    targetCity?: string | null
  ): number | null => {
    if (!userCoords) return null;

    let latNum = targetLat !== undefined && targetLat !== null ? (typeof targetLat === 'string' ? parseFloat(targetLat) : targetLat) : NaN;
    let lonNum = targetLon !== undefined && targetLon !== null ? (typeof targetLon === 'string' ? parseFloat(targetLon) : targetLon) : NaN;

    // Se o evento não possuir coordenadas exatas gravadas, busca a cidade do evento como fallback seguro
    if ((isNaN(latNum) || isNaN(lonNum)) && targetCity) {
      const normCity = normalizeCityKey(targetCity);
      const cityCoord = BRAZIL_CITY_COORDINATES[normCity];
      if (cityCoord) {
        latNum = cityCoord.latitude;
        lonNum = cityCoord.longitude;
      }
    }

    if (isNaN(latNum) || isNaN(lonNum)) return null;
    return calculateDistanceKm(userCoords.latitude, userCoords.longitude, latNum, lonNum);
  }, [userCoords]);

  const contextValue = useMemo(
    () => ({
      coords,
      status,
      lastUpdated,
      getDistanceKmTo,
      requestLocation,
      refreshLocation,
      userOriginCity,
      setUserOriginCity,
      userCoords,
      isUsingRealGps,
      userLocationLabel,
      // Aliases para compatibilidade retroativa
      setUserSelectedCity: (cityName: string | null) => {
        if (cityName) setUserOriginCity(cityName);
      },
      selectedCityCoords: userCoords,
      selectedCityName: userOriginCity,
    }),
    [coords, status, lastUpdated, userOriginCity, userCoords, isUsingRealGps, userLocationLabel, refreshLocation, requestLocation, getDistanceKmTo]
  );

  return (
    <LocationContext.Provider value={contextValue}>
      {children}
    </LocationContext.Provider>
  );
};

export const useUserLocation = () => useContext(LocationContext);
