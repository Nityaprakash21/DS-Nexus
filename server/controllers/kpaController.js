import KpaTemplate from "../models/KpaTemplate.js";
import AppraisalCycle from "../models/AppraisalCycle.js";
import AdminDeduction from "../models/AdminDeduction.js";
import KpaEvaluation from "../models/KpaEvaluation.js";
import Employee from "../models/Employee.js";
import { calculateAppraisalScores } from "../services/kpaService.js";
import { runInTransaction } from "../utils/dbTransactions.js";

// Helper to extract authenticated user's ID
const getUserId = (req) => req?.session?.userId || req?.session?.id || req?.user?._id || req?.user?.id;

// Default templates tailored for the Investment Business
export const DEFAULT_TEMPLATES = [
    {
        teamKey: "OPERATIONS",
        teamName: "Operations Team (In-Office)",
        targetDescription: "Focus: Accuracy, speed, and compliance (punching mutual fund orders, processing KYC, resolving queries).",
        applicableDepartments: ["Operations"],
        isDefault: true,
        metrics: [
            {
                id: "kpa_ops_accuracy",
                title: "Processing Accuracy",
                weight: 40,
                description: "Percentage of error-free applications processed (e.g., zero rejection rates from AMCs due to data entry errors).",
                evaluatorRole: "Immediate Manager / Team Leader",
                rubric: {
                    5: "≥ 99.5% error-free orders; zero AMC rejections due to internal punch errors.",
                    4: "97.0% - 99.4% error-free rate; rare minor non-fatal punch errors.",
                    3: "94.0% - 96.9% error-free rate; meets baseline operational expectations.",
                    2: "88.0% - 93.9% error-free rate; frequent punch corrections required.",
                    1: "< 88.0% error-free rate; critical AMC rejections and data entry defects."
                }
            },
            {
                id: "kpa_ops_tat",
                title: "Turnaround Time (TAT)",
                weight: 30,
                description: "Meeting daily cut-off deadlines for order punching and processing redemption/purchase requests.",
                evaluatorRole: "Immediate Manager / Team Leader",
                rubric: {
                    5: "100% orders punched within same-day NAV cut-off times consistently.",
                    4: "95% - 99% orders punched before cut-off without supervision.",
                    3: "90% - 94% orders processed within standard operating SLA.",
                    2: "80% - 89% on-time processing; sporadic missed deadlines.",
                    1: "< 80% SLA compliance; recurring missed NAV cut-offs."
                }
            },
            {
                id: "kpa_ops_compliance",
                title: "Client Document Management & Compliance",
                weight: 30,
                description: "Ensuring complete physical/digital filing and strictly adhering to SEBI/AMFI compliance checklists.",
                evaluatorRole: "Immediate Manager / Compliance Head",
                rubric: {
                    5: "Flawless audit trail; 100% adherence to SEBI/AMFI compliance checklists.",
                    4: "High compliance diligence; minor documentation delays resolved swiftly.",
                    3: "Satisfactory record upkeep with occasional audit reminders.",
                    2: "Documentation gaps, delayed KYC uploads, or incomplete checklists.",
                    1: "Serious compliance non-adherence or audit findings."
                }
            }
        ]
    },
    {
        teamKey: "FIELD_SERVICE",
        teamName: "Outside Service & Product Team (Field/Client-Facing)",
        targetDescription: "Focus: Client onboarding experience, physical liaison, and cross-selling supporting services.",
        applicableDepartments: ["Services", "Sales"],
        isDefault: true,
        metrics: [
            {
                id: "kpa_field_tat_resolution",
                title: "Service TAT & Resolution",
                weight: 40,
                description: "Speed and success rate of outside tasks (e.g., collecting physical signatures, bank mandate updates, visiting client premises).",
                evaluatorRole: "Field Manager / Service Head",
                rubric: {
                    5: "First-visit resolution rate ≥ 95%; zero client escalation on visits.",
                    4: "First-visit resolution rate 88% - 94%; rapid turnaround of physical liaison tasks.",
                    3: "Standard SLA met (80% - 87% resolution on initial visit).",
                    2: "Frequent re-visits required; delays in document pickup.",
                    1: "Repeated client complaints of unpunctuality or missed appointments."
                }
            },
            {
                id: "kpa_field_csat",
                title: "Client Satisfaction (CSAT) Rating",
                weight: 30,
                description: "Feedback score collected from clients after a physical interaction or problem resolution.",
                evaluatorRole: "Client Feedback Aggregator / Manager",
                rubric: {
                    5: "CSAT score ≥ 4.8 / 5.0; exceptional client praise and testimonials.",
                    4: "CSAT score 4.2 - 4.7 / 5.0; highly positive client feedback.",
                    3: "CSAT score 3.5 - 4.1 / 5.0; satisfactory client service level.",
                    2: "CSAT score 2.8 - 3.4 / 5.0; client dissatisfaction noted.",
                    1: "CSAT score < 2.8 / 5.0; multiple verified service grievances."
                }
            },
            {
                id: "kpa_field_cross_sell",
                title: "Product Cross-Selling Support",
                weight: 30,
                description: "Number of leads generated or converted for secondary products (e.g., Insurance, Fixed Deposits) while executing service visits.",
                evaluatorRole: "Product Head / Manager",
                rubric: {
                    5: "Exceeds cross-sell target by ≥ 130% with high conversion quality.",
                    4: "Achieves 100% - 129% of assigned cross-selling/lead targets.",
                    3: "Achieves 80% - 99% of assigned secondary product targets.",
                    2: "Achieves 50% - 79% of cross-sell targets; needs sales coaching.",
                    1: "< 50% target achievement or zero cross-selling engagement."
                }
            }
        ]
    },
    {
        teamKey: "MANAGEMENT",
        teamName: "Management Team",
        targetDescription: "Focus: Revenue growth, team retention, and operational efficiency.",
        applicableDepartments: ["Finance"],
        isDefault: true,
        metrics: [
            {
                id: "kpa_mgmt_growth",
                title: "Business Revenue & Net AUM Growth",
                weight: 40,
                description: "Total Asset Under Management (AUM) growth and net new inflows brought in by their respective teams.",
                evaluatorRole: "Business Owner / Operations Head",
                rubric: {
                    5: "Exceeds net inflow & revenue target by ≥ 120% through organic alpha.",
                    4: "Achieves 100% - 119% of targeted team revenue and net new inflows.",
                    3: "Achieves 85% - 99% of target in a standard market cycle.",
                    2: "Achieves 70% - 84% of revenue target; sluggish team velocity.",
                    1: "< 70% target achievement with declining book of business."
                }
            },
            {
                id: "kpa_mgmt_productivity_retention",
                title: "Team Productivity & Retention",
                weight: 30,
                description: "Percentage of team members meeting their individual TATs and overall employee retention rates.",
                evaluatorRole: "Business Owner / HR Head",
                rubric: {
                    5: "Team retention ≥ 95%; ≥ 90% of direct reports exceed individual SLAs.",
                    4: "Team retention 85% - 94%; strong team morale and high output.",
                    3: "Standard team turnover and satisfactory productivity across units.",
                    2: "Elevated team attrition or frequent operational bottlenecks.",
                    1: "High turnover (> 30%) or pervasive team underperformance."
                }
            },
            {
                id: "kpa_mgmt_risk_compliance",
                title: "Operational Risk & Compliance Control",
                weight: 30,
                description: "Zero regulatory non-compliance incidents or major operational lapses across their managed departments.",
                evaluatorRole: "Business Owner / Compliance Auditor",
                rubric: {
                    5: "Zero regulatory non-compliances, zero audit observations, proactive risk mitigation.",
                    4: "Clean audit report with only minor procedural remarks resolved immediately.",
                    3: "Standard compliance maintained with no statutory penalties.",
                    2: "Minor operational lapses or compliance warning letters received.",
                    1: "Major regulatory breach, SEBI/AMFI penalty, or severe operational negligence."
                }
            }
        ]
    }
];

