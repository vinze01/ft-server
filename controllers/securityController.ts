import { Request, Response } from 'express';
import { Op } from 'sequelize';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { User } from '../models';
import Session from '../models/Session';

const TOKEN_EXPIRY_DAYS = 7;

class SecurityController {
  async enable2FA(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const user = await User.findByPk(userId);
      const secret = speakeasy.generateSecret({ name: `FinanceTracker:${user?.email}` });
      
      const qrCode = await QRCode.toDataURL(secret.otpauth_url!);
      
      await User.update(
        { resetToken: secret.base32 },
        { where: { id: userId } }
      );

      return res.json({ 
        success: true, 
        data: { 
          qrCode, 
          secret: secret.base32,
          message: 'Verify this code with your authenticator app' 
        } 
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async verify2FA(req: Request, res: Response) {
    try {
      const { code } = req.body;
      
      const user = await User.findByPk((req as any).userId);
      if (!user || !user.resetToken) {
        return res.status(400).json({ success: false, error: '2FA not initialized' });
      }

      const verified = speakeasy.totp.verify({
        secret: user.resetToken,
        encoding: 'base32',
        token: code,
        window: 1
      });

      if (!verified) {
        return res.status(400).json({ success: false, error: 'Invalid code' });
      }

      await User.update(
        { resetToken: undefined },
        { where: { id: (req as any).userId } }
      );

      return res.json({ success: true, message: '2FA enabled successfully' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async disable2FA(req: Request, res: Response) {
    try {
      const { password } = req.body;
      
      const user = await User.findByPk((req as any).userId);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      await User.update(
        { resetToken: undefined },
        { where: { id: (req as any).userId } }
      );

      return res.json({ success: true, message: '2FA disabled' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getSessions(req: Request, res: Response) {
    try {
      const sessions = await Session.findAll({
        where: { userId: (req as any).userId },
        order: [['createdAt', 'DESC']],
        limit: 20
      });

      return res.json({ success: true, data: sessions });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async revokeSession(req: Request, res: Response) {
    try {
      const session = await Session.findOne({
        where: { id: req.params.id, userId: (req as any).userId }
      });

      if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }

      if (session.isCurrent) {
        return res.status(400).json({ success: false, error: 'Cannot revoke current session' });
      }

      await session.destroy();
      return res.json({ success: true, message: 'Session revoked' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async revokeOtherSessions(req: Request, res: Response) {
    try {
      await Session.update(
        { isCurrent: false },
        { where: { userId: (req as any).userId, isCurrent: false } }
      );

      await Session.destroy({
        where: { 
          userId: (req as any).userId, 
          isCurrent: false 
        }
      });

      return res.json({ success: true, message: 'Other sessions revoked' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getDevices(req: Request, res: Response) {
    try {
      const currentSession = await Session.findOne({
        where: { userId: (req as any).userId, isCurrent: true }
      });

      const otherSessions = await Session.findAll({
        where: { 
          userId: (req as any).userId, 
          isCurrent: false,
          expiresAt: { [Op.gt]: new Date() }
        },
        order: [['lastActiveAt', 'DESC']],
        limit: 10
      });

      return res.json({ 
        success: true, 
        data: { 
          current: currentSession,
          others: otherSessions 
        } 
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async changePassword(req: Request, res: Response) {
    try {
      const { currentPassword, newPassword } = req.body;
      
      const user = await User.findByPk((req as any).userId);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      await User.update(
        { password: newPassword },
        { where: { id: (req as any).userId } }
      );

      return res.json({ success: true, message: 'Password changed successfully' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async createSession(req: Request, res: Response, userId: number, token: string) {
    try {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS);

      await Session.update(
        { isCurrent: false },
        { where: { userId } }
      );

      const session = await Session.create({
        userId,
        tokenHash,
        deviceInfo: req.headers['user-agent'] || 'Unknown',
        ipAddress: req.ip || req.socket.remoteAddress,
        isCurrent: true,
        expiresAt
      });

      return session;
    } catch (error) {
      console.error('Failed to create session:', error);
      return null;
    }
  }
}

export default new SecurityController();