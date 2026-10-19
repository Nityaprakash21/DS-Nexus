import { useCallback, useEffect, useState } from "react";
import {
  MessageSquarePlus,
  CheckCircle2,
  Star,
  XCircle,
  Clock,
  Search,
  Building,
  Cpu,
  HeartHandshake,
  Workflow,
  Lightbulb,
  ShieldCheck,
  Trash2,
  MessageSquare,
  MessageSquareQuote,
  Filter,
  Check,
  X,
} from "lucide-react";
import api from "../api/axios";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import Loading from "../components/Loading";
import SubmitFeedbackModal from "../components/feedback/SubmitFeedbackModal";
import { format } from "date-fns";

interface FeedbackItem {
  id: string;
  _id?: string;
  userId: string;
  authorName: string;
  authorRole: "ADMIN" | "EMPLOYEE";
  authorDepartment: string;
  authorEmail?: string;
  title: string;
  category: string;
  description: string;
  status: "PENDING" | "IMPLEMENTED" | "NOT_IMPLEMENTED" | "VALUABLE";
  adminRemark?: string;
  createdAt: string;
  markedAt?: string;
}

interface FeedbackCounts {
  total: number;
  implemented: number;
  valuable: number;
  notImplemented: number;
  pending: number;
}

const CATEGORY_ICONS: Record<string, any> = {
  "Workplace & Facility": Building,
  "Process & Operations": Workflow,
  "IT & Tools": Cpu,
  "HR & Culture": HeartHandshake,
  General: Lightbulb,
};

