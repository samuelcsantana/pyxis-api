export interface ExportStorage {
  writeCsv(key: string, fileName: string, lines: AsyncIterable<string>): Promise<void>;
  downloadUrl(key: string, seconds: number): Promise<string>;
}

export interface ExportDispatcher {
  dispatch(exportId: string): Promise<void>;
}

export const EXPORT_STORAGE = Symbol('ExportStorage');
export const EXPORT_DISPATCHER = Symbol('ExportDispatcher');
