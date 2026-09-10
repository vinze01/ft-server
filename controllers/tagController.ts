import { Request, Response } from 'express';
import { Tag, TransactionTag, Income, Expense } from '../models';

class TagController {
  async getAll(req: Request, res: Response) {
    try {
      const tags = await Tag.findAll({
        where: { userId: (req as any).userId },
        order: [['name', 'ASC']]
      });
      return res.json({ success: true, data: tags });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { name, color } = req.body;
      const tag = await Tag.create({
        userId: (req as any).userId,
        name,
        color: color || '#6366f1'
      });
      return res.status(201).json({ success: true, data: tag });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const tag = await Tag.findOne({
        where: { id: req.params.id, userId: (req as any).userId }
      });
      if (!tag) {
        return res.status(404).json({ success: false, error: 'Tag not found' });
      }
      const { name, color } = req.body;
      await tag.update({
        name: name || tag.name,
        color: color || tag.color
      });
      return res.json({ success: true, data: tag });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const tag = await Tag.findOne({
        where: { id: req.params.id, userId: (req as any).userId }
      });
      if (!tag) {
        return res.status(404).json({ success: false, error: 'Tag not found' });
      }
      await tag.destroy();
      return res.json({ success: true, message: 'Tag deleted' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async addToTransactions(req: Request, res: Response) {
    try {
      const { transactionIds, transactionType } = req.body;
      const tagId = parseInt(req.params.id);
      
      for (const txId of transactionIds) {
        await TransactionTag.findOrCreate({
          where: {
            transactionId: txId,
            transactionType,
            tagId
          }
        });
      }
      return res.json({ success: true, message: 'Tag added to transactions' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getTransactions(req: Request, res: Response) {
    try {
      const tagId = parseInt(req.params.id);
      const { type, from, to } = req.query;
      const userId = (req as any).userId;
      
      const transactionTags = await TransactionTag.findAll({
        where: { tagId }
      });
      
      const txIds = transactionTags.map(tt => tt.transactionId);
      
      let transactions;
      if (type === 'income') {
        transactions = await Income.findAll({
          where: { id: txIds, userId }
        });
      } else {
        transactions = await Expense.findAll({
          where: { id: txIds, userId }
        });
      }
      
      return res.json({ success: true, data: transactions });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default new TagController();