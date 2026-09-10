import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { SavingsConfig, SavingsAllocation, Income, Expense, Account, Goal } from '../models';

enum SavingsMode {
  FIXED_PERCENTAGE = 'fixed_percentage',
  LEFTOVER_BASED = 'leftover_based',
  GOAL_BASED = 'goal_based'
}

class SavingsController {
  async getConfig(req: Request, res: Response) {
    try {
      const config = await SavingsConfig.findOne({
        where: { userId: (req as any).userId }
      });
      return res.json({ success: true, data: config });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async createOrUpdateConfig(req: Request, res: Response) {
    try {
      const { mode, targetPercentage, targetAccountId, spendingAccountId, minBalance, isActive } = req.body;
      
      let config = await SavingsConfig.findOne({
        where: { userId: (req as any).userId }
      });

      if (config) {
        await config.update({
          mode: mode || config.mode,
          targetPercentage: targetPercentage !== undefined ? targetPercentage : config.targetPercentage,
          targetAccountId: targetAccountId !== undefined ? targetAccountId : config.targetAccountId,
          spendingAccountId: spendingAccountId !== undefined ? spendingAccountId : config.spendingAccountId,
          minBalance: minBalance !== undefined ? minBalance : config.minBalance,
          isActive: isActive !== undefined ? isActive : config.isActive
        });
      } else {
        config = await SavingsConfig.create({
          userId: (req as any).userId,
          mode: mode || SavingsMode.FIXED_PERCENTAGE,
          targetPercentage: targetPercentage || 10,
          targetAccountId,
          spendingAccountId,
          minBalance: minBalance || 0,
          isActive: isActive !== false
        });
      }

      return res.json({ success: true, data: config });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async activate(req: Request, res: Response) {
    try {
      const config = await SavingsConfig.findOne({
        where: { userId: (req as any).userId }
      });
      if (!config) {
        return res.status(404).json({ success: false, error: 'Savings config not found' });
      }
      await config.update({ isActive: true });
      return res.json({ success: true, message: 'Savings automation activated' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async deactivate(req: Request, res: Response) {
    try {
      const config = await SavingsConfig.findOne({
        where: { userId: (req as any).userId }
      });
      if (!config) {
        return res.status(404).json({ success: false, error: 'Savings config not found' });
      }
      await config.update({ isActive: false });
      return res.json({ success: true, message: 'Savings automation deactivated' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async calculate(req: Request, res: Response) {
    try {
      const { periodStart, periodEnd } = req.body;
      const start = periodStart ? new Date(periodStart) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const end = periodEnd ? new Date(periodEnd) : new Date();

      const config = await SavingsConfig.findOne({
        where: { userId: (req as any).userId, isActive: true }
      });

      if (!config) {
        return res.json({ success: true, data: { allocated: 0, allocations: [] } });
      }

      const incomes = await Income.findAll({
        where: {
          userId: (req as any).userId,
          year: start.getFullYear(),
          month: start.toLocaleString('default', { month: 'long' })
        }
      });
      const totalIncome = incomes.reduce((sum, inc) => sum + parseFloat(inc.amount.toString()), 0);

      const expenses = await Expense.findAll({
        where: {
          userId: (req as any).userId,
          date: { [Op.between]: [start, end] }
        }
      });
      const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0);

      let savingsAmount = 0;
      let allocations: any[] = [];

      switch (config.mode) {
        case SavingsMode.FIXED_PERCENTAGE:
          savingsAmount = totalIncome * ((config.targetPercentage || 10) / 100);
          break;
        case SavingsMode.LEFTOVER_BASED:
          const leftover = totalIncome - totalExpenses;
          if (leftover > parseFloat(config.minBalance.toString())) {
            savingsAmount = leftover - parseFloat(config.minBalance.toString());
          }
          break;
        case SavingsMode.GOAL_BASED:
          const goals = await Goal.findAll({
            where: { userId: (req as any).userId, isCompleted: false }
          });
          const monthlyIncome = totalIncome / Math.max(1, (end.getMonth() - start.getMonth() + 1));
          
          for (const goal of goals) {
            const target = parseFloat(goal.targetAmount.toString());
            const current = parseFloat(goal.currentAmount.toString());
            const remaining = target - current;
            if (remaining > 0 && goal.deadline) {
              const monthsLeft = this.monthsBetween(new Date(), goal.deadline);
              const required = remaining / Math.max(1, monthsLeft);
              const allocated = Math.min(monthlyIncome * 0.5, required);
              
              if (allocated > 0) {
                const allocation = await SavingsAllocation.create({
                  userId: (req as any).userId,
                  savingsConfigId: config.id,
                  goalId: goal.id,
                  amount: allocated,
                  periodStart: start,
                  periodEnd: end,
                  status: 'allocated'
                });
                allocations.push(allocation);
                savingsAmount += allocated;
              }
            }
          }
          break;
      }

      if (savingsAmount > 0 && config.targetAccountId) {
        const targetAccount = await Account.findByPk(config.targetAccountId);
        if (targetAccount) {
          const currentBalance = parseFloat(targetAccount.balance.toString());
          await targetAccount.update({
            balance: currentBalance + savingsAmount
          });
        }

        if (allocations.length === 0) {
          const allocation = await SavingsAllocation.create({
            userId: (req as any).userId,
            savingsConfigId: config.id,
            amount: savingsAmount,
            periodStart: start,
            periodEnd: end,
            status: 'allocated'
          });
          allocations.push(allocation);
        }
      }

      await config.update({ lastCalculatedAt: new Date() });

      return res.json({ success: true, data: { allocated: savingsAmount, allocations } });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getAllocations(req: Request, res: Response) {
    try {
      const { from, to } = req.query;
      const where: any = { userId: (req as any).userId };

      if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt[Op.gte] = new Date(from as string);
        if (to) where.createdAt[Op.lte] = new Date(to as string);
      }

      const allocations = await SavingsAllocation.findAll({
        where,
        include: ['goal'],
        order: [['createdAt', 'DESC']],
        limit: 100
      });

      return res.json({ success: true, data: allocations });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getProjection(req: Request, res: Response) {
    try {
      const months = parseInt(req.query.months as string) || 12;
      const config = await SavingsConfig.findOne({
        where: { userId: (req as any).userId, isActive: true }
      });

      if (!config) {
        return res.json({ success: true, data: { projections: [], totalProjected: 0 } });
      }

      const avgIncome = await this.getAverageIncome((req as any).userId, 6);
      const avgExpenses = await this.getAverageExpenses((req as any).userId, 6);
      const avgSavings = avgIncome - avgExpenses;

      const projections: any[] = [];
      let cumulative = 0;
      const now = new Date();

      for (let i = 1; i <= months; i++) {
        const date = new Date(now);
        date.setMonth(date.getMonth() + i);
        const projected = Math.max(0, avgSavings);
        cumulative += projected;
        projections.push({
          month: date.toLocaleString('default', { month: 'short', year: 'numeric' }),
          projectedSavings: Math.round(projected * 100) / 100,
          cumulativeSavings: Math.round(cumulative * 100) / 100
        });
      }

      return res.json({ 
        success: true, 
        data: { projections, totalProjected: Math.round(cumulative * 100) / 100 } 
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  private async getAverageIncome(userId: number, months: number): Promise<number> {
    const now = new Date();
    const year = now.getFullYear();
    
    const incomes = await Income.findAll({
      where: { userId, year }
    });
    
    const total = incomes.reduce((sum, inc) => sum + parseFloat(inc.amount.toString()), 0);
    return total / months;
  }

  private async getAverageExpenses(userId: number, months: number): Promise<number> {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - months, 1);
    
    const expenses = await Expense.findAll({
      where: { userId, date: { [Op.gte]: start } }
    });
    
    const total = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0);
    return total / months;
  }

  private monthsBetween(date1: Date, date2: Date | undefined): number {
    if (!date2) return 1;
    return Math.max(1, (date2.getFullYear() - date1.getFullYear()) * 12 +
           (date2.getMonth() - date1.getMonth()));
  }
}

export default new SavingsController();