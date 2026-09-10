import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Income, Expense, Account } from '../models';

class ExportController {
  async exportTransactions(req: Request, res: Response) {
    try {
      const { type, from, to, format } = req.query;
      const where: any = { userId: (req as any).userId };

      if (from || to) {
        where.date = {};
        if (from) where.date[Op.gte] = new Date(from as string);
        if (to) where.date[Op.lte] = new Date(to as string);
      }

      let data: any[] = [];
      let headers: string[] = [];

      if (type === 'income') {
        data = await Income.findAll({ where, order: [['createdAt', 'DESC']] });
        headers = ['ID', 'Amount', 'Category ID', 'Date', 'Note', 'Created At'];
      } else {
        data = await Expense.findAll({ where, order: [['date', 'DESC']] });
        headers = ['ID', 'Amount', 'Category ID', 'Date', 'Note', 'Created At'];
      }

      if (format === 'csv') {
        const csv = this.arrayToCSV(data, headers);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=transactions_${type}_${new Date().toISOString().split('T')[0]}.csv`);
        return res.send(csv);
      }

      return res.json({ success: true, data, headers });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async exportFullData(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;

      const [incomes, expenses, accounts] = await Promise.all([
        Income.findAll({ where: { userId }, order: [['createdAt', 'DESC']] }),
        Expense.findAll({ where: { userId }, order: [['date', 'DESC']] }),
        Account.findAll({ where: { userId, isActive: true } })
      ]);

      const exportData = {
        exportedAt: new Date().toISOString(),
        incomes: incomes.map(i => i.toJSON()),
        expenses: expenses.map(e => e.toJSON()),
        accounts: accounts.map(a => a.toJSON())
      };

      const format = req.query.format;
      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=finance_tracker_export_${new Date().toISOString().split('T')[0]}.json`);
        return res.json(exportData);
      }

      return res.json({ success: true, data: exportData });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async importTransactions(req: Request, res: Response) {
    try {
      const { mode } = req.query;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      const parsed = this.parseCSV(file.buffer.toString());
      const errors: string[] = [];
      let imported = 0;

      for (let i = 1; i < parsed.length; i++) {
        const row = parsed[i];
        try {
          if (row.type === 'income') {
            await Income.create({
              userId: (req as any).userId,
              amount: row.amount,
              type: 'monthly',
              year: new Date().getFullYear(),
              month: new Date().toLocaleString('default', { month: 'long' }),
              category: row.category || 'Other',
              note: row.note
            } as any);
            imported++;
          } else {
            await Expense.create({
              userId: (req as any).userId,
              description: row.description || 'Imported expense',
              amount: row.amount,
              category: row.category || 'Other',
              date: new Date(row.date || new Date().toISOString().split('T')[0]),
              note: row.note
            } as any);
            imported++;
          }
        } catch (e: any) {
          errors.push(`Row ${i + 1}: ${e.message}`);
        }
      }

      return res.json({ success: true, data: { imported, errors } });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getTemplate(req: Request, res: Response) {
    const headers = 'type,amount,category_id,date,note\n';
    const sample = 'income,1000,1,2024-01-15,Monthly salary\n';
    const sample2 = 'expense,50,2,2024-01-20,Groceries';

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=import_template.csv');
    return res.send(headers + sample + sample2);
  }

  private arrayToCSV(data: any[], headers: string[]): string {
    const headerRow = headers.join(',');
    const rows = data.map(item => {
      return headers.map(h => {
        const key = h.toLowerCase().replace(' ', '');
        const value = item[key] || item[h] || '';
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',');
    });
    return [headerRow, ...rows].join('\n');
  }

  private parseCSV(content: string): any[] {
    const lines = content.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const row: any = {};
      headers.forEach((h, i) => {
        row[h] = values[i];
      });
      return row;
    });
  }
}

export default new ExportController();