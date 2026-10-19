import api from "./axios";

export interface KpaMetric {
  id: string;
  title: string;
  weight: number;
  description: string;
  evaluatorRole: string;
  rubric: {
    1: string;
    2: string;
    3: string;
    4: string;
    5: string;
  };
}

export interface KpaTemplate {
  _id: string;
  teamKey: "OPERATIONS" | "FIELD_SERVICE" | "MANAGEMENT" | "CUSTOM";
  teamName: string;
  targetDescription: string;
  applicableDepartments: string[];
  metrics: KpaMetric[];
  isDefault: boolean;
  isActive: boolean;
}

export interface AppraisalCycle {
  _id: string;
  yearLabel: string;
  yoyBusinessGrowthPercentage: number;
  inflationBasePercentage?: number;
  status: "ACTIVE" | "CALIBRATING" | "FINALIZED" | "ARCHIVED";
  notes?: string;
}

export interface AdminDeduction {
  _id: string;
  employeeId: string;
  cycleYear: string;
  deductionScore: number;
  reasonCategory: string;
  reasonDetails: string;
  incidentDate: string;
  appliedBy?: {
    _id: string;
    email: string;
  };
  status: "ACTIVE" | "REVERSED";
  reversalReason?: string;
  createdAt: string;
}

export interface RatingItem {
  metricId: string;
  title: string;
  weight: number;
  score: number;
  remarks?: string;
}

export interface KpaEvaluation {
  _id: string;
  employeeId: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    position: string;
    department: string;
    basicSalary: number;
    employmentStatus: string;
  };
  cycleId: string | AppraisalCycle;
  templateId: {
    _id: string;
    teamName: string;
    teamKey: string;
    metrics: KpaMetric[];
  };
  teamKey: string;
  ratings: RatingItem[];
  rawWeightedScore: number;
  totalDeductions: number;
  netScore: number;
  performanceRatio: number;
  businessGrowthCap: number;
  finalAppraisalPercentage: number;
  currentBasicSalary: number;
  revisedBasicSalary: number;
  salaryUpdatedInPayroll: boolean;
  evaluatorFeedback?: string;
  evaluatorId?: {
    _id: string;
    email: string;
    role: string;
  };
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// API Methods
export const getActiveCycle = async () => {
  const { data } = await api.get<{ success: boolean; cycle: AppraisalCycle }>("/kpa/cycle/active");
  return data.cycle;
};

export const updateActiveCycle = async (id: string, payload: Partial<AppraisalCycle>) => {
  const { data } = await api.put<{ success: boolean; cycle: AppraisalCycle }>(`/kpa/cycle/${id}`, payload);
  return data.cycle;
};

export const getKpaTemplates = async () => {
  const { data } = await api.get<{ success: boolean; templates: KpaTemplate[] }>("/kpa/templates");
  return data.templates;
};

export const saveKpaTemplate = async (template: Partial<KpaTemplate>) => {
  const { data } = await api.post<{ success: boolean; template: KpaTemplate }>("/kpa/templates", template);
  return data.template;
};

export const getAllEvaluations = async () => {
  const { data } = await api.get<{ success: boolean; cycle: AppraisalCycle; evaluations: KpaEvaluation[] }>("/kpa/evaluations");
  return data;
};

export const getEmployeeEvaluation = async (employeeId: string) => {
  const { data } = await api.get<{
    success: boolean;
    cycle: AppraisalCycle;
    evaluation: KpaEvaluation | null;
    deductions: AdminDeduction[];
  }>(`/kpa/evaluations/employee/${employeeId}`);
  return data;
};

export const submitKpaEvaluation = async (payload: {
  employeeId: string;
  templateId: string;
  teamKey: string;
  ratings: { metricId: string; title: string; weight: number; score: number; remarks?: string }[];
  evaluatorFeedback?: string;
}) => {
  const { data } = await api.post<{ success: boolean; evaluation: KpaEvaluation }>("/kpa/evaluations", payload);
  return data.evaluation;
};

export const createAdminDeduction = async (payload: {
  employeeId: string;
  cycleYear: string;
  deductionScore: number;
  reasonCategory: string;
  reasonDetails: string;
}) => {
  const { data } = await api.post<{ success: boolean; deduction: AdminDeduction }>("/kpa/deductions", payload);
  return data.deduction;
};

export const reverseAdminDeduction = async (id: string, reversalReason: string) => {
  const { data } = await api.put<{ success: boolean; deduction: AdminDeduction }>(`/kpa/deductions/${id}/reverse`, {
    reversalReason
  });
  return data.deduction;
};

export const approveAppraisal = async (id: string, applyToPayroll: boolean = true) => {
  const { data } = await api.post<{ success: boolean; message: string; evaluation: KpaEvaluation }>(
    `/kpa/evaluations/${id}/approve`,
    { applyToPayroll }
  );
  return data;
};

export const getMyScorecard = async () => {
  const { data } = await api.get<{
    success: boolean;
    employee: any;
    cycle: AppraisalCycle;
    evaluation: KpaEvaluation | null;
    deductions: AdminDeduction[];
  }>("/kpa/my-scorecard");
  return data;
};
