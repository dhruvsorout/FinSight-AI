"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { User } from "@/types";
import api, {
  setTokens,
  clearTokens,
  getAccessToken,
  getRefreshToken,
} from "@/lib/api";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: try to restore session using stored refresh token
  useEffect(() => {
    const stored = getRefreshToken();
    if (stored) {
      api
        .post("/auth/refresh", { refreshToken: stored })
        .then((res) => {
          setTokens(res.data.tokens);
          setUser(res.data.user ?? null);
          // If the refresh endpoint doesn't return user, we can decode JWT or just set empty
        })
        .catch(() => {
          clearTokens();
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    setTokens(res.data.tokens);
    setUser(res.data.user);
  }, []);

  const signup = useCallback(
    async (email: string, password: string, name: string) => {
      const res = await api.post("/auth/signup", { email, password, name });
      setTokens(res.data.tokens);
      setUser(res.data.user);
    },
    []
  );

  const logout = useCallback(async () => {
    const rt = getRefreshToken();
    try {
      if (rt) {
        await api.post("/auth/logout", { refreshToken: rt });
      }
    } finally {
      clearTokens();
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user && !!getAccessToken(),
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
