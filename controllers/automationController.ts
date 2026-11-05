import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { AutomationRule, SavingsConfig, Notification, Expense, Income, Bill, Account } from '../models';

const TRIGGER_TYPES = ['balance_low', 'due_date', 'transaction_added', 'recurring_executed', 'periodic'];
const ACTION_TYPES = ['allocate_savings', 'send_notification', 'create_transaction', 'mark_paid'];

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

      if (!name || !String(name).trim()) {
        return res.status(400).json({ success: false, error: 'Rule name is required' });
      }
      if (!TRIGGER_TYPES.includes(triggerType)) {
        return res.status(400).json({ success: false, error: 'Invalid trigger type' });
      }
      if (!ACTION_TYPES.includes(actionType)) {
        return res.status(400).json({ success: false, error: 'Invalid action type' });
      }

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

      if (triggerType !== undefined && !TRIGGER_TYPES.includes(triggerType)) {
        return res.status(400).json({ success: false, error: 'Invalid trigger type' });
      }
      if (actionType !== undefined && !ACTION_TYPES.includes(actionType)) {
        return res.status(400).json({ success: false, error: 'Invalid action type' });
      }

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

      // Dry run only: describe what the action WOULD do without writing
      // anything — a "test" must never mutate financial data.
      let actionResult = null;
      if (wouldTrigger) {
        actionResult = await this.describeAction(rule.actionType, rule.actionParams, (req as any).userId);
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
      const errors: { ruleId: number; error: string }[] = [];

      // Per-rule error isolation: one failing rule must not abort the run
      // (rules already executed stay executed).
      for (const rule of rules) {
        try {
          const shouldExecute = await this.checkTrigger(rule);

          if (shouldExecute) {
            await this.executeAction(rule.actionType, rule.actionParams, (req as any).userId);
            await rule.update({
              executionCount: rule.executionCount + 1,
              lastExecutedAt: new Date()
            });
            executedCount++;
          }
        } catch (ruleError: any) {
          errors.push({ ruleId: rule.id, error: ruleError.message });
        }
      }

      return res.json({ success: true, data: { executedCount, errors } });
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

  private async describeAction(actionType: string, actionParams: any, userId: number): Promise<any> {
    switch (actionType) {
      case 'allocate_savings': {
        const amount = actionParams.amount || 10;
        const savingsConfig = await SavingsConfig.findOne({
          where: { userId, isActive: true }
        });
        if (savingsConfig?.targetAccountId) {
          const account = await Account.findOne({
            where: { id: savingsConfig.targetAccountId, userId }
          });
          if (account) {
            return { wouldDo: `Move ${amount} to account "${account.name}"`, accountId: account.id };
          }
        }
        return { wouldDo: `Move ${amount} to savings (no active target account configured)` };
      }
      case 'send_notification':
        return { wouldDo: `Send notification "${actionParams.title || 'Automation Alert'}"` };
      case 'create_transaction':
        return { wouldDo: `Create expense "${actionParams.description || 'Automated expense'}" for ${actionParams.amount ?? '(no amount set)'}` };
      case 'mark_paid': {
        // Ownership check even in the dry run — do not leak other users' bills.
        const bill = await Bill.findOne({ where: { id: actionParams.billId, userId } });
        if (bill) {
          return { wouldDo: `Mark bill "${bill.name}" as paid`, billId: bill.id };
        }
        return { wouldDo: 'Mark bill as paid (bill not found)' };
      }
      default:
        return { wouldDo: 'Unknown action' };
    }
  }

  private async executeAction(actionType: string, actionParams: any, userId: number): Promise<any> {
    switch (actionType) {
      case 'allocate_savings': {
        const amount = Number(actionParams.amount || 10);
        if (!Number.isFinite(amount) || amount <= 0) {
          throw Object.assign(new Error('Automation amount must be a positive number'), { statusCode: 400 });
        }
        const savingsConfig = await SavingsConfig.findOne({
          where: { userId, isActive: true }
        });

        if (savingsConfig?.targetAccountId) {
          // Scoped by userId — the config's account reference must belong
          // to the caller before any balance is touched.
          const account = await Account.findOne({
            where: { id: savingsConfig.targetAccountId, userId }
          });
          if (account) {
            const balance = parseFloat(account.balance.toString());
            await account.update({ balance: Math.round((balance + amount) * 100) / 100 });
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
        const amount = Number(actionParams.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          throw Object.assign(new Error('Automation amount must be a positive number'), { statusCode: 400 });
        }
        const expense = await Expense.create({
          userId,
          description: actionParams.description || 'Automated expense',
          amount,
          category: actionParams.category || 'Other',
          date: new Date(),
          note: actionParams.note
        } as any);
        return { expenseId: expense.id };
      }
      case 'mark_paid': {
        // Scoped by userId — a user-supplied billId must never mark
        // another user's bill as paid.
        const bill = await Bill.findOne({ where: { id: actionParams.billId, userId } });
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