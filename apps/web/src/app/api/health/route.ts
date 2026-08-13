import { env } from "@dispatch/config";
import { prisma } from "@dispatch/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      dryRun: env.SEND_DRY_RUN,
      time: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "database unreachable" }, { status: 503 });
  }
}
