import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

const BodySchema = z.object({
  venueId: z.string().min(1).max(64),
  poiId: z.string().min(1).max(64),
  crowdLevel: z.number().int().min(-1).max(3),
  waitMinutes: z.number().int().min(0).max(180),
});

function unauthorised() {
  return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
}

export async function POST(req: Request) {
  const passcode = req.headers.get("x-admin-passcode");
  const expected = process.env.ADMIN_PASSCODE;
  if (!expected || passcode !== expected) return unauthorised();

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { venueId, poiId, crowdLevel, waitMinutes } = parsed.data;

  try {
    const { db } = getAdmin();
    await db
      .collection("venues")
      .doc(venueId)
      .collection("pois")
      .doc(poiId)
      .update({
        crowdLevel,
        waitMinutes,
        updatedAt: Date.now(),
      });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
