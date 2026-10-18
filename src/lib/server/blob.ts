import { del, get, list, put } from "@vercel/blob";

// Production and everything else (local dev, previews) share one Blob store,
// so each gets its own folder and testing never touches real data.
const PREFIX = process.env.VERCEL_ENV === "production" ? "prod" : "dev";

export const blobPath = (path: string) => `${PREFIX}/${path}`;

export async function readJson(
  path: string,
): Promise<{ data: unknown; etag: string } | null> {
  const res = await get(blobPath(path), { access: "private", useCache: false });
  if (!res || res.statusCode !== 200) return null;
  const text = await new Response(res.stream).text();
  // Reads can come back with a weak ETag (W/"…"); conditional writes need the strong one.
  return { data: JSON.parse(text), etag: res.blob.etag.replace(/^W\//, "") };
}

/**
 * `ifMatch` only writes if nobody changed the file since it was read.
 * `create` refuses to overwrite an existing file.
 */
export async function writeJson(
  path: string,
  data: unknown,
  opts: { ifMatch?: string; create?: boolean } = {},
) {
  const res = await put(blobPath(path), JSON.stringify(data), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: !opts.create,
    ...(opts.ifMatch ? { ifMatch: opts.ifMatch } : {}),
  });
  return res.etag;
}

export async function removeJson(path: string) {
  await del(blobPath(path));
}

export async function listFiles(folder: string) {
  const prefix = blobPath(`${folder}/`);
  const files: { name: string; size: number; uploadedAt: Date }[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    for (const b of page.blobs) {
      files.push({
        name: b.pathname.slice(prefix.length),
        size: b.size,
        uploadedAt: b.uploadedAt,
      });
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return files;
}