// Helper: Ensure default templates exist
const ensureDefaultTemplates = async () => {
    const count = await KpaTemplate.countDocuments();
    if (count === 0) {
        for (const t of DEFAULT_TEMPLATES) {
            await KpaTemplate.create(t);
        }
    }
};

// Helper: Ensure an active cycle exists
const getOrCreateActiveCycle = async (userId) => {
    let cycle = await AppraisalCycle.findOne({ status: "ACTIVE" }).sort({ createdAt: -1 });
    if (!cycle) {
        const currentYear = new Date().getFullYear();
        cycle = await AppraisalCycle.create({
            yearLabel: `FY ${currentYear}-${currentYear + 1}`,
            yoyBusinessGrowthPercentage: 15, // Default 15% growth cap
            status: "ACTIVE",
            ...(userId && { createdBy: userId })
        });
    }
    return cycle;
};

// -------------------------------------------------------------
// 1. APPRAISAL CYCLE CONTROLLERS
// -------------------------------------------------------------

// GET /api/kpa/cycle/active
export const getActiveAppraisalCycle = async (req, res) => {
    try {
        await ensureDefaultTemplates();
        const userId = getUserId(req);
        const cycle = await getOrCreateActiveCycle(userId);
        return res.json({ success: true, cycle });
    } catch (error) {
        console.error("Get active cycle error: ", error);
        return res.status(500).json({ error: "Failed to fetch active appraisal cycle" });
    }
};

