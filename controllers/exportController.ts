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
        headers = ['ID', 'Amount', 'Type', 'Year', 'Month', 'Category', 'Note', 'Created At'];
      } else {
        data = await Expense.findAll({ where, order: [['date', 'DESC']] });
        // Expenses carry a description — exporting without it lost the most
        // important column and made round-trip imports lose their labels.
        headers = ['ID', 'Amount', 'Description', 'Category', 'Date', 'Note', 'Created At'];
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

      // `parsed` excludes the header row, so iterate from 0 — starting at 1
      // silently skipped the first data row of every import.
      for (let i = 0; i < parsed.length; i++) {
        const row = parsed[i];
        try {
          // Accept both `category` and the legacy template's `category_id`.
          const category = row.category || row.category_id || 'Other';
          const amount = Number(row.amount);
          if (!Number.isFinite(amount) || amount <= 0) {
            throw new Error('amount must be a positive number');
          }
          if (row.type === 'income') {
            // Book the income into the period its row describes, not
            // unconditionally the current month.
            const rowDate = row.date ? new Date(row.date) : new Date();
            if (isNaN(rowDate.getTime())) {
              throw new Error('invalid date');
            }
            await Income.create({
              userId: (req as any).userId,
              amount,
              type: 'monthly',
              year: rowDate.getFullYear(),
              month: rowDate.toLocaleString('default', { month: 'long' }),
              category,
              note: row.note
            } as any);
            imported++;
          } else {
            const rowDate = row.date ? new Date(row.date) : new Date();
            if (isNaN(rowDate.getTime())) {
              throw new Error('invalid date');
            }
            await Expense.create({
              userId: (req as any).userId,
              // The template has no `description` column, so fall back to the
              // note (then the category) instead of a generic placeholder —
              // imported rows stayed searchable and identifiable.
              description: row.description || row.note || category,
              amount,
              category,
              date: rowDate,
              note: row.note
            } as any);
            imported++;
          }
        } catch (e: any) {
          // +2 accounts for the header row and 1-based row numbering
          errors.push(`Row ${i + 2}: ${e.message}`);
        }
      }

      return res.json({ success: true, data: { imported, errors } });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getTemplate(req: Request, res: Response) {
    // Header matches what parseCSV reads (category). Legacy templates with
    // `category_id` are still accepted by the importer.
    const headers = 'type,amount,category,date,note\n';
    const sample = 'income,1000,Salary,2024-01-15,Monthly salary\n';
    const sample2 = 'expense,50,Groceries,2024-01-20,Weekly groceries';

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=import_template.csv');
    return res.send(headers + sample + sample2);
  }

  /** CSV header → model attribute. "Created At" previously derived to a
   * nonexistent `createdat` key, leaving that column blank in exports. */
  private columnKey(header: string): string {
    const map: Record<string, string> = {
      'id': 'id',
      'amount': 'amount',
      'type': 'type',
      'year': 'year',
      'month': 'month',
      'category': 'category',
      'category id': 'category',
      'category_id': 'category',
      'date': 'date',
      'note': 'note',
      'created at': 'createdAt',
      'created_at': 'createdAt'
    };
    return map[header.toLowerCase().trim()] ?? header.toLowerCase().replace(/\s+/g, '');
  }

  private arrayToCSV(data: any[], headers: string[]): string {
    const headerRow = headers.join(',');
    const rows = data.map(item => {
      return headers.map(h => {
        const key = this.columnKey(h);
        const value = item[key] ?? '';
        const raw = String(value);
        // CSV formula injection: a cell starting with =, +, - or @ executes as
        // a formula when the export is opened in Excel/Sheets. Prefix with a
        // single quote so it is treated as text (OWASP recommendation).
        const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
        return `"${safe.replace(/"/g, '""')}"`;
      }).join(',');
    });
    return [headerRow, ...rows].join('\n');
  }

  /** RFC-4180-style CSV parse: quoted fields may contain commas and escaped
   * double quotes. The previous split(',') corrupted any quoted value that
   * contained a comma. */
  private parseCSV(content: string): any[] {
    const rows: string[][] = [];
    let field = '';
    let row: string[] = [];
    let inQuotes = false;

    for (let i = 0; i < content.length; i++) {
      const ch = content[i];
      if (inQuotes) {
        if (ch === '"') {
          if (content[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field.trim());
        field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && content[i + 1] === '\n') i++;
        row.push(field.trim());
        field = '';
        if (row.some(v => v !== '')) rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
    // Final field/row without a trailing newline.
    row.push(field.trim());
    if (row.some(v => v !== '')) rows.push(row);

    if (rows.length === 0) return [];
    const headers = rows[0].map(h => h.trim().replace(/^"|"$/g, ''));

    return rows.slice(1).map(values => {
      const obj: any = {};
      headers.forEach((h, i) => {
        obj[h] = (values[i] ?? '').replace(/^"|"$/g, '');
      });
      return obj;
    });
  }
}

export default new ExportController();