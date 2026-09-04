export {};

declare global {
  interface Window {
    XLSX?: {
      read: (data: ArrayBuffer) => { SheetNames: string[]; Sheets: Record<string, unknown> };
      utils: {
        sheet_to_json: <T = Record<string, unknown>>(sheet: unknown, opts?: { defval?: string }) => T[];
      };
    };
  }
}
