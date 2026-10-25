import { authApi } from "@fe/config/api";
import { useState, useCallback } from "react";
import { isAxiosError } from "axios";
import { useAuth } from "@fe/modules/auth/hooks/useAuth";

interface HookInput {
  onSuccess: () => void;
}
interface HookOutput {
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  errorMessage: string;
  clearErrors: () => void;
}
export const useLogin = (options: HookInput): HookOutput => {
  const { onSuccess } = options;
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { reloadUser } = useAuth();

  const clearErrors = useCallback(() => setErrorMessage(""), []);

  const login = useCallback(async (email: string, password: string) => {
    setErrorMessage("");
    try {
      setIsLoading(true);
      await authApi.post("/login", {
        email,
        enteredPassword: password,
      });

      await reloadUser();
      onSuccess();
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        setErrorMessage("Email or password are not correct!");
      }
    } finally {
      setIsLoading(false);
    }
  }, [onSuccess, reloadUser]);

  return { isLoading, login, errorMessage, clearErrors };
};
