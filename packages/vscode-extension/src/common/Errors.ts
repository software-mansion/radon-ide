export class PaywalledFunctionalityError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class AdminRestrictedFunctionalityError extends Error {
  constructor(message: string) {
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
  AdminRestrictedFunctionalityError: AdminRestrictedFunctionalityError,
  Error: Error,
  PaywalledFunctionalityError: PaywalledFunctionalityError,
  TimeoutError: TimeoutError,
} as const;

export type ErrorTypeName = keyof typeof ErrorTypeGetters;

export function ErrorTypeGetter<T extends ErrorTypeName>(
  errorType: T
): (typeof ErrorTypeGetters)[T] {
  return ErrorTypeGetters[errorType] ?? Error;
}
