import React, { useState, useMemo, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  Calendar,
  Sparkles,
  ShieldAlert,
  X,
  Loader2,
  Edit3,
  ChevronRight,
  Clock,
  Filter,
} from "lucide-react";
import { useHolidays } from "../hooks/useHolidays";
import type { HolidayItem } from "../hooks/useHolidays";
import { useAuth } from "../../context/AuthContext";

const CATEGORY_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  NATIONAL: {
    label: "National Holiday",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  FESTIVAL: {
    label: "Festival Observance",
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
    dot: "bg-purple-500",
  },
  MARKET: {
    label: "Trading Holiday",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    dot: "bg-blue-500",
  },
  COMPANY: {
    label: "Company Declared",
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200",
    dot: "bg-indigo-500",
  },
  OPTIONAL: {
    label: "Optional Holiday",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
};

const getCategoryStyle = (cat?: string) => {
  return CATEGORY_CONFIG[cat || "MARKET"] || CATEGORY_CONFIG.MARKET;
};

const Holidays: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const { holidays, loading, addHoliday, updateHoliday, deleteHoliday } = useHolidays();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedYear, setSelectedYear] = useState("ALL");

  const rightColRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const [tableMaxHeight, setTableMaxHeight] = useState<number | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<HolidayItem | null>(null);
  const [holidayToDelete, setHolidayToDelete] = useState<HolidayItem | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    date: "",
    category: "MARKET",
    description: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Computed metrics
  const totalHolidays = holidays.length;
  const weekdayHolidays = holidays.filter((h) => !h.isWeekend).length;
  const weekendHolidays = holidays.filter((h) => h.isWeekend).length;
  const customHolidaysCount = holidays.filter((h) => !h.isSystemDefault).length;

  // Extract unique available years from dates
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    holidays.forEach((h) => {
      if (h.date) {
        years.add(h.date.split("-")[0]);
      }
    });
    return Array.from(years).sort();
  }, [holidays]);

  // Filtered list
  const filteredHolidays = useMemo(() => {
    return holidays.filter((h) => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        h.name.toLowerCase().includes(q) ||
        h.date.includes(q) ||
        h.day.toLowerCase().includes(q) ||
        (h.description && h.description.toLowerCase().includes(q));

      const matchesCat =
        selectedCategory === "ALL" || h.category === selectedCategory;

      const matchesYear =
        selectedYear === "ALL" || h.date.startsWith(selectedYear);

      return matchesSearch && matchesCat && matchesYear;
    });
  }, [holidays, searchTerm, selectedCategory, selectedYear]);

  // Upcoming holidays calculation (from today onwards)
  const upcomingHolidays = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    return holidays
      .filter((h) => h.date >= todayStr)
      .slice(0, 4);
  }, [holidays]);

  // Category distribution
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    holidays.forEach((h) => {
      const cat = h.category || "MARKET";
      stats[cat] = (stats[cat] || 0) + 1;
    });
    return stats;
  }, [holidays]);

  // Synchronize left table container height with the right column (so it ends precisely at Connected Features level)
  useEffect(() => {
    const updateHeight = () => {
      if (window.innerWidth >= 1024 && rightColRef.current) {
        const rightHeight = rightColRef.current.offsetHeight;
        const controlsHeight = controlsRef.current ? controlsRef.current.offsetHeight + 16 : 72;
        const targetHeight = Math.max(380, rightHeight - controlsHeight);
        setTableMaxHeight(targetHeight);
      } else {
        setTableMaxHeight(560);
      }
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    if (rightColRef.current) observer.observe(rightColRef.current);
    if (controlsRef.current) observer.observe(controlsRef.current);
    window.addEventListener("resize", updateHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [holidays, upcomingHolidays]);

  const handleOpenAddModal = () => {
    setEditingHoliday(null);
    setFormData({
      name: "",
      date: new Date().toISOString().split("T")[0],
      category: "MARKET",
      description: "",
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (holiday: HolidayItem) => {
    setEditingHoliday(holiday);
    setFormData({
      name: holiday.name,
      date: holiday.date,
      category: holiday.category || "MARKET",
      description: holiday.description || "",
    });
    setIsAddModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.date.trim()) return;

    try {
      setIsSubmitting(true);
      if (editingHoliday) {
        await updateHoliday(editingHoliday._id, {
          name: formData.name.trim(),
          date: formData.date.trim(),
          category: formData.category,
          description: formData.description.trim(),
        });
      } else {
        await addHoliday({
          name: formData.name.trim(),
          date: formData.date.trim(),
          category: formData.category,
          description: formData.description.trim(),
        });
      }
      setIsAddModalOpen(false);
      setEditingHoliday(null);
    } catch {
      // Toast handled by hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!holidayToDelete) return;
    try {
      setIsDeleting(true);
      await deleteHoliday(holidayToDelete._id, holidayToDelete.name);
      setHolidayToDelete(null);
    } catch {
      // Toast handled by hook
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper for computed day preview in modal
  const modalDateInfo = useMemo(() => {
    if (!formData.date || !/^\d{4}-\d{2}-\d{2}$/.test(formData.date)) return null;
    const [y, m, d] = formData.date.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayName = days[dt.getDay()];
    const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
    return { dayName, isWeekend };
  }, [formData.date]);

  return (
    <div className="animate-fade-in space-y-6 max-w-[1600px] mx-auto pb-10">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="page-title">Holidays</h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-extrabold bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs">
              <CalendarDays className="w-3.5 h-3.5" />
              Corporate & Market Calendar
            </span>
          </div>
          <p className="page-subtitle">
            Configure company holidays, manage official market trading schedules, and maintain public holiday rosters.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenAddModal}
            className="btn-primary inline-flex items-center justify-center gap-2 text-xs sm:text-sm py-2.5 px-4 shadow-sm cursor-pointer self-start sm:self-auto hover:shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Holiday</span>
          </button>
        )}
      </div>

      {/* 4 Metric Cards Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Holidays</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <CalendarDays className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">{totalHolidays}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Scheduled corporate off-days</span>
        </div>

        <div className="card p-5 bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Weekday Holidays</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">{weekdayHolidays}</p>
          <span className="text-[11px] text-emerald-600 font-medium mt-1 block">Business working days off</span>
        </div>

        <div className="card p-5 bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Weekend Observances</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">{weekendHolidays}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Saturday & Sunday observances</span>
        </div>

        <div className="card p-5 bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Company Declared</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">{customHolidaysCount}</p>
          <span className="text-[11px] text-indigo-600 font-medium mt-1 block">Custom declared holidays</span>
        </div>
      </div>

      {/* Main Two-Column Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Primary Column: Holiday Directory (8 Cols) */}
        <div className="lg:col-span-8 space-y-4 min-h-0">
          {/* Controls Bar: Search & Filters */}
          <div
            ref={controlsRef}
            className="card p-3.5 sm:p-4 flex flex-col md:flex-row items-center justify-between gap-3 bg-white border border-slate-200/80 shadow-xs"
          >
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search holiday name or date..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 focus:bg-white transition-all text-slate-800"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between md:justify-end gap-2.5 w-full md:w-auto">
              {/* Year Filter */}
              {availableYears.length > 1 && (
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-purple-500"
                >
                  <option value="ALL">All Years</option>
                  {availableYears.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              )}

              {/* Category Filter */}
              <div className="flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-purple-500"
                >
                  <option value="ALL">All Categories</option>
                  <option value="MARKET">Trading Holiday</option>
                  <option value="NATIONAL">National Holiday</option>
                  <option value="FESTIVAL">Festival</option>
                  <option value="COMPANY">Company Declared</option>
                  <option value="OPTIONAL">Optional</option>
                </select>
              </div>

              {/* Holiday Counter Badge */}
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/80 shrink-0">
                {filteredHolidays.length} {filteredHolidays.length === 1 ? "Holiday" : "Holidays"}
              </span>
            </div>
          </div>

          {/* Directory Content */}
          {loading ? (
            <div className="card p-16 flex flex-col items-center justify-center gap-3 bg-white border border-slate-200/80">
              <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
              <p className="text-xs font-medium text-slate-500">Loading holiday directory...</p>
            </div>
          ) : filteredHolidays.length === 0 ? (
            <div className="card p-12 text-center bg-white border border-dashed border-slate-200 rounded-2xl">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <CalendarDays className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No holidays match your filter</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {searchTerm || selectedCategory !== "ALL" || selectedYear !== "ALL"
                  ? "Try clearing your search or category filter to view all holidays."
                  : "No holidays have been registered yet. Click 'Add New Holiday' to create one."}
              </p>
            </div>
          ) : (
            /* DETAILED TABLE VIEW (SCROLLABLE & CONSTRAINED TO CONNECTED FEATURES LEVEL) */
            <div
              className="card overflow-hidden bg-white border border-slate-200/80 shadow-xs rounded-2xl flex flex-col"
              style={{
                maxHeight: tableMaxHeight ? `${tableMaxHeight}px` : "620px",
                height: tableMaxHeight ? `${tableMaxHeight}px` : "620px",
              }}
            >
              <div className="overflow-y-auto overflow-x-auto flex-1 min-h-0">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider shadow-2xs">
                    <tr>
                      <th className="py-3 px-4 bg-slate-50">Date</th>
                      <th className="py-3 px-4 bg-slate-50">Day</th>
                      <th className="py-3 px-4 bg-slate-50">Holiday Occasion</th>
                      <th className="py-3 px-4 bg-slate-50">Category</th>
                      <th className="py-3 px-4 text-center bg-slate-50">Type</th>
                      {isAdmin && <th className="py-3 px-4 text-right bg-slate-50">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {filteredHolidays.map((holiday) => {
                      const catStyle = getCategoryStyle(holiday.category);
                      const d = new Date(holiday.date);
                      const formattedDate = d.toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      });

                      return (
                        <tr key={holiday._id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {formattedDate}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-600 whitespace-nowrap">
                            {holiday.day}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-extrabold text-slate-900 block">{holiday.name}</span>
                            {holiday.description && (
                              <span className="text-[11px] text-slate-500 line-clamp-1">{holiday.description}</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${catStyle.dot}`} />
                              {catStyle.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                holiday.isWeekend
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              }`}
                            >
                              {holiday.isWeekend ? "Weekend" : "Weekday"}
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleOpenEditModal(holiday)}
                                  className="p-1 rounded-md text-slate-400 hover:text-purple-700 hover:bg-purple-50 transition-colors cursor-pointer"
                                  title="Edit holiday"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setHolidayToDelete(holiday)}
                                  className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Delete holiday"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Calendar Intelligence & Insights Sidebar (4 Cols - Zero Negative Space) */}
        <div ref={rightColRef} className="lg:col-span-4 space-y-5">
          {/* Card 1: Upcoming Holidays Countdown */}
          <div className="card p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Upcoming Holidays</h3>
                  <p className="text-[11px] text-slate-500">Scheduled upcoming off-days</p>
                </div>
              </div>
              <span className="text-xs font-black text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                {upcomingHolidays.length} Soon
              </span>
            </div>

            {upcomingHolidays.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-3 text-center">No upcoming holidays scheduled this year</p>
            ) : (
              <div className="space-y-3">
                {upcomingHolidays.map((h) => {
                  const d = new Date(h.date);
                  const formattedDate = d.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });
                  const catStyle = getCategoryStyle(h.category);

                  return (
                    <div
                      key={h._id}
                      className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 hover:border-purple-200 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-center bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shrink-0">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">
                            {d.toLocaleDateString("en-US", { weekday: "short" })}
                          </span>
                          <span className="text-sm font-black text-slate-900 block leading-tight">
                            {d.getDate()}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs font-extrabold text-slate-900 block line-clamp-1">
                            {h.name}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {formattedDate} • {h.day}
                          </span>
                        </div>
                      </div>

                      <span className={`w-2 h-2 rounded-full ${catStyle.dot} shrink-0`} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Card 2: Category Breakdown */}
          <div className="card p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Holiday Breakdown</h3>
                  <p className="text-[11px] text-slate-500">By classification type</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                const count = categoryStats[key] || 0;
                const pct = totalHolidays > 0 ? Math.round((count / totalHolidays) * 100) : 0;

                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <span className={`w-2 h-2 rounded-full ${config.dot}`} />
                        <span>{config.label}</span>
                      </div>
                      <span className="text-slate-600 font-semibold text-[11px]">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${config.dot} rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card 3: Connected Modules Shortcut */}
          <div className="card p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-1">
              Connected Features
            </span>

            <Link
              to="/attendance"
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors group border border-transparent hover:border-slate-200"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 block group-hover:text-purple-700 transition-colors">
                    Attendance Calendar
                  </span>
                  <span className="text-[10px] text-slate-400">View live monthly holiday markers</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </Link>

            <Link
              to="/leave"
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors group border border-transparent hover:border-slate-200"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 block group-hover:text-indigo-600 transition-colors">
                    Leave Management
                  </span>
                  <span className="text-[10px] text-slate-400">Manage employee leave quotas</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </div>

      {/* ADD / EDIT HOLIDAY MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-scale-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingHoliday ? "Edit Holiday" : "Add New Holiday"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingHoliday ? "Update holiday date or details" : "Schedule a corporate or market holiday"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingHoliday(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {/* Date Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Holiday Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 focus:bg-white transition-all font-medium text-slate-900"
                />
                {modalDateInfo && (
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Day: <strong className="text-slate-800">{modalDateInfo.dayName}</strong> •{" "}
                    {modalDateInfo.isWeekend ? (
                      <span className="text-amber-600 font-bold">Weekend Observance</span>
                    ) : (
                      <span className="text-emerald-600 font-bold">Regular Weekday Off</span>
                    )}
                  </span>
                )}
              </div>

              {/* Holiday Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Holiday Occasion / Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ganesh Chaturthi, Diwali, Company Foundation Day..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 focus:bg-white transition-all font-medium text-slate-900"
                />
              </div>

              {/* Category Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Holiday Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 focus:bg-white transition-all text-slate-800"
                >
                  <option value="MARKET">Trading Holiday (NSE/BSE)</option>
                  <option value="NATIONAL">National Holiday (Gazetted)</option>
                  <option value="FESTIVAL">Festival Observance</option>
                  <option value="COMPANY">Company Declared Off-Day</option>
                  <option value="OPTIONAL">Optional / Restricted Holiday</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description / Special Notes <span className="text-slate-400 text-[10px] font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Muhurat Trading timings, official circular references..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 focus:bg-white transition-all text-slate-700 resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingHoliday(null);
                  }}
                  className="btn-secondary text-xs sm:text-sm py-2.5 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !formData.name.trim() || !formData.date.trim()}
                  className="btn-primary text-xs sm:text-sm py-2.5 px-5 flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{editingHoliday ? "Update Holiday" : "Save Holiday"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {holidayToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-scale-in">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Remove Holiday</h3>
                <p className="text-xs text-slate-500">Confirm holiday schedule deletion</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to remove{" "}
              <strong className="text-slate-900 font-bold">"{holidayToDelete.name}"</strong> on{" "}
              <strong className="text-slate-900 font-bold">{holidayToDelete.date}</strong> ({holidayToDelete.day})?
              Once removed, this date will no longer be designated as a holiday in the Attendance Calendar.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setHolidayToDelete(null)}
                disabled={isDeleting}
                className="btn-secondary text-xs sm:text-sm py-2.5 px-4"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="btn-danger text-xs sm:text-sm py-2.5 px-5 flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-md shadow-rose-600/20"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Holidays;
