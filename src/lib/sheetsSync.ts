// Google Sheets sync. The real fetch is here for when OAuth is wired later; for
// the demo we use getDemoSyncPulse() to simulate a live financial sync so the
// roadmap can visibly react to "your latest numbers".

export interface SyncData {
  totalIncome: number;
  totalExpenses: number;
  surplus: number;
}

// Real sync — used once Google OAuth is connected.
export async function fetchSheetData(
  accessToken: string,
  spreadsheetId: string,
): Promise<SyncData | null> {
  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:B100`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const rows: [string, string][] = data.values ?? [];
    let totalIncome = 0;
    let totalExpenses = 0;
    for (const [label, amount] of rows) {
      const val = parseFloat(amount);
      if (isNaN(val)) continue;
      if (/income/i.test(label)) totalIncome += val;
      if (/expense|cost|bill|rent|subscription/i.test(label)) totalExpenses += val;
    }
    return { totalIncome, totalExpenses, surplus: totalIncome - totalExpenses };
  } catch {
    return null;
  }
}

// Demo sync — simulates a Sheets response. Ranges are chosen so the surplus is
// sometimes positive (roadmap advances) and sometimes negative (risk flares).
export function getDemoSyncPulse(): SyncData {
  const totalIncome = 1800 + Math.random() * 400;
  const totalExpenses = 1500 + Math.random() * 500;
  return { totalIncome, totalExpenses, surplus: totalIncome - totalExpenses };
}
