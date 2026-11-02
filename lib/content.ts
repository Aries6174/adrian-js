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
  /** Logos are shown whole; photos fill their frame. */
  fit?: "contain";
  /** Keeps the important part of a photo in view in wide, short frames. */
  imagePosition?: string;
  gallery: string[];
  credit?: string;
  live?: string;
  github?: string;
  createdAt: string;
};

export type Profile = {
  name: string;
  email: string;
  github: string;
  githubHandle: string;
  linkedin: string;
  linkedinHandle: string;
  x: string;
  xHandle: string;
  discord: string;
  resume: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
};

export type TechItem = { name: string; note?: string; icon: string };
export type JourneyItem = { year: string; lines: string[] };
export type InterestItem = { name: string; icon: string };

export type About = {
  heading: string;
  body: string;
  image: string;
  imageAlt: string;
  caption: string[];
  techStack: TechItem[];
  education: {
    degree: string;
    school: string;
    place: string;
    years: string;
    earlierTitle: string;
    earlierSchool: string;
    earlierYears: string;
    image: string;
    imageAlt: string;
    credit: string;
    creditLink?: string;
  };
  journey: JourneyItem[];
  interests: InterestItem[];
  quote: string;
};

/** The three short cards along the bottom of the Home page. */
export type HomeCards = {
  about: string;
  skills: string;
  contact: string;
};

export type SiteContent = {
  profile: Profile;
  projects: Project[];
  about: About;
  home: HomeCards;
};

export const ICON_OPTIONS = [
  "typescript",
  "react",
  "next",
  "tailwind",
  "java",
  "python",
  "postgres",
  "github",
  "code",
  "gamepad",
  "palette",
  "book",
  "world",
  "mail",
  "resume",
];

export const navItems = [
  { href: "/home", label: "Home" },
  { href: "/projects", label: "Projects" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
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

export function newestFirst(projects: Project[]) {
  return [...projects].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const GITHUB = "https://github.com/Aries6174";

/** What the site shows until something has been saved from the admin page. */
export const DEFAULT_CONTENT: SiteContent = {
  profile: {
    name: "Adrian Joel Jaspa",
    email: "Joel.Adrian6174@gmail.com",
    github: GITHUB,
    githubHandle: "Aries6174",
    linkedin: "https://www.linkedin.com/in/adrianjaspa",
    linkedinHandle: "adrianjaspa",
    x: "https://x.com/Aries_Leevi",
    xHandle: "@Aries_Leevi",
    discord: "dlbaries",
    resume: "/Jaspa_Resume.pdf",
    city: "Iloilo City",
    country: "Philippines",
    lat: 10.7202,
    lon: 122.5621,
  },
  projects: [
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
      imagePosition: "center 34%",
      gallery: ["/art/elvicor.webp", "/art/elvicor-dash.webp"],
      credit: "Dashboard placeholder: Luke Chesser on Unsplash.",
      github: GITHUB,
      createdAt: "2026-05-05T00:00:00.000Z",
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
      fit: "contain",
      gallery: ["/art/todo.webp"],
      github: GITHUB,
      createdAt: "2026-05-04T00:00:00.000Z",
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
      imagePosition: "center 34%",
      gallery: ["/art/up-visions.webp"],
      github: GITHUB,
      createdAt: "2026-05-03T00:00:00.000Z",
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
      github: GITHUB,
      createdAt: "2026-05-02T00:00:00.000Z",
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
      github: GITHUB,
      createdAt: "2026-05-01T00:00:00.000Z",
    },
  ],
  about: {
    heading: "A developer who turns ideas into experiences.",
    body: "I'm Adrian, a Computer and Information Science graduate who enjoys building interactive and meaningful web experiences. I like combining technology, design, and storytelling to create projects that feel unique and engaging.",
    image: "/art/world.webp",
    imageAlt: "A black hole over a dark sea, rendered in real time",
    caption: ["Somewhere between", "code and the stars"],
    techStack: [
      { name: "TypeScript", icon: "typescript" },
      { name: "React", icon: "react" },
      { name: "Next.js", icon: "next" },
      { name: "Tailwind CSS", icon: "tailwind" },
      { name: "Java", note: "learning", icon: "java" },
      { name: "Python", icon: "python" },
      { name: "PostgreSQL", note: "planned", icon: "postgres" },
      { name: "Git & GitHub", icon: "github" },
    ],
    education: {
      degree: "BS Computer and Information Science",
      school: "University of the Philippines Visayas",
      place: "Miagao, Iloilo",
      years: "2022 - 2026",
      earlierTitle: "Senior High School (STEM)",
      earlierSchool: "University of the East Manila",
      earlierYears: "2020 - 2022",
      image: "/art/campus.webp",
      imageAlt: "The New Administration Building at UP Visayas in Miagao",
      credit: "Photo (cropped): Ralff Nestor Nacor, CC BY-SA 4.0",
      creditLink: "https://commons.wikimedia.org/wiki/File:UPV_Miagao_New_Admin_Bldg.,_Aug_2024.jpg",
    },
    journey: [
      { year: "2020", lines: ["STEM", "UE Manila"] },
      { year: "2022", lines: ["Started CS", "at UPV"] },
      { year: "2024", lines: ["Built real projects", "and joined OJT"] },
      { year: "2025", lines: ["Thesis: UP: Visions", "(Educational VN)"] },
      { year: "2026", lines: ["Graduated. Looking for", "opportunities"] },
    ],
    interests: [
      { name: "Games", icon: "gamepad" },
      { name: "Art", icon: "palette" },
      { name: "Coding", icon: "code" },
      { name: "Storytelling", icon: "book" },
      { name: "Worldbuilding", icon: "world" },
    ],
    quote: "Exploring worlds both real and imagined through technology.",
  },
  home: {
    about:
      "A Computer and Information Science graduate building interactive and meaningful web experiences.",
    skills:
      "TypeScript, React, Next.js, Tailwind CSS. Learning Java, Python and PostgreSQL along the way.",
    contact: "Open to new opportunities, collaborations and exciting projects.",
  },
};
