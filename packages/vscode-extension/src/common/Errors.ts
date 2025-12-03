import { LicenseStatus } from "./License";

export class RestrictedFunctionalityError extends Error {
  constructor(
    message: string,
    public readonly allowedUsers: LicenseStatus[]
  ) {
    super(message);
    this.name = "RestrictedFunctionalityError";
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export const ErrorTypeGetters = {
  Error: Error,
  RestrictedFunctionalityError: RestrictedFunctionalityError,
  TimeoutError: TimeoutError,
} as const;

export type ErrorTypeName = keyof typeof ErrorTypeGetters;

export function ErrorTypeGetter<T extends ErrorTypeName>(
  errorType: T
): (typeof ErrorTypeGetters)[T] {
  return ErrorTypeGetters[errorType] ?? Error;
}