// PUT /api/kpa/cycle/:id
export const updateAppraisalCycle = async (req, res) => {
    try {
        const { id } = req.params;
        const { yearLabel, yoyBusinessGrowthPercentage, inflationBasePercentage, status, notes } = req.body;
        
        const updated = await AppraisalCycle.findByIdAndUpdate(
            id,
            {
                ...(yearLabel && { yearLabel }),
                ...(yoyBusinessGrowthPercentage !== undefined && { yoyBusinessGrowthPercentage: Number(yoyBusinessGrowthPercentage) }),
                ...(inflationBasePercentage !== undefined && { inflationBasePercentage: Number(inflationBasePercentage) }),
                ...(status && { status }),
                ...(notes !== undefined && { notes })
            },
            { returnDocument: "after" }
        );

        if (!updated) {
            return res.status(404).json({ error: "Appraisal cycle not found" });
        }

        return res.json({ success: true, cycle: updated });
    } catch (error) {
        console.error("Update cycle error: ", error);
        return res.status(500).json({ error: "Failed to update appraisal cycle" });
    }
};

// -------------------------------------------------------------
// 2. KPA TEMPLATE CONTROLLERS
// -------------------------------------------------------------

// GET /api/kpa/templates
export const getTemplates = async (req, res) => {
    try {
        await ensureDefaultTemplates();
        const templates = await KpaTemplate.find({ isActive: true }).sort({ createdAt: 1 }).lean();
        return res.json({ success: true, templates });
    } catch (error) {
        console.error("Get templates error: ", error);
        return res.status(500).json({ error: "Failed to fetch KPA templates" });
    }
};

// POST /api/kpa/templates (Admin custom template)
export const createOrUpdateTemplate = async (req, res) => {
    try {
        const { teamKey, teamName, targetDescription, applicableDepartments, metrics } = req.body;
        if (!teamKey || !teamName || !Array.isArray(metrics) || metrics.length === 0) {
            return res.status(400).json({ error: "Missing required template fields or metrics" });
        }

        // Validate total weight == 100%
        const totalWeight = metrics.reduce((acc, m) => acc + (Number(m.weight) || 0), 0);
        if (totalWeight !== 100) {
            return res.status(400).json({ error: `Total KPA weight must equal 100%. Current sum: ${totalWeight}%` });
        }

        const template = await KpaTemplate.findOneAndUpdate(
            { teamKey },
            {
                teamKey,
                teamName,
                targetDescription,
                applicableDepartments: applicableDepartments || [],
                metrics,
                isActive: true
            },
            { upsert: true, returnDocument: "after" }
        );

        return res.json({ success: true, template });
    } catch (error) {
        console.error("Save template error: ", error);
        return res.status(500).json({ error: "Failed to save KPA template" });
    }
};

// -------------------------------------------------------------
// 3. ADMIN DEDUCTIONS CONTROLLERS
// -------------------------------------------------------------

// POST /api/kpa/deductions
export const createAdminDeduction = async (req, res) => {
    try {
        const { employeeId, cycleYear, deductionScore, reasonCategory, reasonDetails } = req.body;
        if (!employeeId || !deductionScore || !reasonCategory || !reasonDetails) {
            return res.status(400).json({ error: "Missing required deduction fields" });
        }

        const userId = getUserId(req);
        const deduction = await AdminDeduction.create({
            employeeId,
            cycleYear: cycleYear || "FY 2025-2026",
            deductionScore: Number(deductionScore),
            reasonCategory,
            reasonDetails,
            appliedBy: userId,
            status: "ACTIVE"
        });

        // Recalculate evaluation if already present
        const activeCycle = await getOrCreateActiveCycle(userId);
        const evalRecord = await KpaEvaluation.findOne({ employeeId, cycleId: activeCycle._id });
        if (evalRecord) {
            await recalculateEvaluation(evalRecord, activeCycle.yoyBusinessGrowthPercentage);
        }

        return res.status(201).json({ success: true, deduction });
    } catch (error) {
        console.error("Create deduction error: ", error);
        return res.status(500).json({ error: "Failed to apply admin deduction" });
    }
};

