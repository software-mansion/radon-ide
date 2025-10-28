import { LicenseStatus } from "./License";

export class RestrictedFunctionalityError extends Error {
  constructor(
    message: string,
    public readonly allowedUsers: LicenseStatus[]
  ) {
    super(message);
  }
}

export const ErrorTypeGetters = {
  Error: Error,
  RestrictedFunctionalityError: RestrictedFunctionalityError,
} as const;

export type ErrorTypeName = keyof typeof ErrorTypeGetters;

export function ErrorTypeGetter<T extends ErrorTypeName>(
  errorType: T
): (typeof ErrorTypeGetters)[T] {
  return ErrorTypeGetters[errorType] ?? Error;
}
