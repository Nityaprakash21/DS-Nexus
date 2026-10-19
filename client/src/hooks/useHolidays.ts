import { useState, useEffect, useCallback, useMemo } from "react";
import api from "../api/axios";
import toast from "react-hot-toast";
import { MARKET_HOLIDAYS } from "../constants/marketHolidays";

export interface HolidayItem {
  _id: string;
  name: string;
  date: string; // YYYY-MM-DD
  day: string;
  category: "MARKET" | "NATIONAL" | "FESTIVAL" | "COMPANY" | "OPTIONAL" | string;
  description?: string;
  isWeekend?: boolean;
  isSystemDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Fallback initial list from official circular to prevent UI layout shift or empty calendar
const FALLBACK_HOLIDAYS: HolidayItem[] = MARKET_HOLIDAYS.map((h, idx) => ({
  _id: `fallback-holiday-${idx}`,
  name: h.name,
  date: h.date,
  day: h.day,
  category: h.name.includes("Republic") || h.name.includes("Independence") || h.name.includes("Gandhi")
    ? "NATIONAL"
    : h.name.includes("Diwali") || h.name.includes("Holi") || h.name.includes("Eid") || h.name.includes("Christmas")
    ? "FESTIVAL"
    : "MARKET",
  description: "Official Trading & Corporate Holiday",
  isWeekend: Boolean(h.isWeekend),
  isSystemDefault: true,
}));

const HOLIDAYS_UPDATED_EVENT = "ds_nexus_holidays_updated";

export const useHolidays = () => {
  const [holidays, setHolidays] = useState<HolidayItem[]>(FALLBACK_HOLIDAYS);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHolidays = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/holidays");
      if (res.data?.holidays && Array.isArray(res.data.holidays)) {
        setHolidays(res.data.holidays);
      }
    } catch (err: any) {
      console.warn("Error loading holidays from server, using fallback:", err?.message);
      setError(err?.response?.data?.error || err?.message || "Failed to load holidays");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHolidays();

    const handleSync = () => {
      fetchHolidays();
    };

    window.addEventListener(HOLIDAYS_UPDATED_EVENT, handleSync);
    return () => {
      window.removeEventListener(HOLIDAYS_UPDATED_EVENT, handleSync);
    };
  }, [fetchHolidays]);

  const notifyUpdate = () => {
    window.dispatchEvent(new CustomEvent(HOLIDAYS_UPDATED_EVENT));
  };

  // Instant O(1) Map for calendar lookups (YYYY-MM-DD -> HolidayItem)
  const holidayMap = useMemo(() => {
    const map = new Map<string, HolidayItem>();
    holidays.forEach((h) => {
      map.set(h.date, h);
    });
    return map;
  }, [holidays]);

  // Fast helper function: checks if a date is a holiday
  const getHoliday = useCallback(
    (dateStrOrObj: string | Date): HolidayItem | null => {
      let dateStr = "";
      if (typeof dateStrOrObj === "string") {
        dateStr = dateStrOrObj.split("T")[0];
      } else if (dateStrOrObj instanceof Date) {
        dateStr = `${dateStrOrObj.getFullYear()}-${String(dateStrOrObj.getMonth() + 1).padStart(2, "0")}-${String(dateStrOrObj.getDate()).padStart(2, "0")}`;
      }
      return holidayMap.get(dateStr) || null;
    },
    [holidayMap]
  );

  const addHoliday = async (payload: {
    name: string;
    date: string;
    category?: string;
    description?: string;
  }) => {
    try {
      const res = await api.post("/holidays", payload);
      const newHoliday = res.data?.holiday;
      toast.success(res.data?.message || `Holiday "${payload.name}" added successfully`);
      notifyUpdate();
      await fetchHolidays();
      return newHoliday;
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Failed to add holiday";
      toast.error(msg);
      throw err;
    }
  };

  const updateHoliday = async (
    id: string,
    payload: {
      name?: string;
      date?: string;
      category?: string;
      description?: string;
    }
  ) => {
    try {
      const res = await api.put(`/holidays/${id}`, payload);
      const updated = res.data?.holiday;
      toast.success(res.data?.message || "Holiday updated successfully");
      notifyUpdate();
      await fetchHolidays();
      return updated;
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Failed to update holiday";
      toast.error(msg);
      throw err;
    }
  };

  const deleteHoliday = async (id: string, name?: string) => {
    try {
      const res = await api.delete(`/holidays/${id}`);
      toast.success(res.data?.message || `Holiday "${name || ""}" removed`);
      notifyUpdate();
      await fetchHolidays();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Failed to delete holiday";
      toast.error(msg);
      throw err;
    }
  };

  return {
    holidays,
    holidayMap,
    getHoliday,
    loading,
    error,
    refreshHolidays: fetchHolidays,
    addHoliday,
    updateHoliday,
    deleteHoliday,
  };
};
