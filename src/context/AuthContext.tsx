import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

export interface UserInfo {
  id?: string;
  email?: string;
  username?: string;
  role?: string;
  [key: string]: any;
}

interface AuthContextType {
  token: string | null;
  user: UserInfo | null;
  isLoading: boolean;
  login: (token: string, user: UserInfo) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  user: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadStoredAuth = async () => {
      try {
        const storedToken = await AsyncStorage.getItem("token");
        const storedUser = await AsyncStorage.getItem("user");
        if (storedToken) {
          setToken(storedToken);
        }
        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser));
          } catch {
            setUser({ username: storedUser });
          }
        }
      } catch (e) {
        console.error("Error loading auth from storage:", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadStoredAuth();
  }, []);

  const login = async (newToken: string, newUser: UserInfo) => {
    try {
      await AsyncStorage.setItem("token", newToken);
      await AsyncStorage.setItem("user", JSON.stringify(newUser));
      setToken(newToken);
      setUser(newUser);
    } catch (e) {
      console.error("Error saving auth to storage:", e);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.multiRemove(["token", "user"]);
    } catch {
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("user");
    }
    setToken(null);
    setUser(null);
    router.replace("/login" as any);
  };

  return (
    <AuthContext.Provider value={{ token, user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
