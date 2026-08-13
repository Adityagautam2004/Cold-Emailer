import { logger } from "@dispatch/config";
import { NextResponse } from "next/server";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "Sign in to continue.") {
    super(401, message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "You don't have access to this.") {
    super(403, message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Not found.") {
    super(404, message);
  }
}

export class ValidationError extends HttpError {
  constructor(
    message: string,
    public details?: unknown
  ) {
    super(400, message);
  }
}

/** Wraps a route handler so every thrown HttpError (and requireUser()'s UnauthorizedError) becomes the right status code, uniformly, without every route re-implementing try/catch. */
export function apiRoute<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof HttpError) {
        const body: Record<string, unknown> = { error: err.message };
        if (err instanceof ValidationError && err.details) body.details = err.details;
        return NextResponse.json(body, { status: err.status });
      }
      logger.error({ err }, "unhandled API error");
      return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
    }
  };
}
