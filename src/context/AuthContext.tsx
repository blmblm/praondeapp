import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';

export interface DbUser {
  id: number;
  uid: string;
  email: string;
  name?: string | null;
}

interface AuthContextValue {
  user: User | null;
  dbUser: DbUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<User | null>;
  signOutUser: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  // Token mantido exclusivamente em memória (nunca em localStorage/sessionStorage)
  const inMemoryTokenRef = useRef<string | null>(null);

  const syncUserWithBackend = useCallback(async (firebaseUser: User) => {
    try {
      const token = await firebaseUser.getIdToken();
      inMemoryTokenRef.current = token;
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.user) {
          setDbUser(data.user);
        }
      }
    } catch (err) {
      console.warn('[Auth] Falha ao sincronizar sessão com o backend:', err);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await syncUserWithBackend(currentUser);
      } else {
        inMemoryTokenRef.current = null;
        setDbUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [syncUserWithBackend]);

  const signInWithGoogle = useCallback(async (): Promise<User | null> => {
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      if (result.user) {
        await syncUserWithBackend(result.user);
      }
      return result.user;
    } catch (err) {
      console.error('[Auth] Erro ao entrar com Google:', err);
      throw err;
    }
  }, [syncUserWithBackend]);

  const signOutUser = useCallback(async () => {
    try {
      await signOut(auth);
      inMemoryTokenRef.current = null;
      setUser(null);
      setDbUser(null);
    } catch (err) {
      console.error('[Auth] Erro ao sair:', err);
    }
  }, []);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    try {
      const token = await auth.currentUser.getIdToken();
      inMemoryTokenRef.current = token;
      return token;
    } catch {
      return inMemoryTokenRef.current;
    }
  }, []);

  const authFetch = useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
      const token = await getIdToken();
      const headers = new Headers(init.headers);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return fetch(input, { ...init, headers });
    },
    [getIdToken]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        dbUser,
        loading,
        signInWithGoogle,
        signOutUser,
        getIdToken,
        authFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return ctx;
}
