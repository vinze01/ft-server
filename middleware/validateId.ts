import { Request, Response, NextFunction } from 'express';

// Defense-in-depth for SQL injection: every `:id` route parameter must be a
// positive integer before it reaches a controller. Sequelize parameterizes
// all queries (there are no raw queries in this codebase), but validating the
// shape here keeps malformed input out of the query layer entirely.
// Wired globally via `router.param('id', ...)` in routes/index.ts.
export const validateIdParam = (req: Request, res: Response, next: NextFunction): void => {
  if (!/^\d+$/.test(String(req.params.id))) {
    res.status(400).json({ error: 'Invalid id parameter' });
    return;
  }
  next();
};
