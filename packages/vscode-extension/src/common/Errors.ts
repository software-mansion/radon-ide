import { LicenseStatus } from "./License";

export class RestrictedFunctionalityError extends Error {
  constructor(
    message: string,
    public readonly allowedUsers: LicenseStatus[]
  ) {
    super(message);
    Object.setPrototypeOf(this, RestrictedFunctionalityError.prototype);
    this.name = "RestrictedFunctionalityError";
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, TimeoutError.prototype);
    this.name = "TimeoutError";
  }
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, AuthorizationError.prototype); // TODO: Check why every guide recommends this, does it fix `instanceof`?
    this.name = "AuthorizationError"; // TODO: Check if this is redundant
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