// GET /api/kpa/deductions/:employeeId
export const getEmployeeDeductions = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const deductions = await AdminDeduction.find({ employeeId })
            .populate("appliedBy", "email")
            .sort({ createdAt: -1 })
            .lean();
        return res.json({ success: true, deductions });
    } catch (error) {
        console.error("Get deductions error: ", error);
        return res.status(500).json({ error: "Failed to fetch deductions" });
    }
};

// PUT /api/kpa/deductions/:id/reverse
export const reverseAdminDeduction = async (req, res) => {
    try {
        const { id } = req.params;
        const { reversalReason } = req.body;
        const userId = getUserId(req);

        const deduction = await AdminDeduction.findById(id);
        if (!deduction) return res.status(404).json({ error: "Deduction record not found" });

        deduction.status = "REVERSED";
        deduction.reversalReason = reversalReason || "Reversed by Administrator";
        deduction.reversedBy = userId;
        await deduction.save();

        // Recalculate evaluation
        const activeCycle = await getOrCreateActiveCycle(userId);
        const evalRecord = await KpaEvaluation.findOne({ employeeId: deduction.employeeId, cycleId: activeCycle._id });
        if (evalRecord) {
            await recalculateEvaluation(evalRecord, activeCycle.yoyBusinessGrowthPercentage);
        }

        return res.json({ success: true, deduction });
    } catch (error) {
        console.error("Reverse deduction error: ", error);
        return res.status(500).json({ error: "Failed to reverse deduction" });
    }
};

// -------------------------------------------------------------
// 4. EVALUATION & APPRAISAL ENGINE
// -------------------------------------------------------------

// Helper calculation engine
const recalculateEvaluation = async (evaluation, growthCap) => {
    // 1. Aggregate active admin deductions
    const activeDeductions = await AdminDeduction.find({
        employeeId: evaluation.employeeId,
        status: "ACTIVE"
    });
    const totalDeductions = activeDeductions.reduce((sum, d) => sum + Number(d.deductionScore || 0), 0);

    // 2. Pure domain service appraisal calculation
    const scores = calculateAppraisalScores({
        ratings: evaluation.ratings,
        totalDeductions,
        growthCap,
        currentBasicSalary: evaluation.currentBasicSalary || 0
    });

    Object.assign(evaluation, scores);
    await evaluation.save();
    return evaluation;
};

// POST /api/kpa/evaluations
export const submitEvaluation = async (req, res) => {
    try {
        const { employeeId, templateId, teamKey, ratings, evaluatorFeedback } = req.body;
        if (!employeeId || !templateId || !Array.isArray(ratings) || ratings.length === 0) {
            return res.status(400).json({ error: "Missing employee, template, or ratings" });
        }

        const employee = await Employee.findById(employeeId);
        if (!employee) return res.status(404).json({ error: "Employee not found" });

        const userId = getUserId(req);
        const activeCycle = await getOrCreateActiveCycle(userId);
        const growthCap = activeCycle.yoyBusinessGrowthPercentage || 15;

        // Upsert evaluation record
        let evaluation = await KpaEvaluation.findOne({
            employeeId,
            cycleId: activeCycle._id
        });

        if (!evaluation) {
            evaluation = new KpaEvaluation({
                employeeId,
                cycleId: activeCycle._id,
                templateId,
                teamKey: teamKey || "OPERATIONS",
                ratings,
                evaluatorId: userId,
                evaluatorFeedback: evaluatorFeedback || "",
                currentBasicSalary: employee.basicSalary || 0,
                status: "SUBMITTED"
            });
        } else {
            evaluation.templateId = templateId;
            evaluation.teamKey = teamKey || evaluation.teamKey;
            evaluation.ratings = ratings;
            evaluation.evaluatorId = userId || evaluation.evaluatorId;
            evaluation.evaluatorFeedback = evaluatorFeedback || evaluation.evaluatorFeedback;
            evaluation.currentBasicSalary = employee.basicSalary || 0;
            evaluation.status = "SUBMITTED";
        }

        await recalculateEvaluation(evaluation, growthCap);

        return res.status(200).json({ success: true, evaluation });
    } catch (error) {
        console.error("Submit evaluation error: ", error);
        return res.status(500).json({ error: "Failed to submit evaluation" });
    }
};

