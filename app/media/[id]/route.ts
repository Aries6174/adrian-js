import { getMedia } from "@/lib/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const media = /^[0-9a-f]+$/.test(id) ? await getMedia(id).catch(() => null) : null;
  if (!media) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(media.bytes), {
    headers: {
      "Content-Type": media.type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      ...(media.type === "application/pdf"
        ? { "Content-Disposition": 'inline; filename="Jaspa_Resume.pdf"' }
        : {}),
    },
  });
}
