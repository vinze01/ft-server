import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Notification, NotificationSettings } from '../models';

class NotificationController {
  async getAll(req: Request, res: Response) {
    try {
      const { unread, limit } = req.query;
      const where: any = { userId: (req as any).userId };

      if (unread === 'true') {
        where.isRead = false;
      }

      const notifications = await Notification.findAll({
        where,
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit as string) || 50
      });

      return res.json({ success: true, data: notifications });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getUnreadCount(req: Request, res: Response) {
    try {
      const count = await Notification.count({
        where: { userId: (req as any).userId, isRead: false }
      });

      return res.json({ success: true, data: { count } });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async markAsRead(req: Request, res: Response) {
    try {
      const notification = await Notification.findOne({
        where: { id: req.params.id, userId: (req as any).userId }
      });

      if (!notification) {
        return res.status(404).json({ success: false, error: 'Notification not found' });
      }

      await notification.update({
        isRead: true,
        readAt: new Date()
      });

      return res.json({ success: true, message: 'Marked as read' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async markAllAsRead(req: Request, res: Response) {
    try {
      await Notification.update(
        { isRead: true, readAt: new Date() },
        { where: { userId: (req as any).userId, isRead: false } }
      );

      return res.json({ success: true, message: 'All marked as read' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const notification = await Notification.findOne({
        where: { id: req.params.id, userId: (req as any).userId }
      });

      if (!notification) {
        return res.status(404).json({ success: false, error: 'Notification not found' });
      }

      await notification.destroy();
      return res.json({ success: true, message: 'Notification deleted' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getSettings(req: Request, res: Response) {
    try {
      let settings = await NotificationSettings.findOne({
        where: { userId: (req as any).userId }
      });

      if (!settings) {
        settings = await NotificationSettings.create({
          userId: (req as any).userId
        });
      }

      return res.json({ success: true, data: settings });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async updateSettings(req: Request, res: Response) {
    try {
      const { 
        budgetAlerts, 
        billReminders, 
        goalUpdates, 
        weeklySummary, 
        insights, 
        securityAlerts,
        emailNotifications,
        pushNotifications
      } = req.body;

      let settings = await NotificationSettings.findOne({
        where: { userId: (req as any).userId }
      });

      if (settings) {
        await settings.update({
          budgetAlerts: budgetAlerts !== undefined ? budgetAlerts : settings.budgetAlerts,
          billReminders: billReminders !== undefined ? billReminders : settings.billReminders,
          goalUpdates: goalUpdates !== undefined ? goalUpdates : settings.goalUpdates,
          weeklySummary: weeklySummary !== undefined ? weeklySummary : settings.weeklySummary,
          insights: insights !== undefined ? insights : settings.insights,
          securityAlerts: securityAlerts !== undefined ? securityAlerts : settings.securityAlerts,
          emailNotifications: emailNotifications !== undefined ? emailNotifications : settings.emailNotifications,
          pushNotifications: pushNotifications !== undefined ? pushNotifications : settings.pushNotifications
        });
      } else {
        settings = await NotificationSettings.create({
          userId: (req as any).userId,
          budgetAlerts: budgetAlerts !== false,
          billReminders: billReminders !== false,
          goalUpdates: goalUpdates !== false,
          weeklySummary: weeklySummary !== false,
          insights: insights !== false,
          securityAlerts: securityAlerts !== false,
          emailNotifications: emailNotifications !== false,
          pushNotifications: pushNotifications !== false
        });
      }

      return res.json({ success: true, message: 'Settings updated' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async createNotification(userId: number, type: string, title: string, message: string, data?: any) {
    try {
      const settings = await NotificationSettings.findOne({
        where: { userId }
      });

      const shouldSend = this.shouldNotify(settings, type);
      if (!shouldSend) return null;

      const notification = await Notification.create({
        userId,
        type: type as any,
        title,
        message,
        data
      });

      return notification;
    } catch (error) {
      console.error('Failed to create notification:', error);
      return null;
    }
  }

  private shouldNotify(settings: NotificationSettings | null, type: string): boolean {
    if (!settings) return true;

    switch (type) {
      case 'budget_alert': return settings.budgetAlerts;
      case 'bill_due': return settings.billReminders;
      case 'goal_progress': return settings.goalUpdates;
      case 'insight': return settings.insights;
      case 'security': return settings.securityAlerts;
      default: return true;
    }
  }
}

export default new NotificationController();