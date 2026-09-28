import { createMiddleware } from "@tanstack/react-start";
import { hasOperatorSession } from "./operator-session.server";

export const authMiddleware = createMiddleware({ type: "function" })
  .server(async ({ next }) => {
    const authenticated = await hasOperatorSession();

    if (!authenticated) {
      const { UnauthorizedError } = await import("./verify.server");
      throw new UnauthorizedError();
    }

    return next();
  });