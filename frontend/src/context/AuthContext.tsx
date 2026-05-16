import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import api from "../api/client";

interface User {
  id: string;
  name: string;
  email: string;
  role: "USER" | "MODERATOR" | "ADMIN";
  twoFactorEnabled?: boolean;
  referralCode?: string | null;
  emailVerified?: boolean;
}

interface LoginResult {
  requiresTwoFactor: boolean;
  twoFactorToken?: string;
}

interface RegisterResult {
  message: string;
  verificationPreviewUrl?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  verifyTwoFactorLogin: (twoFactorToken: string, code: string) => Promise<void>;
  register: (name: string, email: string, password: string, ref?: string) => Promise<RegisterResult>;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const res = await api.get("/auth/me");
    setUser(res.data.user);
  };

  useEffect(() => {
    api
      .get("/auth/csrf")
      .catch(() => null)
      .finally(() => {
        refreshUser()
          .catch(() => {
            setUser(null);
          })
          .finally(() => setLoading(false));
      });
  }, []);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    const { data } = await api.post("/auth/login", { email, password });

    if (data.requiresTwoFactor) {
      return {
        requiresTwoFactor: true,
        twoFactorToken: data.twoFactorToken,
      };
    }

    setUser(data.user);
    return { requiresTwoFactor: false };
  };

  const verifyTwoFactorLogin = async (twoFactorToken: string, code: string) => {
    const { data } = await api.post("/auth/login/2fa", { twoFactorToken, code });
    setUser(data.user);
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    ref?: string
  ): Promise<RegisterResult> => {
    const payload: Record<string, string> = { name, email, password };
    if (ref) payload.ref = ref;

    const { data } = await api.post("/auth/register", payload);
    return {
      message:
        data?.message ||
        "Registration successful. Please verify your email address before signing in.",
      verificationPreviewUrl: data?.verificationPreviewUrl,
    };
  };

  const logout = () => {
    api.post("/auth/logout").catch(() => {});
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        verifyTwoFactorLogin,
        register,
        refreshUser,
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