// GET /api/kpa/evaluations
export const getAllEvaluations = async (req, res) => {
    try {
        const userId = getUserId(req);
        const activeCycle = await getOrCreateActiveCycle(userId);
        const evaluations = await KpaEvaluation.find({ cycleId: activeCycle._id })
            .populate("employeeId", "firstName lastName email position department basicSalary employmentStatus")
            .populate("evaluatorId", "email role")
            .populate("templateId", "teamName teamKey")
            .sort({ updatedAt: -1 })
            .lean();

        return res.json({ success: true, cycle: activeCycle, evaluations });
    } catch (error) {
        console.error("Get evaluations error: ", error);
        return res.status(500).json({ error: "Failed to fetch evaluations" });
    }
};

// GET /api/kpa/evaluations/employee/:employeeId
export const getEmployeeEvaluation = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const userId = getUserId(req);
        const activeCycle = await getOrCreateActiveCycle(userId);

        const evaluation = await KpaEvaluation.findOne({
            employeeId,
            cycleId: activeCycle._id
        })
            .populate("employeeId")
            .populate("templateId")
            .populate("evaluatorId", "email role")
            .lean();

        const deductions = await AdminDeduction.find({ employeeId })
            .populate("appliedBy", "email")
            .sort({ createdAt: -1 })
            .lean();

        return res.json({
            success: true,
            cycle: activeCycle,
            evaluation,
            deductions
        });
    } catch (error) {
        console.error("Get employee evaluation error: ", error);
        return res.status(500).json({ error: "Failed to fetch employee evaluation" });
    }
};

// GET /api/kpa/my-scorecard (For logged in employee)
export const getMyScorecard = async (req, res) => {
    try {
        const userId = getUserId(req);
        const employee = await Employee.findOne({ userId, isDeleted: false });
        if (!employee) {
            return res.status(404).json({ error: "Employee profile not found" });
        }

        const activeCycle = await getOrCreateActiveCycle(userId);
        const evaluation = await KpaEvaluation.findOne({
            employeeId: employee._id,
            cycleId: activeCycle._id
        })
            .populate("templateId")
            .populate("evaluatorId", "email")
            .lean();

        const deductions = await AdminDeduction.find({ employeeId: employee._id })
            .sort({ createdAt: -1 })
            .lean();

        return res.json({
            success: true,
            employee,
            cycle: activeCycle,
            evaluation,
            deductions
        });
    } catch (error) {
        console.error("Get my scorecard error: ", error);
        return res.status(500).json({ error: "Failed to fetch your scorecard" });
    }
};

// POST /api/kpa/evaluations/:id/approve (Admin confirms appraisal and updates basic salary)
export const approveAppraisal = async (req, res) => {
    try {
        const { id } = req.params;
        const { applyToPayroll } = req.body;
        const userId = getUserId(req);

        const evaluation = await KpaEvaluation.findById(id);
        if (!evaluation) return res.status(404).json({ error: "Evaluation not found" });

        await runInTransaction(async (session) => {
            evaluation.status = "APPROVED";
            evaluation.approvedBy = userId;
            evaluation.approvedAt = new Date();

            if (applyToPayroll && evaluation.revisedBasicSalary > 0) {
                const empUpdateOpts = session ? { session } : {};
                await Employee.findByIdAndUpdate(
                    evaluation.employeeId,
                    { basicSalary: evaluation.revisedBasicSalary },
                    empUpdateOpts
                );
                evaluation.salaryUpdatedInPayroll = true;
            }

            await evaluation.save(session ? { session } : {});
        });

        return res.json({
            success: true,
            message: applyToPayroll ? "Appraisal approved and employee salary updated in payroll!" : "Appraisal approved successfully!",
            evaluation
        });
    } catch (error) {
        console.error("Approve appraisal error: ", error);
        return res.status(500).json({ error: "Failed to approve appraisal" });
    }
};
