import { useState, useEffect, useCallback } from "react";
import api from "../api/axios";
import toast from "react-hot-toast";

export interface DepartmentItem {
  _id: string;
  departmentId?: string;
  name: string;
  description?: string;
  color?: string;
  isDefault?: boolean;
  employeeCount?: number;
  positions?: string[];
  sampleEmployees?: string[];
  createdAt?: string;
  updatedAt?: string;
}

// Initial fallback to ensure instant UI rendering without blank dropdowns
const FALLBACK_DEPARTMENTS: DepartmentItem[] = [
  { _id: "fallback-sales", departmentId: "DEP-SALES", name: "Sales", color: "rose", description: "Business development and client acquisition", isDefault: true, employeeCount: 0 },
  { _id: "fallback-services", departmentId: "DEP-SRV", name: "Services", color: "blue", description: "Customer relationship and client support", isDefault: true, employeeCount: 0 },
  { _id: "fallback-operations", departmentId: "DEP-OPS", name: "Operations", color: "emerald", description: "Core processes and platform management", isDefault: true, employeeCount: 0 },
  { _id: "fallback-finance", departmentId: "DEP-FIN", name: "Finance", color: "amber", description: "Accounting, payroll, and fiscal compliance", isDefault: true, employeeCount: 0 },
];

const DEPARTMENTS_UPDATED_EVENT = "ds_nexus_departments_updated";

export const useDepartments = () => {
  const [departments, setDepartments] = useState<DepartmentItem[]>(FALLBACK_DEPARTMENTS);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDepartments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/departments");
      if (res.data?.departments && Array.isArray(res.data.departments)) {
        setDepartments(res.data.departments);
      }
    } catch (err: any) {
      console.warn("Error loading departments from server, using fallback:", err?.message);
      setError(err?.response?.data?.error || err?.message || "Failed to load departments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartments();

    // Listen for cross-component department updates (e.g. when added or deleted)
    const handleSync = () => {
      fetchDepartments();
    };

    window.addEventListener(DEPARTMENTS_UPDATED_EVENT, handleSync);
    return () => {
      window.removeEventListener(DEPARTMENTS_UPDATED_EVENT, handleSync);
    };
  }, [fetchDepartments]);

  const notifyUpdate = () => {
    window.dispatchEvent(new CustomEvent(DEPARTMENTS_UPDATED_EVENT));
  };

  const addDepartment = async (payload: { departmentId: string; name: string; description?: string; color?: string }) => {
    try {
      const res = await api.post("/departments", payload);
      const newDept = res.data?.department;
      toast.success(res.data?.message || `Department "${payload.name}" created successfully`);
      notifyUpdate();
      await fetchDepartments();
      return newDept;
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Failed to create department";
      toast.error(msg);
      throw err;
    }
  };

  const updateDepartment = async (id: string, payload: { departmentId?: string; name?: string; description?: string; color?: string }) => {
    try {
      const res = await api.put(`/departments/${id}`, payload);
      const updated = res.data?.department;
      toast.success(res.data?.message || "Department updated successfully");
      notifyUpdate();
      await fetchDepartments();
      return updated;
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Failed to update department";
      toast.error(msg);
      throw err;
    }
  };

  const deleteDepartment = async (id: string, name?: string) => {
    try {
      const res = await api.delete(`/departments/${id}`);
      toast.success(res.data?.message || `Department "${name || ""}" deleted successfully`);
      notifyUpdate();
      await fetchDepartments();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Failed to delete department";
      toast.error(msg);
      throw err;
    }
  };

  // Helper list of department names for simple dropdowns
  const departmentNames = departments.map((d) => d.name);

  return {
    departments,
    departmentNames,
    loading,
    error,
    refreshDepartments: fetchDepartments,
    addDepartment,
    updateDepartment,
    deleteDepartment,
  };
};
