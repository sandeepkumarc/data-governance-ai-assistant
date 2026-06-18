import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api as liveApi } from "../api/client";
import { offlineApi } from "../api/offlineClient";
import { DEFAULT_CREDENTIALS, DEFAULT_KB_SECTIONS, DEFAULT_USER } from "../data/sampleData";
import { PRODUCT_NAME_OFFLINE } from "../lib/product";

export type Theme = "light" | "dark";

export interface SessionUser {
  email: string;
  name: string;
  role: string;
  avatar: string;
}

interface AppContextValue {
  // Auth
  user: SessionUser | null;
  login: (email: string, password: string) => boolean;
  loginOffline: () => void;
  logout: () => void;
  // Theme
  theme: Theme;
  toggleTheme: () => void;
  // API mode
  offlineMode: boolean;
  setOfflineMode: (v: boolean) => void;
  connected: boolean;
  appName: string;
  kbCount: number;
  apiKey: string;
  setApiKey: (k: string) => void;
  refreshStatus: () => Promise<void>;
  governance: typeof offlineApi;
  usesOfflineData: boolean;
  backendDisconnected: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

const SESSION_KEY = "governance_session";
const THEME_KEY = "governance_theme";
const OFFLINE_KEY = "governance_offline_mode";
const API_KEY_STORAGE = "governance_api_key";

function loadSession(): SessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(loadSession);
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(THEME_KEY) as Theme) || "light",
  );
  const [offlineMode, setOfflineModeState] = useState(
    () => localStorage.getItem(OFFLINE_KEY) === "true",
  );
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem(API_KEY_STORAGE) ?? "",
  );
  const [connected, setConnected] = useState(false);
  const [appName, setAppName] = useState("");
  const [kbCount, setKbCount] = useState(DEFAULT_KB_SECTIONS.length);

  // Only explicit offline mode uses sample data — a failed health check must not
  // swap APIs mid-session (that felt like the page was refreshing).
  const usesOfflineData = offlineMode;
  const backendDisconnected = !offlineMode && !connected;

  const refreshStatus = useCallback(async () => {
    if (offlineMode) {
      setConnected(false);
      setAppName(PRODUCT_NAME_OFFLINE);
      setKbCount(DEFAULT_KB_SECTIONS.length);
      return;
    }
    try {
      const health = await liveApi.health(apiKey || undefined);
      const sections = await liveApi.kbSections(apiKey || undefined);
      setConnected(true);
      setAppName(health.app);
      setKbCount(sections.length);
    } catch {
      setConnected(false);
      setAppName("");
      setKbCount(DEFAULT_KB_SECTIONS.length);
    }
  }, [apiKey, offlineMode]);

  useEffect(() => {
    localStorage.setItem(API_KEY_STORAGE, apiKey);
    const debounceId = window.setTimeout(() => {
      void refreshStatus();
    }, 600);
    const intervalId = window.setInterval(() => {
      void refreshStatus();
    }, 60000);
    return () => {
      window.clearTimeout(debounceId);
      window.clearInterval(intervalId);
    };
  }, [apiKey, refreshStatus]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(OFFLINE_KEY, String(offlineMode));
    refreshStatus();
  }, [offlineMode, refreshStatus]);

  const login = useCallback((email: string, password: string) => {
    const ok =
      email.toLowerCase() === DEFAULT_CREDENTIALS.email &&
      password === DEFAULT_CREDENTIALS.password;
    if (ok) {
      setUser(DEFAULT_USER);
      localStorage.setItem(SESSION_KEY, JSON.stringify(DEFAULT_USER));
    }
    return ok;
  }, []);

  const loginOffline = useCallback(() => {
    setUser(DEFAULT_USER);
    localStorage.setItem(SESSION_KEY, JSON.stringify(DEFAULT_USER));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }, []);

  const setOfflineMode = useCallback((v: boolean) => {
    setOfflineModeState(v);
  }, []);

  const governance = useMemo(() => {
    return (offlineMode ? offlineApi : liveApi) as typeof offlineApi;
  }, [offlineMode]);

  const value = useMemo(
    () => ({
      user,
      login,
      loginOffline,
      logout,
      theme,
      toggleTheme,
      offlineMode,
      setOfflineMode,
      connected,
      appName,
      kbCount,
      apiKey,
      setApiKey,
      refreshStatus,
      governance,
      usesOfflineData,
      backendDisconnected,
    }),
    [
      user,
      login,
      loginOffline,
      logout,
      theme,
      toggleTheme,
      offlineMode,
      setOfflineMode,
      connected,
      appName,
      kbCount,
      apiKey,
      refreshStatus,
      governance,
      usesOfflineData,
      backendDisconnected,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

/** @deprecated use useApp */
export function useApi() {
  return useApp();
}
