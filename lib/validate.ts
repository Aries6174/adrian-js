import "server-only";

import {
  type About,
  type HomeCards,
  ICON_OPTIONS,
  type Profile,
  type Project,
  type ProjectCategory,
  projectFilters,
} from "./content";

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const SITE_FILE = /^\/(art\/[\w.-]+|media\/[0-9a-f]+|[\w-]+\.pdf)$/;

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function required(value: unknown, max: number, label: string) {
  const result = text(value, max);
  if (!result) throw new Error(`${label} is required.`);
  return result;
}

function list(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, maxItems)
    .map((item) => text(item, maxLength))
    .filter(Boolean);
}

/** Only http and https, so a saved link can never run a script when clicked. */
function link(value: unknown, label: string) {
  const result = text(value, 500);
  if (!result) return "";
  let url: URL;
  try {
    url = new URL(result);
  } catch {
    throw new Error(`${label} must be a full link starting with https://`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`${label} must be a full link starting with https://`);
  }
  return result;
}

function siteFile(value: unknown, label: string) {
  const result = text(value, 200);
  if (!SITE_FILE.test(result)) throw new Error(`${label} needs an uploaded file.`);
  return result;
}

function icon(value: unknown) {
  const result = text(value, 40);
  return ICON_OPTIONS.includes(result) ? result : "code";
}

export function isEmail(value: string) {
  return value.length <= 200 && EMAIL.test(value);
}

export function cleanProject(input: Partial<Project>): Omit<Project, "id" | "createdAt"> {
  const title = required(input.title, 80, "Title");
  const known = projectFilters.map((filter) => String(filter.id)).filter((id) => id !== "all");
  const categories = (Array.isArray(input.categories) ? input.categories : []).filter(
    (category): category is ProjectCategory => known.includes(category),
  );
  const image = siteFile(input.image, "Main image");
  const extra = (Array.isArray(input.gallery) ? input.gallery : [])
    .slice(1, 2)
    .filter(Boolean)
    .map((file) => siteFile(file, "Second image"));
  const headline = list(input.headline, 2, 60);
  const position = text(input.imagePosition, 30);
  const credit = text(input.credit, 200);
  const live = link(input.live, "Live link");
  const github = link(input.github, "GitHub link");
  return {
    title,
    headline: headline.length ? headline : [title],
    tagline: text(input.tagline, 80),
    summary: text(input.summary, 400),
    overview: text(input.overview, 2000),
    tags: list(input.tags, 12, 40),
    features: list(input.features, 20, 120),
    categories,
    image,
    gallery: [image, ...extra],
    ...(input.fit === "contain" ? { fit: "contain" as const } : {}),
    ...(/^[\w %]+$/.test(position) ? { imagePosition: position } : {}),
    ...(credit ? { credit } : {}),
    ...(live ? { live } : {}),
    ...(github ? { github } : {}),
  };
}

export function cleanProfile(input: Partial<Profile>): Profile {
  const email = required(input.email, 200, "Email");
  if (!isEmail(email)) throw new Error("Email does not look valid.");
  const lat = Number(input.lat);
  const lon = Number(input.lon);
  if (!(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) {
    throw new Error("Latitude and longitude must be valid coordinates.");
  }
  return {
    name: required(input.name, 80, "Name"),
    email,
    github: link(input.github, "GitHub link"),
    githubHandle: text(input.githubHandle, 60),
    linkedin: link(input.linkedin, "LinkedIn link"),
    linkedinHandle: text(input.linkedinHandle, 60),
    x: link(input.x, "X link"),
    xHandle: text(input.xHandle, 60),
    discord: text(input.discord, 60),
    resume: siteFile(input.resume, "Resume"),
    city: text(input.city, 80),
    country: text(input.country, 80),
    lat,
    lon,
  };
}

export function cleanHome(input: Partial<HomeCards>): HomeCards {
  return {
    about: text(input.about, 240),
    skills: text(input.skills, 240),
    contact: text(input.contact, 240),
  };
}

export function cleanAbout(input: Partial<About>): About {
  const education = (input.education ?? {}) as Partial<About["education"]>;
  return {
    heading: required(input.heading, 160, "Heading"),
    body: required(input.body, 1500, "Intro text"),
    image: siteFile(input.image, "Intro image"),
    imageAlt: text(input.imageAlt, 200),
    caption: list(input.caption, 2, 60),
    techStack: (Array.isArray(input.techStack) ? input.techStack : [])
      .slice(0, 16)
      .map((item) => {
        const note = text(item?.note, 30);
        return { name: text(item?.name, 40), icon: icon(item?.icon), ...(note ? { note } : {}) };
      })
      .filter((item) => item.name),
    education: {
      degree: text(education.degree, 120),
      school: text(education.school, 120),
      place: text(education.place, 120),
      years: text(education.years, 40),
      earlierTitle: text(education.earlierTitle, 120),
      earlierSchool: text(education.earlierSchool, 120),
      earlierYears: text(education.earlierYears, 40),
      image: siteFile(education.image, "Education image"),
      imageAlt: text(education.imageAlt, 200),
      credit: text(education.credit, 120),
      ...(link(education.creditLink, "Photo credit link")
        ? { creditLink: link(education.creditLink, "Photo credit link") }
        : {}),
    },
    journey: (Array.isArray(input.journey) ? input.journey : [])
      .slice(0, 10)
      .map((item) => ({ year: text(item?.year, 20), lines: list(item?.lines, 3, 60) }))
      .filter((item) => item.year),
    interests: (Array.isArray(input.interests) ? input.interests : [])
      .slice(0, 8)
      .map((item) => ({ name: text(item?.name, 40), icon: icon(item?.icon) }))
      .filter((item) => item.name),
    quote: text(input.quote, 240),
  };
}
