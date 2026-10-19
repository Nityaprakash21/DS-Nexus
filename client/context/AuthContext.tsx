import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import api from "../src/api/axios";

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<any>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
    const [loading, setLoading] = useState<true | false>(true);

    const refreshSession = async () => {
        const storedToken = localStorage.getItem("token");
        if (!storedToken) {
            setUser(null);
            setToken(null);
            setLoading(false);
            return;
        }

        try {
            const { data } = await api.get("/auth/session");
            setUser(data.User || data.user);
        } catch (error) {
            // Token is invalid, clear it
            localStorage.removeItem("token");
            setUser(null);
            setToken(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshSession();
    }, []);

    const login = async (email: string, password: string, role_type: string) => {
        const { data } = await api.post("/auth/login", { email, password, role_type });
        localStorage.setItem("token", data.token);
        setToken(data.token);
        setUser(data.user);
        return data.user;
    };

    const logout = async () => {
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
    };

    const value = { user, token, loading, login, logout, refreshSession };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}