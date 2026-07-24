import type { Resume } from "@/types/resume";

export const sampleResume: Resume = {
  contact: {
    name: "Taylor Rivera",
    email: "sample@example.com",
    phone: "+63 900 000 0000",
    location: "Metro Manila",
    linkedin: "",
    website: "portfolio.example.com",
  },
  summary: "Business systems and data analyst who turns stakeholder needs into clear requirements and tested workflows. Collaborative and process-focused, with experience creating practical operational reports.",
  education: [{
    school: "Sample State University",
    degree: "BS Information Technology",
    location: "Metro Manila, Philippines",
    graduationDate: "2020",
    gpa: "3.70 / 4.00",
    awards: ["Dean's List", "Academic Merit Scholarship"],
  }],
  experience: [
    {
      organization: "Sample Technology Company",
      title: "Business Systems Analyst",
      location: "Metro Manila, Philippines",
      startDate: "Jan 2022",
      endDate: "Present",
      bullets: [
        "Documented requirements with cross-functional stakeholders for a sample internal platform.",
        "Coordinated UAT, test evidence, and issue resolution before demonstration releases.",
        "Created example Power BI dashboards for operational reporting exercises.",
        "Mapped a fictional approval workflow and proposed process improvements.",
        "Used SQL to validate sample datasets and reconcile reporting outputs.",
      ],
    },
    {
      organization: "Sample Financial Services Firm",
      title: "Data Analytics Intern",
      location: "Metro Manila, Philippines",
      startDate: "Jun 2021",
      endDate: "Dec 2021",
      bullets: [
        "Cleaned and reconciled sample operational data for weekly reporting and quality checks.",
        "Built spreadsheet summaries that highlighted volume trends and recurring service issues.",
      ],
    },
  ],
  leadership: [
    {
      organization: "Community Innovation Project",
      title: "Project Coordinator",
      location: "Remote",
      startDate: "Jun 2020",
      endDate: "Dec 2021",
      bullets: ["Coordinated schedules, action logs, status reports, and demonstration workshops for a fictional project team."],
    },
    {
      organization: "University Technology Society",
      title: "Programs Lead",
      location: "Metro Manila, Philippines",
      startDate: "Aug 2019",
      endDate: "May 2020",
      bullets: ["Led volunteers delivering peer workshops and technology events, tracking plans, speakers, and participant feedback."],
    },
  ],
  skills: [
    { label: "Technical", items: ["Requirements Analysis", "SQL", "Data Visualization", "UAT", "Process Mapping"] },
    { label: "Tools", items: ["Power BI", "Jira", "Confluence", "Spreadsheet Applications"] },
    { label: "Methods", items: ["Agile", "User Stories", "Process Improvement", "Requirements Documentation"] },
    { label: "Interests", items: ["Workflow Design", "Community Technology", "Visual Communication"] },
  ],
  projects: [
    { name: "Operations Dashboard Prototype", date: "2021", bullets: ["Built a sample Power BI dashboard that summarized service trends, validated source data, and documented repeatable reporting assumptions."] },
    { name: "Service Request Workflow Redesign", date: "2020", bullets: ["Mapped a sample request process, identified handoff delays, and prototyped a simplified workflow with documented UAT scenarios."] },
  ],
};
