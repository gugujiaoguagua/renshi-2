export type XlsxCellValue = string | number | boolean | Date | null | undefined;

type XlsxSheet = {
  name: string;
  rows: XlsxCellValue[][];
};

type DownloadXlsxOptions = {
  fileName: string;
  sheetName?: string;
  headers: string[];
  rows: XlsxCellValue[][];
  emptyMessage?: string;
  allowEmpty?: boolean;
  saveAs?: boolean;
};

function normalizeFileName(fileName: string) {
  const cleaned = fileName.replace(/[\\/:*?"<>|]/g, '_').trim() || '考勤导出';
  return /\.xlsx$/i.test(cleaned) ? cleaned : `${cleaned.replace(/\.[^.]+$/, '')}.xlsx`;
}

function normalizeSheetName(name: string) {
  return (name.replace(/[\\/?*[\]:]/g, '').trim() || '数据').slice(0, 31);
}

function normalizeCell(value: XlsxCellValue) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value;
  return value;
}

function columnWidth(values: XlsxCellValue[]) {
  const maxLength = values.reduce((max, value) => {
    const text = String(normalizeCell(value) ?? '').replace(/\n/g, ' ');
    const units = Array.from(text).reduce((sum, char) => sum + (/[ -~]/.test(char) ? 0.6 : 1), 0);
    return Math.max(max, units);
  }, 8);
  return { wch: Math.min(Math.max(Math.ceil(maxLength) + 3, 10), 36) };
}

async function writeWorkbook(fileName: string, sheets: XlsxSheet[], saveAs = false) {
  const safeFileName = normalizeFileName(fileName);
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();

  sheets.forEach(sheet => {
    const normalizedRows = sheet.rows.map(row => row.map(normalizeCell));
    const worksheet = XLSX.utils.aoa_to_sheet(normalizedRows);
    const columnCount = Math.max(0, ...normalizedRows.map(row => row.length));
    worksheet['!cols'] = Array.from({ length: columnCount }, (_, index) => columnWidth(sheet.rows.map(row => row[index])));
    XLSX.utils.book_append_sheet(workbook, worksheet, normalizeSheetName(sheet.name));
  });

  const content = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer | Uint8Array;
  const bytes = content instanceof Uint8Array ? content : new Uint8Array(content);
  if (!bytes.byteLength) throw new Error('生成的 Excel 内容为空');

  if (saveAs) {
    const picker = (window as any).showSaveFilePicker;
    if (typeof picker !== 'function') {
      throw new Error('当前浏览器不支持选择保存位置');
    }

    let handle: any = null;
    try {
      handle = await picker({
        suggestedName: safeFileName,
        types: [{
          description: 'Excel 工作簿',
          accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
        }],
      });
    } catch (error: any) {
      if (error?.name === 'AbortError') return false;
      throw error;
    }

    let writable: any = null;
    try {
      writable = await handle.createWritable();
      await writable.write(bytes);
      await writable.close();
      return true;
    } catch (error) {
      try {
        await writable?.abort?.();
      } catch {
        // Ignore abort failures; the caller reports the original save error.
      }
      throw error;
    }
  }

  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeFileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export async function downloadAttendanceXlsx({
  fileName,
  sheetName,
  headers,
  rows,
  emptyMessage = '没有可导出的数据',
  allowEmpty = false,
  saveAs = false,
}: DownloadXlsxOptions) {
  if (!rows.length && !allowEmpty) {
    window.alert(emptyMessage);
    return false;
  }

  try {
    return await writeWorkbook(fileName, [{
      name: sheetName || fileName.replace(/\.xlsx$/i, ''),
      rows: [headers, ...rows],
    }], saveAs);
  } catch (error) {
    window.alert(error instanceof Error ? `导出失败：${error.message}` : '导出失败，请稍后重试');
    return false;
  }
}

export function textCell(value: unknown) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'boolean') return value ? '有' : '无';
  return String(value);
}
