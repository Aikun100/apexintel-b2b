import ExcelJS from 'exceljs';
import path from 'node:path';

/**
 * Exports enriched B2B leads to a professionally styled Excel spreadsheet.
 * @param {Array<object>} records
 * @param {string} outputPath
 * @param {string} [sheetName='Verified B2B Leads']
 * @returns {Promise<string>}
 */
export async function exportToExcel(records, outputPath, sheetName = 'Verified B2B Leads') {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Autonomous Lead Engine';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  sheet.columns = [
    { header: 'Company Name', key: 'name', width: 26 },
    { header: 'Category / Niche', key: 'category', width: 20 },
    { header: 'City', key: 'city', width: 16 },
    { header: 'State / Region', key: 'state', width: 14 },
    { header: 'Primary Phone', key: 'phone', width: 18 },
    { header: 'Verified Email', key: 'email', width: 28 },
    { header: 'Website', key: 'website', width: 30 },
    { header: 'Tech Stack', key: 'techStack', width: 22 },
    { header: 'SEO / Site Issues', key: 'issues', width: 32 },
    { header: 'Growth Opportunities', key: 'opportunities', width: 36 },
    { header: 'LinkedIn', key: 'linkedin', width: 26 }
  ];

  // Style Header Row
  const headerRow = sheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' } // Slate 800
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Populate Data Rows
  records.forEach((rec, idx) => {
    const row = sheet.addRow({
      name: rec.name || 'N/A',
      category: rec.category || 'General',
      city: rec.city || '',
      state: rec.state || '',
      phone: rec.primaryPhone || rec.phone || '',
      email: rec.primaryEmail || rec.email || '',
      website: rec.website || '',
      techStack: Array.isArray(rec.techStack) ? rec.techStack.join(', ') : (rec.techStack || ''),
      issues: Array.isArray(rec.issues) ? rec.issues.join('; ') : (rec.issues || ''),
      opportunities: Array.isArray(rec.opportunities) ? rec.opportunities.join('; ') : (rec.opportunities || ''),
      linkedin: (rec.socials && rec.socials.linkedin) || rec.linkedin || ''
    });

    row.height = 22;
    // Alternate row coloring (Zebra striping)
    if (idx % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' } // Slate 50
        };
      });
    }

    row.eachCell((cell) => {
      cell.font = { name: 'Segoe UI', size: 10 };
      cell.alignment = { vertical: 'middle' };
    });
  });

  const resolvedPath = path.resolve(outputPath);
  await workbook.xlsx.writeFile(resolvedPath);
  return resolvedPath;
}
