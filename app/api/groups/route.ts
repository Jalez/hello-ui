import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createGroup,
  getGroupsForContext,
  getUserGroups,
  type CreateGroupOptions,
} from "@/app/api/_lib/services/groupService";
import { getOrCreateUserByEmail } from "@/app/api/_lib/services/userService";

function toPublicGroup(group: {
  id: string;
  name: string;
  ltiContextId: string | null;
  ltiContextTitle: string | null;
  resourceLinkId: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}, options?: { isMember?: boolean }) {
  return {
    id: group.id,
    name: group.name,
    ltiContextId: group.ltiContextId,
    ltiContextTitle: group.ltiContextTitle,
    resourceLinkId: group.resourceLinkId,
    createdBy: group.createdBy,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    isMember: Boolean(options?.isMember),
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getOrCreateUserByEmail(session.user.email);
    const ltiContextId = request.nextUrl.searchParams.get("ltiContextId");
    const resourceLinkId = request.nextUrl.searchParams.get("resourceLinkId");

    const [userGroups, contextGroups] = await Promise.all([
      getUserGroups(user.id),
      getGroupsForContext({ ltiContextId, resourceLinkId }),
    ]);

    const groups = [...userGroups, ...contextGroups].filter((group, index, all) =>
      all.findIndex((candidate) => candidate.id === group.id) === index
    );
    const memberIds = new Set(userGroups.map((group) => group.id));

    return NextResponse.json({
      groups: groups.map((group) => toPublicGroup(group, { isMember: memberIds.has(group.id) })),
    });
  } catch (error) {
    console.error("Error fetching groups:", error);
    return NextResponse.json({ error: "Failed to fetch groups" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getOrCreateUserByEmail(session.user.email);
    const body = await request.json();

    const { name, ltiContextId, ltiContextTitle, resourceLinkId } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Group name is required" }, { status: 400 });
    }

    const options: CreateGroupOptions = {
      name: name.trim(),
      createdBy: user.id,
    };

    if (ltiContextId) options.ltiContextId = ltiContextId;
    if (ltiContextTitle) options.ltiContextTitle = ltiContextTitle;
    if (resourceLinkId) options.resourceLinkId = resourceLinkId;

    const group = await createGroup(options);

    const { addGroupMember } = await import("@/app/api/_lib/services/groupService");
    await addGroupMember({
      groupId: group.id,
      userId: user.id,
      role: "instructor",
    });

    return NextResponse.json({ group: toPublicGroup(group) }, { status: 201 });
  } catch (error) {
    console.error("Error creating group:", error);
    return NextResponse.json({ error: "Failed to create group" }, { status: 500 });
  }
}
