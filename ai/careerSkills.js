const DATA_ANALYST_SKILLS = Object.freeze({
  Excel: 70,
  SQL: 70,
  Statistics: 50,
  "Data Visualization": 60,
});
const CAREER_SKILL_PROFILES = Object.freeze({
  "Data Analyst": DATA_ANALYST_SKILLS,
  "Web Developer": { HTML: 70, CSS: 70, JavaScript: 70, "Problem Solving": 60 },
  "Digital Marketer": {
    Audience: 70,
    Content: 70,
    Analytics: 60,
    Experimentation: 60,
  },
});
module.exports = { DATA_ANALYST_SKILLS, CAREER_SKILL_PROFILES };
