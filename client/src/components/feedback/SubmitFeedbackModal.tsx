import React, { useState } from "react";
import {
  X,
  Send,
  Loader2,
  Sparkles,
  Building,
  Cpu,
  HeartHandshake,
  Workflow,
  Lightbulb,
} from "lucide-react";
import api from "../../api/axios";
import toast from "react-hot-toast";
import { useAuth } from "../../../context/AuthContext";

interface SubmitFeedbackModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES = [
  {
    label: "Workplace & Facility",
    icon: Building,
    description: "Office amenities, seating, cafeteria, environment",
  },
  {
    label: "Process & Operations",
    icon: Workflow,
    description: "Workflows, reporting, policies, daily operations",
  },
  {
    label: "IT & Tools",
    icon: Cpu,
    description: "Software, hardware, devices, IT infrastructure",
  },
  {
    label: "HR & Culture",
    icon: HeartHandshake,
    description: "Team activities, engagement, appraisal, well-being",
  },
  {
    label: "General",
    icon: Lightbulb,
    description: "Any other suggestions, ideas, or workplace thoughts",
  },
];

const SubmitFeedbackModal: React.FC<SubmitFeedbackModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error("Please fill in both title and description");
      return;
    }

    setLoading(true);
    try {
      await api.post("/feedback", {
        title: title.trim(),
        category,
        description: description.trim(),
      });
      toast.success("Feedback submitted successfully! Thank you.");
      setTitle("");
      setDescription("");
      setCategory("General");
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to submit feedback");
    } finally {
      setLoading(false);
    }
  };

  const displayName = user?.name || user?.email?.split("@")[0] || "Team Member";
  const displayRole = user?.role === "ADMIN" ? "Administrator" : "Employee";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 sm:p-6 bg-slate-50/80 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Submit Feedback / Suggestion
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Share your ideas to improve workplace culture, tools & processes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* User attribution pill */}
          <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-100 flex items-center justify-between text-xs">
            <span className="text-slate-600">
              Submitting as:{" "}
              <strong className="text-slate-900 font-semibold">{displayName}</strong>
            </span>
            <span className="px-2 py-0.5 rounded-full font-bold bg-indigo-100/80 text-indigo-700 uppercase tracking-wider text-[10px]">
              {displayRole}
            </span>
          </div>

          {/* Category Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Category
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = category === cat.label;
                return (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => setCategory(cat.label)}
                    className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                      isSelected
                        ? "bg-indigo-50/80 border-indigo-500 text-indigo-900 ring-2 ring-indigo-500/20 shadow-xs"
                        : "bg-slate-50/60 border-slate-200/80 text-slate-700 hover:bg-slate-100/60 hover:border-slate-300"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        isSelected ? "text-indigo-600" : "text-slate-400"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{cat.label}</p>
                      <p className="text-[10px] text-slate-500 line-clamp-1">
                        {cat.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subject / Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Subject / Idea Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Introduce dual monitors for research department"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
              maxLength={120}
            />
            <div className="flex justify-end mt-1 text-[11px] text-slate-400">
              {title.length} / 120
            </div>
          </div>

          {/* Detailed Feedback */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Detailed Suggestion / Feedback <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain the background, why this is valuable, or how you propose implementing it..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none placeholder:text-slate-400"
              maxLength={1000}
            />
            <div className="flex justify-end mt-1 text-[11px] text-slate-400">
              {description.length} / 1000
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3 pt-3 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim() || !description.trim()}
              className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-medium shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {loading ? "Submitting..." : "Submit Suggestion"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SubmitFeedbackModal;
