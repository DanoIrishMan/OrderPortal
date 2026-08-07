import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { commitPathwayCsvImport, previewPathwayCsvImport } from "@/lib/pathway-csv-parser";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const commit = formData.get("commit") === "true";
  const notifyAssignees = formData.get("notifyAssignees") !== "false";

  if (!file) {
    return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
  }

  const content = await file.text();
  const preview = await previewPathwayCsvImport(content);

  if (!commit) {
    return NextResponse.json({ mode: "preview", ...preview });
  }

  if (preview.errors.length > 0) {
    return NextResponse.json(
      {
        error: "Fix CSV errors before importing",
        preview,
      },
      { status: 400 }
    );
  }

  const result = await commitPathwayCsvImport(content, notifyAssignees);
  return NextResponse.json({ mode: "import", preview, ...result });
}
