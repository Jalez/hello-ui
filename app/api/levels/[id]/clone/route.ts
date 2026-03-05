import { NextRequest, NextResponse } from "next/server";
import { createLevel, getLevelByIdentifier } from "@/app/api/_lib/services/levelService";
import debug from "debug";

const logger = debug("ui_designer:api:levels:clone");

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ message: "Invalid level identifier" }, { status: 400 });
    }

    const sourceLevel = await getLevelByIdentifier(id);
    if (!sourceLevel) {
      return NextResponse.json({ message: "Level not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const customName = typeof body?.name === "string" ? body.name.trim() : "";
    const name = customName || `${sourceLevel.name} (Copy)`;

    const cloned = await createLevel({
      name,
      json: sourceLevel.json,
    });

    return NextResponse.json(
      {
        identifier: cloned.identifier,
        name: cloned.name,
        ...cloned.json,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    logger("Error cloning level: %O", error);
    return NextResponse.json(
      { message: "Failed to clone level" },
      { status: 500 },
    );
  }
}

