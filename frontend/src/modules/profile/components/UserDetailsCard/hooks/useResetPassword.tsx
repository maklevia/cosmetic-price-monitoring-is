import { useState } from "react";
import { authApi } from "@fe/config/api";
import axios from "axios";

export function useResetPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetPassword = async (oldPassword: string, newPassword: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await authApi.patch('/resetPassword', { oldPassword, newPassword });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.message || "Failed to reset password");
      } else {
        setError("Something went wrong. Please try again later.");
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { resetPassword, isLoading, error };
}
