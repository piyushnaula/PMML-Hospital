import { createContext, useState, useContext } from "react";

export const AppContext = createContext();

export function AppProvider({ children }) {
  const [user, setUser] = useState(
    () => JSON.parse(localStorage.getItem("pmml_user")) || null
  );
  const [token, setToken] = useState(
    () => localStorage.getItem("pmml_token") || null
  );

  const login = (userData, jwt) => {
    setUser(userData);
    setToken(jwt);
    localStorage.setItem("pmml_user", JSON.stringify(userData));
    localStorage.setItem("pmml_token", jwt);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("pmml_user");
    localStorage.removeItem("pmml_token");
  };

  return (
    <AppContext.Provider
      value={{ user, token, login, logout, isAuthenticated: !!user }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
