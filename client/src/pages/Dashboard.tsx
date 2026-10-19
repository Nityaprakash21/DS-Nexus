import { useQuery } from "@tanstack/react-query";
import Loading from "../components/Loading.js";
import EmployeeDashboard from "../components/EmployeeDashboard.js";
import AdminDashboard from "../components/AdminDashboard.js";
import api from "../api/axios";

type DashboardData = {
  role: string;
  employee?: {
    firstName?: string;
    lastName?: string;
    position?: string;
    department?: string;
    employeeCode?: string;
  };
  currentMonthAttendance: number;
  pendingLeaves: number;
  remainingLeaves?: number;
  leaveSummary?: {
    totalQuota: number;
    consumed: number;
    remaining: number;
    financialYear?: string;
    breakdown?: {
      casual: { consumed: number; total: number; remaining: number };
      annual: { consumed: number; total: number; remaining: number };
      sick: { consumed: number; total: number; remaining: number };
    };
  };

  // Admin-specific optional metrics
  totalEmployees?: number;
  totalDepartments?: number;
  todayAttendance?: number;
  latestPayslip?: {
    [key: string]: any;
  };
};

const fetchDashboard = async (): Promise<DashboardData> => {
  const res = await api.get("/dashboard");
  return res.data;
};

const Dashboard = () => {
  const { data, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    refetchInterval: 5000,
  });

  if (isLoading) return <Loading />;
  if (isError || !data) return <p className="text-center text-slate-500 py-12">Failed to load Dashboard</p>;

  if (data.role === "ADMIN") {
    // ensure admin metrics exist to satisfy AdminDashboard prop types
    const normalizedAdmin = {
      ...data,
      totalEmployees: data.totalEmployees ?? 0,
      totalDepartments: data.totalDepartments ?? 0,
      todayAttendance: data.todayAttendance ?? 0,
    };

    return <AdminDashboard data={normalizedAdmin} />;
  } else {
    // ensure employee is defined to satisfy EmployeeDashboard prop types
    const normalizedData = { ...data, employee: data.employee ?? {} };
    return <EmployeeDashboard data={normalizedData} />;
  }
};

export default Dashboard;