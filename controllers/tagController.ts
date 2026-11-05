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
      const userId = (req as any).userId;

      if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
        return res.status(400).json({ success: false, error: 'transactionIds must be a non-empty array' });
      }
      if (transactionType !== 'income' && transactionType !== 'expense') {
        return res.status(400).json({ success: false, error: 'transactionType must be "income" or "expense"' });
      }

      // Ownership: the tag must belong to the caller...
      const tag = await Tag.findOne({
        where: { id: req.params.id, userId }
      });
      if (!tag) {
        return res.status(404).json({ success: false, error: 'Tag not found' });
      }

      // ...and every target transaction must belong to the caller too.
      const expected = transactionIds.length;
      const owned = transactionType === 'income'
        ? await Income.count({ where: { id: transactionIds, userId } })
        : await Expense.count({ where: { id: transactionIds, userId } });
      if (owned !== expected) {
        return res.status(403).json({ success: false, error: 'One or more transactions do not belong to you' });
      }

      for (const txId of transactionIds) {
        await TransactionTag.findOrCreate({
          where: {
            transactionId: txId,
            transactionType,
            tagId: tag.id
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
      const userId = (req as any).userId;

      // Ownership: only expose link data for tags the caller owns.
      const tag = await Tag.findOne({
        where: { id: req.params.id, userId }
      });
      if (!tag) {
        return res.status(404).json({ success: false, error: 'Tag not found' });
      }

      const { type, from, to } = req.query;

      const transactionTags = await TransactionTag.findAll({
        where: { tagId: tag.id }
      });

      const txIds = transactionTags.map(tt => tt.transactionId);

      if (txIds.length === 0) {
        return res.json({ success: true, data: [] });
      }

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