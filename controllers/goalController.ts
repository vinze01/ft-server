import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Goal, SavingsAllocation } from '../models';

class GoalController {
  async getAll(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const { isCompleted, category } = req.query;
      const where: any = { userId };
      
      if (isCompleted !== undefined) {
        where.isCompleted = isCompleted === 'true';
      }
      if (category) {
        where.category = category;
      }
      
      const goals = await Goal.findAll({
        where,
        order: [['priority', 'DESC'], ['createdAt', 'DESC']]
      });
      
      return res.json({ success: true, data: goals });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getOne(req: Request, res: Response) {
    try {
      const goal = await Goal.findOne({
        where: { id: req.params.id, userId: (req as any).userId }
      });
      
      if (!goal) {
        return res.status(404).json({ success: false, error: 'Goal not found' });
      }
      
      return res.json({ success: true, data: goal });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { name, targetAmount, deadline, category, priority, imageUrl } = req.body;
      
      const goal = await Goal.create({
        userId: (req as any).userId,
        name,
        targetAmount,
        deadline,
        category: category || 'other',
        priority: priority || 'medium',
        imageUrl
      });
      
      return res.status(201).json({ success: true, data: goal });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const goal = await Goal.findOne({
        where: { id: req.params.id, userId: (req as any).userId }
      });
      
      if (!goal) {
        return res.status(404).json({ success: false, error: 'Goal not found' });
      }
      
      const { name, targetAmount, currentAmount, deadline, category, priority, imageUrl } = req.body;
      
      let isCompleted = goal.isCompleted;
      let completedAt = goal.completedAt;
      
      if (currentAmount !== undefined) {
        const target = targetAmount || parseFloat(goal.targetAmount.toString());
        if (currentAmount >= target && !goal.isCompleted) {
          isCompleted = true;
          completedAt = new Date();
        } else if (currentAmount < target && goal.isCompleted) {
          isCompleted = false;
          completedAt = undefined;
        }
      }
      
      await goal.update({
        name: name || goal.name,
        targetAmount: targetAmount || goal.targetAmount,
        currentAmount: currentAmount !== undefined ? currentAmount : goal.currentAmount,
        deadline: deadline || goal.deadline,
        category: category || goal.category,
        priority: priority || goal.priority,
        imageUrl: imageUrl !== undefined ? imageUrl : goal.imageUrl,
        isCompleted,
        completedAt
      });
      
      return res.json({ success: true, data: goal });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const goal = await Goal.findOne({
        where: { id: req.params.id, userId: (req as any).userId }
      });
      
      if (!goal) {
        return res.status(404).json({ success: false, error: 'Goal not found' });
      }
      
      await goal.destroy();
      return res.json({ success: true, message: 'Goal deleted' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async contribute(req: Request, res: Response) {
    try {
      const goal = await Goal.findOne({
        where: { id: req.params.id, userId: (req as any).userId }
      });
      
      if (!goal) {
        return res.status(404).json({ success: false, error: 'Goal not found' });
      }
      
      const { amount, note } = req.body;
      const currentAmount = parseFloat(goal.currentAmount.toString()) + amount;
      const targetAmount = parseFloat(goal.targetAmount.toString());
      
      const isCompleted = currentAmount >= targetAmount;
      const completedAt = isCompleted ? new Date() : undefined;
      
      await goal.update({
        currentAmount,
        isCompleted,
        completedAt
      });
      
      return res.json({ success: true, data: goal });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getProgress(req: Request, res: Response) {
    try {
      const goal = await Goal.findOne({
        where: { id: req.params.id, userId: (req as any).userId }
      });
      
      if (!goal) {
        return res.status(404).json({ success: false, error: 'Goal not found' });
      }
      
      const target = parseFloat(goal.targetAmount.toString());
      const current = parseFloat(goal.currentAmount.toString());
      const progress = (current / target) * 100;
      
      let requiredMonthly = 0;
      let projectedCompletion: string | null = null;
      let onTrack = true;
      
      if (goal.deadline) {
        const now = new Date();
        const deadline = new Date(goal.deadline);
        const monthsRemaining = this.monthsBetween(now, deadline);
        
        if (monthsRemaining > 0) {
          requiredMonthly = (target - current) / monthsRemaining;
          const projectedDate = new Date(now);
          projectedDate.setMonth(projectedDate.getMonth() + Math.ceil((target - current) / requiredMonthly));
          projectedCompletion = projectedDate.toISOString().split('T')[0];
          onTrack = projectedDate <= deadline;
        }
      }
      
      return res.json({
        success: true,
        data: {
          goal,
          progress: Math.round(progress * 100) / 100,
          requiredMonthly: Math.round(requiredMonthly * 100) / 100,
          projectedCompletion,
          onTrack
        }
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getSummary(req: Request, res: Response) {
    try {
      const goals = await Goal.findAll({
        where: { userId: (req as any).userId }
      });
      
      const totalGoals = goals.length;
      const completed = goals.filter(g => g.isCompleted).length;
      const totalSaved = goals.reduce((sum, g) => sum + parseFloat(g.currentAmount.toString()), 0);
      const totalTarget = goals.reduce((sum, g) => sum + parseFloat(g.targetAmount.toString()), 0);
      
      return res.json({
        success: true,
        data: { totalGoals, completed, totalSaved, totalTarget }
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  private monthsBetween(date1: Date, date2: Date): number {
    return (date2.getFullYear() - date1.getFullYear()) * 12 +
           (date2.getMonth() - date1.getMonth());
  }
}

export default new GoalController();