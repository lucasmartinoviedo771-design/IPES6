import { isAxiosError } from "axios";
import { AppError } from "@/api/client";

const tryString = (input: unknown): string | null => {
  if (!input) return null;
  if (typeof input === "string") {
    const trimmed = input.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof input === "object") {
    const maybe = input as { message?: unknown; detail?: unknown; error?: unknown };
    return tryString(maybe.message) ?? tryString(maybe.detail) ?? tryString(maybe.error);
  }
  return null;
};

const extractFromObject = (data: Record<string, unknown>): string | null => {
  for (const value of Object.values(data)) {
    const found = tryString(value);
    if (found) return found;
  }
  return null;
};

export const getErrorMessage = (error: unknown, fallback = "Ocurrió un error inesperado.") => {
  if (error instanceof AppError) {
    return error.message;
  }
  if (isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string") {
      const trimmed = data.trim();
      if (trimmed) return trimmed;
    } else if (data && typeof data === "object") {
      const direct = tryString(data);
      if (direct) return direct;
      const nested = extractFromObject(data as Record<string, unknown>);
      if (nested) return nested;
    }
    if (error.message) {
      return error.message;
    }
  } else if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};
