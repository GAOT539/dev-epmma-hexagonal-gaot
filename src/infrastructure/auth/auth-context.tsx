"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Usuario } from "@/domain/models/comerciante.model";
import {
  authenticateUser,
  changePassword as mockChangePassword,
  verifyPassword,
} from "@/infrastructure/mocks/auth.mock";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface AuthContextType {
  user: Usuario | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    identificador: string,
    password: string
  ) => { success: boolean; user?: Usuario; error?: string };
  logout: () => void;
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => { success: boolean; error?: string };
  updateUser: (user: Usuario) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ── Storage keys ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "epmma_auth_user";

// ── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restaurar sesión al montar
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {
      // sessionStorage no disponible o datos corruptos
    }
    setIsLoading(false);
  }, []);

  // Persistir usuario en sessionStorage
  useEffect(() => {
    if (user) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  const login = useCallback(
    (identificador: string, password: string) => {
      const result = authenticateUser(identificador, password);
      if (result) {
        setUser(result);
        return { success: true, user: result };
      }
      return {
        success: false,
        error:
          "Credenciales incorrectas. Verifique usuario y contraseña.",
      };
    },
    []
  );

  const logout = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const changePassword = useCallback(
    (currentPassword: string, newPassword: string) => {
      if (!user) return { success: false, error: "No hay sesión activa." };

      // Skip current password verification for forced first-login changes
      if (!user.mustChangePassword) {
        if (!verifyPassword(user.id, currentPassword)) {
          return { success: false, error: "La contraseña actual es incorrecta." };
        }
      }

      const result = mockChangePassword(user.id, newPassword);
      if (result.success) {
        const updatedUser = { ...user, mustChangePassword: false };
        setUser(updatedUser);
      }
      return result;
    },
    [user]
  );

  const updateUser = useCallback((updatedUser: Usuario) => {
    setUser(updatedUser);
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      changePassword,
      updateUser,
    }),
    [user, isLoading, login, logout, changePassword, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
