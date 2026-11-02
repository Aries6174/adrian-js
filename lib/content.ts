export type ProjectCategory =
  | "web"
  | "games"
  | "systems"
  | "experiments"
  | "academic";

export type Project = {
  id: string;
  title: string;
  headline: string[];
  tagline: string;
  summary: string;
  overview: string;
  tags: string[];
  features: string[];
  categories: ProjectCategory[];
  image: string;
  gallery: string[];
  live?: string;
  github?: string;
};

export const profile = {
  name: "Adrian Joel Jaspa",
  email: "adrian.jaspa@gmail.com",
  github: "https://github.com/AdrianJaspa",
  githubHandle: "AdrianJaspa",
  linkedin: "https://www.linkedin.com/in/adrian-jaspa",
  linkedinHandle: "adrian-jaspa",
  x: "https://x.com/adrian_js",
  xHandle: "@adrian_js",
  discord: "adrian.js",
  city: "Iloilo City",
  country: "Philippines",
  lat: 10.7202,
  lon: 122.5621,
};

export const navItems = [
  { href: "/home", label: "Home" },
  { href: "/projects", label: "Projects" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export const projects: Project[] = [
  {
    id: "elvicor",
    title: "Elvicor Management System",
    headline: ["Elvicor", "Management System"],
    tagline: "Property management",
    summary:
      "Full-stack property and rental management system for a commercial building.",
    overview:
      "Manage tenants, rental spaces, payments, receipts, and statements of account. Includes admin and tenant pages with real-world features based on an actual property management process.",
    tags: ["Next.js", "TypeScript", "Prisma", "PostgreSQL", "Tailwind CSS"],
    features: [
      "Tenant management",
      "Online payments and receipts",
      "Statements of account (SOA)",
      "Available spaces",
      "Admin and tenant dashboards",
      "Late fee handling",
    ],
    categories: ["web", "systems"],
    image: "/art/elvicor.webp",
    gallery: ["/art/elvicor.webp", "/art/elvicor-dash.webp"],
    github: "https://github.com/AdrianJaspa",
  },
  {
    id: "todo",
    title: "Todo App",
    headline: ["Todo", "App"],
    tagline: "Task management",
    summary: "A focused task management app with a clean dashboard.",
    overview:
      "A personal task manager built to practise the full Next.js workflow, from data modelling to a polished dashboard interface.",
    tags: ["Next.js", "TypeScript", "Tailwind CSS"],
    features: ["Task dashboard", "Create and organise tasks", "Responsive UI"],
    categories: ["web"],
    image: "/art/todo.webp",
    gallery: ["/art/todo.webp"],
    github: "https://github.com/AdrianJaspa",
  },
  {
    id: "up-visions",
    title: "UP: Visions",
    headline: ["UP:", "Visions"],
    tagline: "Educational visual novel",
    summary: "An educational visual novel made as an undergraduate thesis.",
    overview:
      "A thesis project at UP Visayas that uses visual novel storytelling to make learning feel like an experience rather than a lecture.",
    tags: ["Ren'Py", "Visual Novel", "Educational"],
    features: ["Branching story", "Educational content", "Thesis research"],
    categories: ["games", "academic"],
    image: "/art/up-visions.webp",
    gallery: ["/art/up-visions.webp"],
    github: "https://github.com/AdrianJaspa",
  },
  {
    id: "adrian-js",
    title: "Adrian.js (this portfolio)",
    headline: ["Adrian.js", "This Portfolio"],
    tagline: "Portfolio website",
    summary:
      "The site you are looking at: a cosmic archive rendered in real time.",
    overview:
      "A portfolio built as a place to explore. Every world is generated with Three.js and custom shaders, including a ray-marched black hole, rather than pre-rendered images.",
    tags: ["Next.js", "Three.js", "Tailwind CSS"],
    features: [
      "Ray-marched black hole",
      "Five procedural worlds",
      "Clickable 3D navigation",
      "Warp page transitions",
    ],
    categories: ["web", "experiments"],
    image: "/art/adrian.webp",
    gallery: ["/art/adrian.webp"],
    github: "https://github.com/AdrianJaspa",
  },
  {
    id: "other",
    title: "Other Projects",
    headline: ["Other", "Projects"],
    tagline: "Experiments and small apps",
    summary: "Experiments, small apps, and more to come.",
    overview:
      "A growing shelf of experiments and small applications. Each one is a chance to try an idea that does not need a whole system around it.",
    tags: ["Experiments", "Small Apps", "More to Come"],
    features: ["Quick prototypes", "Learning projects", "Ideas in progress"],
    categories: ["experiments"],
    image: "/art/other.webp",
    gallery: ["/art/other.webp"],
    github: "https://github.com/AdrianJaspa",
  },
];

export const projectFilters: {
  id: "all" | ProjectCategory;
  label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "web", label: "Web Apps" },
  { id: "games", label: "Games" },
  { id: "systems", label: "Systems" },
  { id: "experiments", label: "Experiments" },
  { id: "academic", label: "Academic" },
];

export const aboutSections = [
  { id: "intro", label: "Intro" },
  { id: "background", label: "Background" },
  { id: "skills", label: "Skills" },
  { id: "journey", label: "Journey" },
  { id: "interests", label: "Interests" },
];

export const techStack = [
  { name: "TypeScript", icon: "typescript" },
  { name: "React", icon: "react" },
  { name: "Next.js", icon: "next" },
  { name: "Tailwind CSS", icon: "tailwind" },
  { name: "Java", note: "learning", icon: "java" },
  { name: "Python", icon: "python" },
  { name: "PostgreSQL", note: "planned", icon: "postgres" },
  { name: "Git & GitHub", icon: "github" },
] as const;

export const journey = [
  { year: "2020", lines: ["STEM", "UE Manila"] },
  { year: "2022", lines: ["Started CS", "at UPV"] },
  { year: "2024", lines: ["Built real projects", "and joined OJT"] },
  { year: "2025", lines: ["Thesis: UP: Visions", "(Educational VN)"] },
  { year: "2026", lines: ["Graduated. Looking for", "opportunities"] },
];

export const interests = [
  { name: "Games", icon: "gamepad" },
  { name: "Art", icon: "palette" },
  { name: "Coding", icon: "code" },
  { name: "Storytelling", icon: "book" },
  { name: "Worldbuilding", icon: "world" },
] as const;
