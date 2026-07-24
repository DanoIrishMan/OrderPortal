import fs from "fs/promises";
import path from "path";

export async function ensureUploadDir(): Promise<string> {
  const dir = process.env.UPLOAD_DIR || "./uploads";
  const absolute = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
  await fs.mkdir(absolute, { recursive: true });
  return absolute;
}

export async function saveUploadedFile(
  file: File,
  subdir: string
): Promise<{ filePath: string; filename: string }> {
  const uploadDir = await ensureUploadDir();
  const targetDir = path.join(uploadDir, subdir);
  await fs.mkdir(targetDir, { recursive: true });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}-${safeName}`;
  const filePath = path.join(targetDir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filePath, buffer);

  return { filePath, filename };
}
