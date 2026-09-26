import * as XLSX from "xlsx";

export interface ExcelSheetData {
  name: string;
  data: (string | number | null | undefined)[][];
}

export function exportToExcel(filename: string, sheets: ExcelSheetData[]) {
  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.data);
    
    // Auto-fit column widths
    const colWidths = sheet.data.reduce((widths: number[], row) => {
      row.forEach((cell, i) => {
        const str = cell != null ? String(cell) : "";
        widths[i] = Math.max(widths[i] || 10, Math.min(str.length + 3, 50));
      });
      return widths;
    }, []);

    ws["!cols"] = colWidths.map((w) => ({ wch: w }));

    XLSX.utils.book_append_sheet(wb, ws, sheet.name.substring(0, 31));
  }

  const safeName = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, safeName);
}
