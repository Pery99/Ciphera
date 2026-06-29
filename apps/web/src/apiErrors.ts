type NestErrorBody = {
  message?: string | string[];
  statusCode?: number;
  error?: string;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function parseNestErrorBody(text: string): NestErrorBody | null {
  try {
    return JSON.parse(text) as NestErrorBody;
  } catch {
    return null;
  }
}

export function messageFromNestBody(body: NestErrorBody | null, fallback: string): string {
  if (!body?.message) return fallback;
  if (Array.isArray(body.message)) return body.message.join(" ");
  return body.message;
}

export function toApiError(status: number, text: string): ApiError {
  const body = parseNestErrorBody(text);
  const fallback = status >= 500 ? "Something went wrong. Please try again." : "Request failed.";
  return new ApiError(messageFromNestBody(body, text.trim() || fallback), status);
}

export function formatAuthError(caught: unknown, mode: "login" | "signup"): string {
  if (caught instanceof ApiError) {
    if (caught.status === 401) {
      return mode === "login"
        ? "We couldn't sign you in. Check your username and password."
        : "Authentication failed. Please try again.";
    }
    if (caught.status === 409 && mode === "signup") {
      return "Couldn't create your account. Try a different username or email.";
    }
    if (caught.status >= 500) {
      return "Something went wrong. Please try again.";
    }
    if (caught.status === 400) {
      return "Please check your details and try again.";
    }
    if (caught.status === 404) {
      return "Unable to reach Ciphera API. Restart the web and API dev servers.";
    }
    if (caught.status === 429) {
      return "Too many attempts. Wait a minute and try again.";
    }
    return mode === "login"
      ? "We couldn't sign you in. Please try again."
      : "We couldn't create your account. Please try again.";
  }

  if (caught instanceof TypeError) {
    return "Unable to reach Ciphera. Check your connection.";
  }

  return mode === "login"
    ? "We couldn't sign you in. Please try again."
    : "We couldn't create your account. Please try again.";
}

export function formatUserError(caught: unknown, fallback: string): string {
  if (caught instanceof ApiError) {
    if (caught.status >= 500) return "Something went wrong. Please try again.";
    if (caught.message && !caught.message.startsWith("{")) return caught.message;
  }
  return fallback;
}