// KPA Appraisal & Performance Domain Service
// Contains pure formulas for weighted performance scoring, deductions, and salary revisions

export const calculateAppraisalScores = ({
  ratings = [],
  totalDeductions = 0,
  growthCap = 15,
  currentBasicSalary = 0,
}) => {
  // 1. Calculate raw weighted score out of 5.0
  let rawWeightedScore = 0;
  for (const r of ratings) {
    rawWeightedScore += (Number(r.score) * Number(r.weight)) / 100;
  }
  rawWeightedScore = Number(rawWeightedScore.toFixed(3));

  // 2. Net Score after Admin Deductions
  const netScore = Math.max(0, Number((rawWeightedScore - Number(totalDeductions || 0)).toFixed(3)));

  // 3. Performance Ratio against 5.0 scale
  const performanceRatio = Number((netScore / 5.0).toFixed(4));

  // 4. Growth Cap formula: Performance Ratio * YoY Business Growth %
  const finalAppraisalPercentage = Number((performanceRatio * growthCap).toFixed(2));

  // 5. Revised Basic Salary
  const revisedBasicSalary = Math.round(currentBasicSalary * (1 + finalAppraisalPercentage / 100));

  return {
    rawWeightedScore,
    totalDeductions: Number(totalDeductions || 0),
    netScore,
    performanceRatio,
    businessGrowthCap: growthCap,
    finalAppraisalPercentage,
    revisedBasicSalary,
  };
};
