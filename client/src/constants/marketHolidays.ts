// Official Indian Market Holidays (NSE / BSE / D&S Investment)

export interface MarketHoliday {
  date: string; // YYYY-MM-DD
  day: string; // Day of week
  name: string; // Occasion description
  isWeekend?: boolean;
}

export const MARKET_HOLIDAYS: MarketHoliday[] = [
  // Q4 FY 2025-26
  { date: "2026-01-15", day: "Thursday", name: "Municipal Corporation Election - Maharashtra", isWeekend: false },
  { date: "2026-01-26", day: "Monday", name: "Republic Day", isWeekend: false },
  { date: "2026-02-15", day: "Sunday", name: "Mahashivratri", isWeekend: true },
  { date: "2026-03-03", day: "Tuesday", name: "Holi", isWeekend: false },
  { date: "2026-03-21", day: "Saturday", name: "Id-Ul-Fitr (Ramadan Eid)", isWeekend: false },
  { date: "2026-03-26", day: "Thursday", name: "Shri Ram Navami", isWeekend: false },
  { date: "2026-03-31", day: "Tuesday", name: "Shri Mahavir Jayanti", isWeekend: false },

  // FY 2026-27 (April 1, 2026 to March 31, 2027)
  { date: "2026-04-03", day: "Friday", name: "Good Friday", isWeekend: false },
  { date: "2026-04-14", day: "Tuesday", name: "Dr. Baba Saheb Ambedkar Jayanti", isWeekend: false },
  { date: "2026-05-01", day: "Friday", name: "Maharashtra Day", isWeekend: false },
  { date: "2026-05-28", day: "Thursday", name: "Bakri Id", isWeekend: false },
  { date: "2026-06-26", day: "Friday", name: "Muharram", isWeekend: false },
  { date: "2026-08-15", day: "Saturday", name: "Independence Day", isWeekend: false },
  { date: "2026-09-14", day: "Monday", name: "Ganesh Chaturthi", isWeekend: false },
  { date: "2026-10-02", day: "Friday", name: "Mahatma Gandhi Jayanti", isWeekend: false },
  { date: "2026-10-20", day: "Tuesday", name: "Dussehra", isWeekend: false },
  { date: "2026-11-08", day: "Sunday", name: "Diwali Laxmi Pujan (Muhurat Trading)", isWeekend: true },
  { date: "2026-11-10", day: "Tuesday", name: "Diwali-Balipratipada", isWeekend: false },
  { date: "2026-11-24", day: "Tuesday", name: "Prakash Gurpurb Sri Guru Nanak Dev", isWeekend: false },
  { date: "2026-12-25", day: "Friday", name: "Christmas", isWeekend: false },
];

/**
 * Fast lookup map for quick calendar checks (YYYY-MM-DD -> MarketHoliday)
 */
export const MARKET_HOLIDAYS_MAP = new Map<string, MarketHoliday>(
  MARKET_HOLIDAYS.map((h) => [h.date, h])
);

/**
 * Check if a date string or object is a market holiday
 */
export const getMarketHoliday = (dateStrOrObj: string | Date): MarketHoliday | null => {
  let dateStr = "";
  if (typeof dateStrOrObj === "string") {
    dateStr = dateStrOrObj.split("T")[0];
  } else if (dateStrOrObj instanceof Date) {
    dateStr = `${dateStrOrObj.getFullYear()}-${String(dateStrOrObj.getMonth() + 1).padStart(2, "0")}-${String(dateStrOrObj.getDate()).padStart(2, "0")}`;
  }
  return MARKET_HOLIDAYS_MAP.get(dateStr) || null;
};

/**
 * Calculates Indian Financial Year range for any given date
 * (April 1 to March 31)
 */
export const getFinancialYear = (dateInput: Date = new Date()) => {
  const d = new Date(dateInput);
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-12

  let startYear: number, endYear: number;
  if (month >= 4) {
    // April to December
    startYear = year;
    endYear = year + 1;
  } else {
    // January to March
    startYear = year - 1;
    endYear = year;
  }

  const startDate = new Date(startYear, 3, 1, 0, 0, 0, 0); // April 1, 00:00:00
  const endDate = new Date(endYear, 2, 31, 23, 59, 59, 999); // March 31, 23:59:59
  const label = `FY ${startYear}-${String(endYear).slice(-2)}`;
  const fullLabel = `FY ${startYear}-${endYear} (Apr - Mar)`;

  return {
    startYear,
    endYear,
    startDate,
    endDate,
    label,
    fullLabel,
  };
};

/**
 * Returns all 20 official market holidays from the circular
 */
export const getHolidaysForFinancialYear = (_fyStartYear = 2026): MarketHoliday[] => {
  return MARKET_HOLIDAYS;
};
