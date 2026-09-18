import { Router } from 'express';

/**
 * Express 4 does not automatically forward rejected promises from async route
 * handlers to the error middleware. This router wraps every registered handler
 * so validation/database errors become normal HTTP responses instead of
 * terminating the API process.
 */
const wrap = handler => {
  if (typeof handler !== 'function') return handler;
  return function wrappedHandler(req, res, next) {
    try {
      const result = handler.call(this, req, res, next);
      if (result && typeof result.then === 'function') result.catch(next);
      return result;
    } catch (error) {
      next(error);
    }
  };
};

export function createRouter() {
  const router = Router();
  for (const method of ['use','get','post','put','patch','delete']) {
    const original = router[method].bind(router);
    router[method] = (...args) => original(...args.map(arg => Array.isArray(arg) ? arg.map(wrap) : wrap(arg)));
  }
  return router;
}
