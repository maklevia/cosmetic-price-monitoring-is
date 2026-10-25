import { authApi } from "@fe/config/api";
import { useState } from "react";
import { useAuth } from "./useAuth";

export function useLogout() {
  const [isLoading, setIsLoading] = useState(false);
  const { reloadUser } = useAuth();

  const logout = async () => {
    setIsLoading(true);
    
    try {
      await authApi.post('/logout');
      await reloadUser();
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return { logout, isLoading };
}
