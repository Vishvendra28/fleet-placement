import { NextResponse } from "next/server";

export function apiError(err: unknown): NextResponse {
  const e = err as { code?: string; message?: string };
  console.error("[API]", e.code ?? "unknown", e.message ?? String(err));
  if (e.code === "P2025") return NextResponse.json({ error: "Record not found." }, { status: 404 });
  if (e.code === "P2002") return NextResponse.json({ error: "Duplicate entry — this record already exists." }, { status: 409 });
  if (e.code === "P2003") return NextResponse.json({ error: "Cannot complete — linked records exist." }, { status: 400 });
  if (e.code === "P2034") return NextResponse.json({ error: "Conflict — please retry." }, { status: 409 });
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
