import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { AutomationRule, SavingsConfig, Notification, Expense, Income, Bill, Account } from '../models';

class AutomationController {
  async getAll(req: Request, res: Response) {
    try {
      const rules = await AutomationRule.findAll({
        where: { userId: (req as any).userId },
        order: [['createdAt', 'DESC']]
      });
      return res.json({ success: true, data: rules });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getOne(req: Request, res: Response) {
    try {
      const rule = await AutomationRule.findOne({
        where: { id: req.params.id, userId: (req as any).userId }
      });
      if (!rule) {
        return res.status(404).json({ success: false, error: 'Rule not found' });
      }
      return res.json({ success: true, data: rule });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { name, description, triggerType, triggerConditions, actionType, actionParams, isActive } = req.body;

      const rule = await AutomationRule.create({
        userId: (req as any).userId,
        name,
        description,
        triggerType,
        triggerConditions,
        actionType,
        actionParams,
        isActive: isActive !== false
      });

      return res.status(201).json({ success: true, data: rule });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const rule = await AutomationRule.findOne({
        where: { id: req.params.id, userId: (req as any).userId }
      });

      if (!rule) {
        return res.status(404).json({ success: false, error: 'Rule not found' });
      }

      const { name, description, triggerType, triggerConditions, actionType, actionParams, isActive } = req.body;

      await rule.update({
        name: name || rule.name,
        description: description !== undefined ? description : rule.description,
        triggerType: triggerType || rule.triggerType,
        triggerConditions: triggerConditions || rule.triggerConditions,
        actionType: actionType || rule.actionType,
        actionParams: actionParams || rule.actionParams,
        isActive: isActive !== undefined ? isActive : rule.isActive
      });

      return res.json({ success: true, data: rule });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const rule = await AutomationRule.findOne({
        where: { id: req.params.id, userId: (req as any).userId }
      });

      if (!rule) {
        return res.status(404).json({ success: false, error: 'Rule not found' });
      }

      await rule.destroy();
      return res.json({ success: true, message: 'Rule deleted' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async toggle(req: Request, res: Response) {
    try {
      const rule = await AutomationRule.findOne({
        where: { id: req.params.id, userId: (req as any).userId }
      });

      if (!rule) {
        return res.status(404).json({ success: false, error: 'Rule not found' });
      }

      await rule.update({ isActive: !rule.isActive });
      return res.json({ success: true, data: rule });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async test(req: Request, res: Response) {
    try {
      const { testData } = req.body;
      const rule = await AutomationRule.findOne({
        where: { id: req.params.id, userId: (req as any).userId }
      });

      if (!rule) {
        return res.status(404).json({ success: false, error: 'Rule not found' });
      }

      const wouldTrigger = this.checkCondition(rule.triggerConditions, testData);
      
      let actionResult = null;
      if (wouldTrigger) {
        actionResult = await this.executeAction(rule.actionType, rule.actionParams, (req as any).userId);
      }

      return res.json({ success: true, data: { wouldTrigger, actionResult } });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async executeAll(req: Request, res: Response) {
    try {
      const rules = await AutomationRule.findAll({
        where: { userId: (req as any).userId, isActive: true }
      });

      let executedCount = 0;

      for (const rule of rules) {
        const shouldExecute = await this.checkTrigger(rule);
        
        if (shouldExecute) {
          await this.executeAction(rule.actionType, rule.actionParams, (req as any).userId);
          await rule.update({
            executionCount: rule.executionCount + 1,
            lastExecutedAt: new Date()
          });
          executedCount++;
        }
      }

      return res.json({ success: true, data: { executedCount } });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  private async checkTrigger(rule: AutomationRule): Promise<boolean> {
    const { triggerType } = rule;

    switch (triggerType) {
      case 'balance_low': {
        const accounts = await Account.findAll({
          where: { userId: rule.userId, isActive: true }
        });
        const totalBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance.toString()), 0);
        const threshold = rule.triggerConditions.value || 100;
        return totalBalance < threshold;
      }
      case 'due_date': {
        const soon = new Date();
        soon.setDate(soon.getDate() + 3);
        const bills = await Bill.findAll({
          where: {
            userId: rule.userId,
            isPaid: false,
            nextDueDate: { [Op.lte]: soon }
          }
        });
        return bills.length > 0;
      }
      case 'periodic':
        return true;
      default:
        return false;
    }
  }

  private checkCondition(conditions: any, data: any): boolean {
    if (!conditions) return false;
    
    const { field, operator, value } = conditions;
    const dataValue = data[field];

    switch (operator) {
      case 'eq': return dataValue === value;
      case 'ne': return dataValue !== value;
      case 'gt': return dataValue > value;
      case 'lt': return dataValue < value;
      case 'gte': return dataValue >= value;
      case 'lte': return dataValue <= value;
      case 'contains': return String(dataValue).includes(value);
      default: return false;
    }
  }

  private async executeAction(actionType: string, actionParams: any, userId: number): Promise<any> {
    switch (actionType) {
      case 'allocate_savings': {
        const amount = actionParams.amount || 10;
        const savingsConfig = await SavingsConfig.findOne({
          where: { userId, isActive: true }
        });
        
        if (savingsConfig?.targetAccountId) {
          const account = await Account.findByPk(savingsConfig.targetAccountId);
          if (account) {
            const balance = parseFloat(account.balance.toString());
            await account.update({ balance: balance + amount });
            return { allocated: amount, accountId: account.id };
          }
        }
        return null;
      }
      case 'send_notification': {
        const notification = await Notification.create({
          userId,
          type: 'insight',
          title: actionParams.title || 'Automation Alert',
          message: actionParams.message || 'Automated notification',
          data: actionParams.data
        });
        return { notificationId: notification.id };
      }
      case 'create_transaction': {
        const expense = await Expense.create({
          userId,
          description: actionParams.description || 'Automated expense',
          amount: actionParams.amount,
          category: actionParams.category || 'Other',
          date: new Date(),
          note: actionParams.note
        } as any);
        return { expenseId: expense.id };
      }
      case 'mark_paid': {
        const bill = await Bill.findByPk(actionParams.billId);
        if (bill) {
          await bill.update({ isPaid: true, paidDate: new Date() });
          return { billId: bill.id };
        }
        return null;
      }
      default:
        return null;
    }
  }
}

export default new AutomationController();