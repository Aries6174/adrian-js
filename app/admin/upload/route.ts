import sharp from "sharp";
import { isAdmin } from "@/lib/auth";
import { addMedia } from "@/lib/store";

const MAX_BYTES = 4 * 1024 * 1024;

function sameHost(origin: string, host: string | null) {
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "Please log in again." }, { status: 401 });

  const origin = request.headers.get("origin");
  if (origin && !sameHost(origin, request.headers.get("host"))) {
    return Response.json({ error: "Request refused." }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file was sent." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Files can be up to 4 MB." }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (form.get("kind") === "pdf") {
    if (Buffer.from(bytes.subarray(0, 5)).toString("latin1") !== "%PDF-") {
      return Response.json({ error: "That file is not a PDF." }, { status: 400 });
    }
    return save("application/pdf", bytes);
  }

  // Re-encoding rejects anything that is not really an image, and strips hidden metadata.
  let webp: Buffer;
  try {
    webp = await sharp(bytes)
      .rotate()
      .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer();
  } catch {
    return Response.json({ error: "That file is not an image this site can use." }, { status: 400 });
  }
  return save("image/webp", webp);
}

async function save(type: string, bytes: Uint8Array) {
  try {
    return Response.json({ url: await addMedia(type, bytes) });
  } catch (error) {
    console.error("Could not save the upload.", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not save the file." },
      { status: 500 },
    );
  }
}
