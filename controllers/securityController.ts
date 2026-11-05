import { Request, Response } from 'express';
import { Op } from 'sequelize';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { User } from '../models';
import Session from '../models/Session';
import bcrypt from 'bcryptjs';

const TOKEN_EXPIRY_DAYS = 7;

class SecurityController {
  async enable2FA(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      if (user.twoFactorEnabled) {
        return res.status(400).json({ success: false, error: '2FA is already enabled' });
      }

      const secret = speakeasy.generateSecret({ name: `FinanceTracker:${user.email}` });
      const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

      // Store the pending secret in its dedicated column and keep 2FA
      // disabled until the user proves possession via verify2FA.
      await user.update({ totpSecret: secret.base32, twoFactorEnabled: false });

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
      if (!user || !user.totpSecret) {
        return res.status(400).json({ success: false, error: '2FA not initialized — call enable first' });
      }
      if (!code) {
        return res.status(400).json({ success: false, error: 'Verification code is required' });
      }

      const verified = speakeasy.totp.verify({
        secret: user.totpSecret,
        encoding: 'base32',
        token: code,
        window: 1
      });

      if (!verified) {
        return res.status(400).json({ success: false, error: 'Invalid code' });
      }

      // Verified possession — now enforce the challenge at login. The
      // secret is kept so future logins can be verified against it.
      await user.update({ twoFactorEnabled: true });

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

      // Require the current password — a stolen token alone must not be able
      // to turn off a user's second factor.
      if (!password || !(await bcrypt.compare(password, user.password))) {
        return res.status(400).json({ success: false, error: 'Password is incorrect' });
      }

      await user.update({ twoFactorEnabled: false, totpSecret: null as any });

      return res.json({ success: true, message: '2FA disabled' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /** Verify a TOTP code against the user's stored secret (used by login). */
  async verifyLogin2FA(user: User, code: unknown): Promise<'ok' | 'required' | 'invalid'> {
    if (!user.twoFactorEnabled) return 'ok';
    if (typeof code !== 'string' || !code.trim()) return 'required';
    const valid = speakeasy.totp.verify({
      secret: user.totpSecret || '',
      encoding: 'base32',
      token: code.trim(),
      window: 1
    });
    return valid ? 'ok' : 'invalid';
  }

  async getSessions(req: Request, res: Response) {
    try {
      const sessions = await Session.findAll({
        where: {
          userId: (req as any).userId,
          // Hide expired sessions — they are dead rows, not active devices.
          expiresAt: { [Op.gt]: new Date() }
        },
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

      // Verify the current password before allowing a change
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, error: 'Current password is incorrect' });
      }

      // Always store bcrypt hashes, never plaintext
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await user.update({ password: hashedPassword });

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