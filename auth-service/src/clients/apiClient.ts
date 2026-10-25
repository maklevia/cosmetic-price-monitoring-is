import { getEnvOrThrow } from "@auth/utils/getEnvOrThrow.js";
import { BadGatewayError, ConflictError } from "@auth/errors/AppError.js";

interface CreateUserProfileInput {
  id: number;
  email: string;
  name: string | null;
}

export async function createUserProfile(
  input: CreateUserProfileInput,
): Promise<void> {
  const baseUrl = getEnvOrThrow("API_INTERNAL_URL");
  const apiKey = getEnvOrThrow("INTERNAL_API_KEY");

  let response: Response;

  try {
    response = await fetch(`${baseUrl}/internal/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": apiKey,
      },
      body: JSON.stringify(input),
    });
  } catch (error) {
    throw new BadGatewayError("Main API is unavailable");
  }

  if (response.ok) {
    return;
  }

  if (response.status === 409) {
    throw new ConflictError("A profile for this user already exists");
  }

  const body = await response.text();
  throw new BadGatewayError(
    `Main API rejected user profile creation (${response.status}): ${body}`,
  );
}
