import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Goal, SavingsAllocation } from '../models';

// Mirrors the ENUM columns in models/Goal.ts — Postgres rejected invalid
// values with a raw 500 instead of a validation message.
const GOAL_CATEGORIES = ['emergency', 'investment', 'purchase', 'travel', 'other'];
const GOAL_PRIORITIES = ['low', 'medium', 'high'];

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

      if (!name || !String(name).trim()) {
        return res.status(400).json({ success: false, error: 'Goal name is required' });
      }
      const target = Number(targetAmount);
      if (!Number.isFinite(target) || target <= 0) {
        return res.status(400).json({ success: false, error: 'Target amount must be a positive number' });
      }
      if (deadline && isNaN(new Date(deadline).getTime())) {
        return res.status(400).json({ success: false, error: 'Invalid deadline date' });
      }
      if (category !== undefined && category !== null && !GOAL_CATEGORIES.includes(category)) {
        return res.status(400).json({ success: false, error: 'Invalid goal category' });
      }
      if (priority !== undefined && priority !== null && !GOAL_PRIORITIES.includes(priority)) {
        return res.status(400).json({ success: false, error: 'Invalid goal priority' });
      }

      const goal = await Goal.create({
        userId: (req as any).userId,
        name,
        targetAmount: target,
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

      if (targetAmount !== undefined && targetAmount !== null && (!Number.isFinite(Number(targetAmount)) || Number(targetAmount) <= 0)) {
        return res.status(400).json({ success: false, error: 'Target amount must be a positive number' });
      }
      if (category !== undefined && category !== null && !GOAL_CATEGORIES.includes(category)) {
        return res.status(400).json({ success: false, error: 'Invalid goal category' });
      }
      if (priority !== undefined && priority !== null && !GOAL_PRIORITIES.includes(priority)) {
        return res.status(400).json({ success: false, error: 'Invalid goal priority' });
      }

      let isCompleted = goal.isCompleted;
      let completedAt: Date | null = goal.completedAt ?? null;

      if (currentAmount !== undefined && (!Number.isFinite(Number(currentAmount)) || Number(currentAmount) < 0)) {
        return res.status(400).json({ success: false, error: 'Current amount must be a non-negative number' });
      }

      // Completion depends on both values, so it must be re-evaluated when
      // either one changes — raising the target above the saved amount used
      // to leave the goal flagged completed with a stale completedAt.
      if (currentAmount !== undefined || (targetAmount !== undefined && targetAmount !== null)) {
        const target = targetAmount !== undefined && targetAmount !== null
          ? Number(targetAmount)
          : parseFloat(goal.targetAmount.toString());
        const current = currentAmount !== undefined
          ? Number(currentAmount)
          : parseFloat(goal.currentAmount.toString());

        const nowComplete = current >= target;
        if (nowComplete && !goal.isCompleted) {
          isCompleted = true;
          completedAt = new Date();
        } else if (!nowComplete && goal.isCompleted) {
          isCompleted = false;
          // null (not undefined) — Sequelize strips undefined keys, which
          // would leave a stale completion timestamp on an un-completed goal.
          completedAt = null;
        }
      }

      await goal.update({
        name: name || goal.name,
        targetAmount: targetAmount !== undefined && targetAmount !== null ? Number(targetAmount) : goal.targetAmount,
        currentAmount: currentAmount !== undefined ? Number(currentAmount) : goal.currentAmount,
        deadline: deadline || goal.deadline,
        category: category || goal.category,
        priority: priority || goal.priority,
        imageUrl: imageUrl !== undefined ? imageUrl : goal.imageUrl,
        isCompleted,
        completedAt: completedAt === null ? (null as any) : completedAt
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
      const contribution = Number(amount);
      if (!Number.isFinite(contribution) || contribution <= 0) {
        // Negative or zero contributions previously reduced the saved
        // amount silently.
        return res.status(400).json({ success: false, error: 'Contribution must be a positive number' });
      }

      const currentAmount = Math.round(
        (parseFloat(goal.currentAmount.toString()) + contribution) * 100
      ) / 100;
      const targetAmount = parseFloat(goal.targetAmount.toString());

      const isCompleted = currentAmount >= targetAmount;
      // null (not undefined) — see update(): undefined is stripped and would
      // leave a stale completion timestamp.
      const completedAt: Date | null = isCompleted ? new Date() : null;

      await goal.update({
        currentAmount,
        isCompleted,
        completedAt: completedAt === null ? (null as any) : completedAt
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
      // Guard against a zero target (only the SQL CHECK guarded it before,
      // and sync-created databases don't have that CHECK).
      const progress = target > 0 ? (current / target) * 100 : 0;
      
      let requiredMonthly = 0;
      let projectedCompletion: string | null = null;
      let onTrack = true;
      
      if (goal.deadline) {
        const now = new Date();
        const deadline = new Date(goal.deadline);
        const monthsRemaining = this.monthsBetween(now, deadline);

        // Only project while there is something left to save — a fully
        // funded goal has no required monthly amount.
        if (monthsRemaining > 0 && target - current > 0) {
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