import { Request, Response } from 'express';
import User from '../models/User';
import {
  Tag, TransactionTag, Income, Expense, SavingsAllocation, SavingsConfig,
  AccountTransfer, Budget, RecurringTransaction, Bill, Goal,
  AutomationRule, Notification, NotificationSettings, Insight, Session, Account
} from '../models';
import sequelize from '../config/database';
import { Op } from 'sequelize';
import bcrypt from 'bcryptjs';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { firstName, middleName, lastName, email, contactNo } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Only update the fields that were actually sent — a partial update must
    // not push parseInt(undefined) = NaN into the BIGINT contact_no column.
    const updates: Record<string, any> = {};
    if (firstName !== undefined) updates.firstName = firstName;
    if (middleName !== undefined) updates.middleName = middleName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (email !== undefined) updates.email = email;
    if (contactNo !== undefined && contactNo !== '') updates.contactNo = parseInt(contactNo);

    if (updates.email && updates.email !== user.email) {
      const existingUser = await User.findOne({ where: { email: updates.email } });
      if (existingUser) {
        res.status(400).json({ error: 'Email already in use' });
        return;
      }
    }

    await user.update(updates);

    res.json({
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,
      email: user.email,
      contactNo: user.contactNo,
      avatar: user.avatar
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

export const updatePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { currentPassword, newPassword } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      res.status(400).json({ error: 'Current password is incorrect' });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hashedPassword });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
};

export const uploadAvatar = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    console.log('uploadAvatar called, req.file:', req.file);

    if (!req.file || !req.file.buffer) {
      console.log('No file or buffer');
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const user = await User.findByPk(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Multer kept the image in memory — upload it to Cloudinary as a base64
    // data URI instead of writing it to disk. public_id is per-user so a new
    // upload overwrites the previous avatar.
    const result = await cloudinary.uploader.upload(`data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`, {
      upload_preset: 'finance-tracker-upload',
      folder: 'avatars',
      public_id: `avatar_${userId}`
    });
    console.log('Cloudinary response:', result);

    const imageUrl = result.secure_url;
    await user.update({ avatar: imageUrl });
    res.json({ avatar: imageUrl });
  } catch (error: any) {
    console.error('Upload avatar error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to upload avatar: ' + (error.message) });
  }
};

export const deleteAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;

    const user = await User.findByPk(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Delete child rows explicitly inside one transaction. Databases created
    // by sequelize.sync lack ON DELETE CASCADE on their FKs (the models don't
    // declare it), so a bare user.destroy() would fail with FK violations.
    await sequelize.transaction(async (t) => {
      // Join rows reference tags and (polymorphically) transactions — clean
      // them before either side disappears.
      const tags = await Tag.findAll({ where: { userId }, attributes: ['id'], transaction: t });
      const tagIds = tags.map(tag => tag.id);
      const [incomeIds, expenseIds] = await Promise.all([
        Income.findAll({ where: { userId }, attributes: ['id'], transaction: t }).then(rows => rows.map(r => r.id)),
        Expense.findAll({ where: { userId }, attributes: ['id'], transaction: t }).then(rows => rows.map(r => r.id))
      ]);
      await TransactionTag.destroy({
        where: {
          ...(tagIds.length > 0 || incomeIds.length > 0 || expenseIds.length > 0
            ? {
                [Op.or]: [
                  ...(tagIds.length > 0 ? [{ tagId: tagIds }] : []),
                  ...(incomeIds.length > 0 ? [{ transactionId: incomeIds, transactionType: 'income' }] : []),
                  ...(expenseIds.length > 0 ? [{ transactionId: expenseIds, transactionType: 'expense' }] : [])
                ]
              }
            : {}),
          ...(tagIds.length === 0 && incomeIds.length === 0 && expenseIds.length === 0 ? { id: -1 } : {})
        },
        transaction: t
      });

      // Allocations reference savings configs and goals — clean before both.
      await SavingsAllocation.destroy({ where: { userId }, transaction: t });
      await SavingsConfig.destroy({ where: { userId }, transaction: t });

      // Transfers reference accounts — clean before accounts.
      await AccountTransfer.destroy({ where: { userId }, transaction: t });

      // Simple user-owned tables.
      await Income.destroy({ where: { userId }, transaction: t });
      await Expense.destroy({ where: { userId }, transaction: t });
      await Budget.destroy({ where: { userId }, transaction: t });
      await RecurringTransaction.destroy({ where: { userId }, transaction: t });
      await Bill.destroy({ where: { userId }, transaction: t });
      await Goal.destroy({ where: { userId }, transaction: t });
      await AutomationRule.destroy({ where: { userId }, transaction: t });
      await Notification.destroy({ where: { userId }, transaction: t });
      await NotificationSettings.destroy({ where: { userId }, transaction: t });
      await Insight.destroy({ where: { userId }, transaction: t });
      await Session.destroy({ where: { userId }, transaction: t });
      await Account.destroy({ where: { userId }, transaction: t });
      await Tag.destroy({ where: { userId }, transaction: t });

      await user.destroy({ transaction: t });
    });

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
};