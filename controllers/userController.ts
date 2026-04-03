import { Request, Response } from 'express';
import User from '../models/User';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const IMGBB_API_KEY = process.env.IMGBB_API_KEY || '';
const IMGBB_API_URL = 'https://api.imgbb.com/1/upload';

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { firstName, middleName, lastName, email, contactNo } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (email !== user.email) {
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        res.status(400).json({ error: 'Email already in use' });
        return;
      }
    }

    await user.update({
      firstName,
      middleName,
      lastName,
      email,
      contactNo: parseInt(contactNo)
    });

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

    if (!req.file || !req.file.path) {
      res.status(400).json({ error: 'No file uploaded or file path missing', file: req.file });
      return;
    }

    const user = await User.findByPk(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const fs = await import('fs');
    const filePath = req.file.path;
    
    if (!fs.existsSync(filePath)) {
      res.status(400).json({ error: 'File does not exist at path: ' + filePath });
      return;
    }
    
    const fileBuffer = fs.readFileSync(filePath);
    
    if (!fileBuffer) {
      res.status(400).json({ error: 'Could not read file' });
      return;
    }
    
    const base64Image = fileBuffer.toString('base64');

    const params = new URLSearchParams();
    params.append('key', IMGBB_API_KEY);
    params.append('image', base64Image);

    const response = await axios({
      method: 'POST',
      url: IMGBB_API_URL,
      data: params.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    console.log('ImgBB response:', response.data);

    try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }

    if (response.data.success) {
      const imageUrl = response.data.data.url;
      await user.update({ avatar: imageUrl });
      res.json({ avatar: imageUrl });
    } else {
      res.status(500).json({ error: 'ImgBB error', details: response.data });
    }
  } catch (error: any) {
    console.error('Upload avatar error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to upload avatar: ' + (error.response?.data?.error || error.message) });
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

    await user.destroy();

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
};