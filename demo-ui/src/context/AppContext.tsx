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
import { demoApi } from "../api/demoClient";
import { DEMO_CREDENTIALS, DEMO_KB_SECTIONS, DEMO_USER } from "../data/demoData";

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
  loginAsDemo: () => void;
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
  governance: typeof demoApi;
  isDemoData: boolean;
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
  const [kbCount, setKbCount] = useState(DEMO_KB_SECTIONS.length);

  const isDemoData = offlineMode || !connected;

  const refreshStatus = useCallback(async () => {
    if (offlineMode) {
      setConnected(false);
      setAppName("Offline demo");
      setKbCount(DEMO_KB_SECTIONS.length);
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
      setKbCount(DEMO_KB_SECTIONS.length);
    }
  }, [apiKey, offlineMode]);

  useEffect(() => {
    localStorage.setItem(API_KEY_STORAGE, apiKey);
    refreshStatus();
    const id = setInterval(refreshStatus, 30000);
    return () => clearInterval(id);
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
      email.toLowerCase() === DEMO_CREDENTIALS.email &&
      password === DEMO_CREDENTIALS.password;
    if (ok) {
      setUser(DEMO_USER);
      localStorage.setItem(SESSION_KEY, JSON.stringify(DEMO_USER));
    }
    return ok;
  }, []);

  const loginAsDemo = useCallback(() => {
    setUser(DEMO_USER);
    localStorage.setItem(SESSION_KEY, JSON.stringify(DEMO_USER));
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
    return (isDemoData ? demoApi : liveApi) as typeof demoApi;
  }, [isDemoData]);

  const value = useMemo(
    () => ({
      user,
      login,
      loginAsDemo,
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
      isDemoData,
    }),
    [
      user,
      login,
      loginAsDemo,
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
      isDemoData,
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
