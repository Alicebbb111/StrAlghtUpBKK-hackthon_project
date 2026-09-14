const { CAREER_SKILL_PROFILES } = require("./careerSkills");

function validateScore(score, label) {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    throw new TypeError(`${label} must be a finite number.`);
  }

  if (score < 0 || score > 100) {
    throw new RangeError(`${label} must be between 0 and 100.`);
  }
}

function round(value, decimalPlaces = 2) {
  const factor = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function analyzeSkills(currentSkills, targetCareer = "Data Analyst") {
  if (
    !currentSkills ||
    typeof currentSkills !== "object" ||
    Array.isArray(currentSkills)
  ) {
    throw new TypeError(
      "currentSkills must be an object containing numeric skill scores.",
    );
  }

  const requiredSkills = CAREER_SKILL_PROFILES[targetCareer];
  if (!requiredSkills) {
    throw new Error(
      `No skill profile exists for target career: ${targetCareer}.`,
    );
  }

  const skillGaps = {};
  const skillReadiness = {};
  const strengths = [];
  const weakOrMissingSkills = [];

  for (const [skill, requiredScore] of Object.entries(requiredSkills)) {
    const currentScore = currentSkills[skill] ?? 0;
    validateScore(currentScore, `Score for ${skill}`);

    const gap = Math.max(requiredScore - currentScore, 0);
    const readiness = Math.min(currentScore / requiredScore, 1) * 100;

    skillGaps[skill] = gap;
    skillReadiness[skill] = round(readiness);

    if (currentScore >= requiredScore) {
      strengths.push(skill);
    } else {
      weakOrMissingSkills.push({
        skill,
        current_score: currentScore,
        required_score: requiredScore,
        gap,
        status: currentScore === 0 ? "missing" : "needs improvement",
      });
    }
  }

  weakOrMissingSkills.sort((a, b) => b.gap - a.gap);

  const readinessValues = Object.values(skillReadiness);
  const careerReadiness = round(
    readinessValues.reduce((sum, readiness) => sum + readiness, 0) /
      readinessValues.length,
  );

  return {
    target_career: targetCareer,
    current_skills: { ...currentSkills },
    required_skills: { ...requiredSkills },
    skill_gaps: skillGaps,
    skill_readiness: skillReadiness,
    strengths,
    weak_or_missing_skills: weakOrMissingSkills,
    career_readiness: careerReadiness,
  };
}

module.exports = { analyzeSkills };
