import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  userId?: number;
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'f1n4nc3';
  
  const token = authHeader.split(' ')[1];
  
  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      res.status(403).json({ error: 'Failed to authenticate token' });
      return;
    }
    
    (req as any).userId = decoded.userId;
    next();
  });
};
