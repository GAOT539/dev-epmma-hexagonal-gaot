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
  authenticateUser as mockAuthenticateUser,
  changePassword as mockChangePassword,
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
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restaurar usuario desde sessionStorage y validar sesión en backend (/api/v1/auth/me)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUser(JSON.parse(stored));
      }
    } catch {
      // sessionStorage no disponible
    } finally {
      setIsLoading(false);
    }

    // Validación asíncrona en segundo plano con el backend
    fetch("/api/v1/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
        }
      })
      .catch(() => {
        // En caso de desconexión, mantener sesión local
      });
  }, []);

  // Persistir usuario en sessionStorage
  useEffect(() => {
    if (isLoading) return;
    if (user) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [user, isLoading]);

  const login = useCallback(
    (identificador: string, password: string) => {
      // Autenticación síncrona contra API REST (/api/v1/auth/login) para compatibilidad total con Login UI
      try {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/v1/auth/login", false); // Synchronous same-origin call
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.send(JSON.stringify({ identificador, password }));

        if (xhr.status === 200) {
          const res = JSON.parse(xhr.responseText);
          if (res.success && res.user) {
            setUser(res.user);
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(res.user));
            return { success: true, user: res.user };
          }
        } else if (xhr.status >= 400 && xhr.status < 500) {
          try {
            const errRes = JSON.parse(xhr.responseText);
            return { success: false, error: errRes.error || "Credenciales incorrectas." };
          } catch {
            return { success: false, error: "Credenciales incorrectas. Verifique usuario y contraseña." };
          }
        }
      } catch (err) {
        console.warn("Fallo en llamada XHR a /api/v1/auth/login, utilizando respaldo mock:", err);
      }

      // Respaldo resiliente con mock institucional
      const result = mockAuthenticateUser(identificador, password);
      if (result) {
        setUser(result);
        return { success: true, user: result };
      }

      return {
        success: false,
        error: "Credenciales incorrectas. Verifique usuario y contraseña.",
      };
    },
    []
  );

  const logout = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem(STORAGE_KEY);

    // Notificar al backend para limpiar cookie de sesión
    fetch("/api/v1/auth/logout", { method: "POST" }).catch(() => {});
  }, []);

  const changePassword = useCallback(
    (currentPassword: string, newPassword: string) => {
      if (!user) return { success: false, error: "No hay sesión activa." };

      // Llamada síncrona al backend /api/v1/auth/change-password
      try {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/v1/auth/change-password", false);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.send(
          JSON.stringify({
            currentPassword,
            newPassword,
            targetUserId: user.id,
          })
        );

        if (xhr.status === 200) {
          const res = JSON.parse(xhr.responseText);
          if (res.success) {
            const updatedUser = { ...user, mustChangePassword: false };
            setUser(updatedUser);
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
            return { success: true };
          }
        } else if (xhr.status >= 400) {
          try {
            const errRes = JSON.parse(xhr.responseText);
            return { success: false, error: errRes.error || "Error al cambiar contraseña." };
          } catch {
            return { success: false, error: "Error al actualizar contraseña en el servidor." };
          }
        }
      } catch (err) {
        console.warn("Fallo en llamada XHR a /api/v1/auth/change-password, utilizando respaldo mock:", err);
      }

      // Respaldo resiliente
      const mockResult = mockChangePassword(user.id, newPassword);
      if (mockResult.success) {
        const updatedUser = { ...user, mustChangePassword: false };
        setUser(updatedUser);
      }
      return mockResult;
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