const Feedback = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [counts, setCounts] = useState<FeedbackCounts>({
    total: 0,
    implemented: 0,
    valuable: 0,
    notImplemented: 0,
    pending: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Modal for admin remark
  const [remarkModal, setRemarkModal] = useState<{
    open: boolean;
    feedbackId: string;
    status: "IMPLEMENTED" | "NOT_IMPLEMENTED" | "VALUABLE" | "PENDING";
    title: string;
    currentRemark: string;
  }>({
    open: false,
    feedbackId: "",
    status: "IMPLEMENTED",
    title: "",
    currentRemark: "",
  });
  const [adminRemarkInput, setAdminRemarkInput] = useState("");

  const fetchFeedbacks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (categoryFilter !== "ALL") params.append("category", categoryFilter);
      if (search.trim()) params.append("search", search.trim());

      const res = await api.get(`/feedback?${params.toString()}`);
      setFeedbacks(res.data.data || []);
      if (res.data.counts) {
        setCounts(res.data.counts);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to load feedbacks");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, search]);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  // Admin mark status
  const handleMarkStatus = async (
    feedbackId: string,
    status: "IMPLEMENTED" | "NOT_IMPLEMENTED" | "VALUABLE" | "PENDING",
    adminRemark?: string
  ) => {
    setUpdatingId(feedbackId);
    try {
      await api.patch(`/feedback/${feedbackId}/status`, {
        status,
        adminRemark: adminRemark !== undefined ? adminRemark : undefined,
      });
      const labelMap = {
        IMPLEMENTED: "Implemented",
        VALUABLE: "Valuable",
        NOT_IMPLEMENTED: "Not Implemented",
        PENDING: "Under Review",
      };
      toast.success(`Marked as ${labelMap[status]}`);
      fetchFeedbacks();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  };

  const openRemarkModal = (
    item: FeedbackItem,
    status: "IMPLEMENTED" | "NOT_IMPLEMENTED" | "VALUABLE" | "PENDING"
  ) => {
    setRemarkModal({
      open: true,
      feedbackId: item.id || item._id!,
      status,
      title: item.title,
      currentRemark: item.adminRemark || "",
    });
    setAdminRemarkInput(item.adminRemark || "");
  };

  const submitRemarkModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remarkModal.feedbackId) return;
    await handleMarkStatus(
      remarkModal.feedbackId,
      remarkModal.status,
      adminRemarkInput.trim()
    );
    setRemarkModal((prev) => ({ ...prev, open: false }));
  };

  // Delete feedback
  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      await api.delete(`/feedback/${id}`);
      toast.success("Feedback deleted");
      fetchFeedbacks();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to delete feedback");
    }
  };

  const statusBadge = (status: FeedbackItem["status"]) => {
    switch (status) {
      case "IMPLEMENTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Implemented
          </span>
        );
      case "VALUABLE":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Star className="w-3.5 h-3.5 fill-amber-400" /> Valuable
          </span>
        );
      case "NOT_IMPLEMENTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" /> Not Implemented
          </span>
        );
      case "PENDING":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Clock className="w-3.5 h-3.5" /> Under Review
          </span>
        );
    }
  };

  if (loading && feedbacks.length === 0) return <Loading />;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="page-title">Feedback & Suggestions</h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Open Channel
            </span>
          </div>
          <p className="page-subtitle">
            Voice ideas to improve operations, facilities, culture, and tools
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center shadow-md shadow-indigo-500/20 active:scale-95 transition-all"
        >
          <MessageSquarePlus className="w-4 h-4" /> Share Feedback
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
        <div
          onClick={() => setStatusFilter("ALL")}
          className={`card card-hover p-4 cursor-pointer transition-all ${statusFilter === "ALL" ? "ring-2 ring-indigo-500 bg-indigo-50/20" : ""
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total
            </span>
            <MessageSquare className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-1 font-mono">
            {counts.total}
          </p>
          <span className="text-[11px] text-slate-400">All submissions</span>
        </div>

        <div
          onClick={() => setStatusFilter("IMPLEMENTED")}
          className={`card card-hover p-4 cursor-pointer transition-all ${statusFilter === "IMPLEMENTED"
              ? "ring-2 ring-emerald-500 bg-emerald-50/30"
              : ""
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
              Implemented
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-700 mt-1 font-mono">
            {counts.implemented}
          </p>
          <span className="text-[11px] text-emerald-600 font-medium">Adopted in org</span>
        </div>

        <div
          onClick={() => setStatusFilter("VALUABLE")}
          className={`card card-hover p-4 cursor-pointer transition-all ${statusFilter === "VALUABLE" ? "ring-2 ring-amber-500 bg-amber-50/30" : ""
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
              Valuable
            </span>
            <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
          </div>
          <p className="text-2xl font-black text-amber-700 mt-1 font-mono">
            {counts.valuable}
          </p>
          <span className="text-[11px] text-amber-600 font-medium">High impact ideas</span>
        </div>

        <div
          onClick={() => setStatusFilter("PENDING")}
          className={`card card-hover p-4 cursor-pointer transition-all ${statusFilter === "PENDING" ? "ring-2 ring-indigo-500 bg-indigo-50/30" : ""
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
              Under Review
            </span>
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-indigo-700 mt-1 font-mono">
            {counts.pending}
          </p>
          <span className="text-[11px] text-indigo-600 font-medium">Awaiting verdict</span>
        </div>

        <div
          onClick={() => setStatusFilter("NOT_IMPLEMENTED")}
          className={`card card-hover p-4 cursor-pointer transition-all col-span-2 sm:col-span-1 ${statusFilter === "NOT_IMPLEMENTED"
              ? "ring-2 ring-rose-500 bg-rose-50/30"
              : ""
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">
              Not Implemented
            </span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-black text-rose-700 mt-1 font-mono">
            {counts.notImplemented}
          </p>
          <span className="text-[11px] text-rose-600 font-medium">Archived / Explored</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by topic, suggestion text, or author name..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-full sm:w-auto"
          >
            <option value="ALL">All Categories</option>
            <option value="Workplace & Facility">Workplace & Facility</option>
            <option value="Process & Operations">Process & Operations</option>
            <option value="IT & Tools">IT & Tools</option>
            <option value="HR & Culture">HR & Culture</option>
            <option value="General">General</option>
          </select>
        </div>
      </div>

      {/* Feedback Cards Feed */}
      {feedbacks.length === 0 ? (
        <div className="card p-12 text-center bg-white border border-dashed border-slate-200 rounded-2xl">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <MessageSquareQuote className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No feedbacks found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {search || statusFilter !== "ALL" || categoryFilter !== "ALL"
              ? "Try clearing filters to see more results."
              : "Be the first to share a suggestion or workplace feedback!"}
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
          >
            Share an Idea
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {feedbacks.map((item) => {
            const CategoryIcon =
              CATEGORY_ICONS[item.category] || Lightbulb;
            const isAuthor =
              item.userId === user?.id || item.userId === user?.userId;
            const canDelete = isAdmin || isAuthor;

            return (
              <div
                key={item.id || item._id}
                className="card card-hover p-5 sm:p-6 transition-all relative overflow-hidden group flex flex-col gap-4"
              >
                {/* Top Line: Author Identity + Status Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar with initial */}
                    <div className="w-10 h-10 rounded-full bg-linear-to-br from-indigo-100 to-slate-100 border border-indigo-200/60 flex items-center justify-center font-bold text-indigo-700 text-sm shrink-0 shadow-inner">
                      {item.authorName ? item.authorName[0].toUpperCase() : "U"}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900 truncate">
                          {item.authorName}
                        </h4>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${item.authorRole === "ADMIN"
                              ? "bg-purple-100 text-purple-700 border border-purple-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}
                        >
                          {item.authorRole}
                        </span>
                        {item.authorDepartment && (
                          <span className="text-xs text-slate-500 font-medium">
                            • {item.authorDepartment}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Submitted on{" "}
                        {format(new Date(item.createdAt), "MMM dd, yyyy 'at' hh:mm a")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                    {statusBadge(item.status)}
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(item.id || item._id!, item.title)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1"
                        title="Delete Feedback"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Content: Category + Title + Description */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      <CategoryIcon className="w-3.5 h-3.5 text-indigo-600" />
                      {item.category}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                    {item.title}
                  </h3>
                  <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {/* Admin Remark / Response (Visible to all users once provided) */}
                {item.adminRemark && (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
                    <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 shrink-0 mt-0.5">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          Leadership Response
                        </p>
                        {item.markedAt && (
                          <span className="text-[11px] text-slate-400">
                            {format(new Date(item.markedAt), "MMM dd, yyyy")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {item.adminRemark}
                      </p>
                    </div>
                  </div>
                )}

                {/* Admin-Only Marking Action Bar */}
                {isAdmin && (
                  <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 p-4 sm:p-5 rounded-b-2xl">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      <span>Admin Verdict:</span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        disabled={updatingId === (item.id || item._id)}
                        onClick={() =>
                          openRemarkModal(item, "IMPLEMENTED")
                        }
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs ${item.status === "IMPLEMENTED"
                            ? "bg-emerald-600 text-white shadow-emerald-500/20"
                            : "bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          }`}
                      >
                        <Check className="w-3.5 h-3.5" /> Implemented
                      </button>

                      <button
                        type="button"
                        disabled={updatingId === (item.id || item._id)}
                        onClick={() => openRemarkModal(item, "VALUABLE")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs ${item.status === "VALUABLE"
                            ? "bg-amber-500 text-white shadow-amber-500/20"
                            : "bg-white border border-amber-200 text-amber-700 hover:bg-amber-50"
                          }`}
                      >
                        <Star className="w-3.5 h-3.5" /> Valuable
                      </button>

                      <button
                        type="button"
                        disabled={updatingId === (item.id || item._id)}
                        onClick={() =>
                          openRemarkModal(item, "NOT_IMPLEMENTED")
                        }
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs ${item.status === "NOT_IMPLEMENTED"
                            ? "bg-rose-600 text-white shadow-rose-500/20"
                            : "bg-white border border-rose-200 text-rose-700 hover:bg-rose-50"
                          }`}
                      >
                        <X className="w-3.5 h-3.5" /> Not Implemented
                      </button>

                      {item.status !== "PENDING" && (
                        <button
                          type="button"
                          disabled={updatingId === (item.id || item._id)}
                          onClick={() =>
                            handleMarkStatus(item.id || item._id!, "PENDING")
                          }
                          className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
                          title="Reset to Under Review"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Feedback Submission Modal */}
      <SubmitFeedbackModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={fetchFeedbacks}
      />

      {/* Admin Remark & Verdict Confirmation Modal */}
      {remarkModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-fade-in"
          onClick={() => setRemarkModal((prev) => ({ ...prev, open: false }))}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-5 bg-slate-50/80 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Mark as {remarkModal.status.replace("_", " ")}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">
                  {remarkModal.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setRemarkModal((prev) => ({ ...prev, open: false }))
                }
                className="p-1.5 rounded-lg hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submitRemarkModal} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Admin Remarks / Note (Optional)
                </label>
                <textarea
                  rows={3}
                  value={adminRemarkInput}
                  onChange={(e) => setAdminRemarkInput(e.target.value)}
                  placeholder="Explain the decision, implementation plan, or team notes for all users to see..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none placeholder:text-slate-400"
                  maxLength={300}
                />
                <span className="text-[11px] text-slate-400 block text-right mt-1">
                  {adminRemarkInput.length} / 300
                </span>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setRemarkModal((prev) => ({ ...prev, open: false }))
                  }
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingId === remarkModal.feedbackId}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-500/20 transition-all active:scale-95"
                >
                  Confirm Verdict
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Feedback;
