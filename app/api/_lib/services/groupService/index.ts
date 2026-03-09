import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { groups, groupMembers } from "@/lib/db/schema";

export interface Group {
  id: string;
  name: string;
  joinKey: string;
  ltiContextId: string | null;
  ltiContextTitle: string | null;
  resourceLinkId: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: "instructor" | "member";
  joinedAt: Date;
}

export interface GroupWithMembers extends Group {
  members: GroupMember[];
}

export interface CreateGroupOptions {
  name: string;
  ltiContextId?: string;
  ltiContextTitle?: string;
  resourceLinkId?: string;
  createdBy?: string;
}

export interface AddMemberOptions {
  groupId: string;
  userId: string;
  role?: "instructor" | "member";
}

function mapGroup(row: typeof groups.$inferSelect): Group {
  return {
    id: row.id,
    name: row.name,
    joinKey: row.joinKey,
    ltiContextId: row.ltiContextId,
    ltiContextTitle: row.ltiContextTitle,
    resourceLinkId: row.resourceLinkId,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapGroupMember(row: typeof groupMembers.$inferSelect): GroupMember {
  return {
    id: row.id,
    groupId: row.groupId,
    userId: row.userId,
    role: row.role,
    joinedAt: row.joinedAt,
  };
}

function generateJoinKey(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function createGroup(options: CreateGroupOptions): Promise<Group> {
  const db = getDb();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await db.insert(groups).values({
      name: options.name,
      joinKey: generateJoinKey(),
      ltiContextId: options.ltiContextId ?? null,
      ltiContextTitle: options.ltiContextTitle ?? null,
      resourceLinkId: options.resourceLinkId ?? null,
      createdBy: options.createdBy ?? null,
    }).onConflictDoNothing().returning();

    if (result.length > 0) {
      return mapGroup(result[0]);
    }
  }

  throw new Error("Failed to create group");
}

export async function getGroupById(groupId: string): Promise<Group | null> {
  const db = getDb();
  
  const result = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  
  if (result.length === 0) {
    return null;
  }
  
  return mapGroup(result[0]);
}

export async function getGroupByLtiContextId(ltiContextId: string): Promise<Group | null> {
  const db = getDb();
  
  const result = await db.select().from(groups).where(eq(groups.ltiContextId, ltiContextId)).limit(1);
  
  if (result.length === 0) {
    return null;
  }
  
  return mapGroup(result[0]);
}

export async function getOrCreateGroupByLtiContext(
  ltiContextId: string,
  name: string,
  resourceLinkId?: string
): Promise<Group> {
  const existing = await getGroupByLtiContextId(ltiContextId);
  if (existing) {
    return existing;
  }
  
  return createGroup({
    name,
    ltiContextId,
    ltiContextTitle: name,
    resourceLinkId,
  });
}

export async function addGroupMember(options: AddMemberOptions): Promise<GroupMember> {
  const db = getDb();
  const role = options.role ?? "member";
  
  const result = await db.insert(groupMembers).values({
    groupId: options.groupId,
    userId: options.userId,
    role,
  }).onConflictDoUpdate({
    target: [groupMembers.groupId, groupMembers.userId],
    set: { role },
  }).returning();
  
  if (result.length === 0) {
    throw new Error("Failed to add group member");
  }
  
  return mapGroupMember(result[0]);
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const db = getDb();
  
  const result = await db.select()
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId))
    .orderBy(groupMembers.joinedAt);
  
  return result.map(mapGroupMember);
}

export async function getUserGroups(userId: string): Promise<Group[]> {
  const db = getDb();
  
  const result = await db.select({ group: groups })
    .from(groups)
    .innerJoin(groupMembers, eq(groups.id, groupMembers.groupId))
    .where(eq(groupMembers.userId, userId))
    .orderBy(groups.createdAt);
  
  return result.map((row) => mapGroup(row.group));
}

export async function getGroupsForContext(options: {
  ltiContextId?: string | null;
  resourceLinkId?: string | null;
}): Promise<Group[]> {
  const db = getDb();

  if (!options.ltiContextId && !options.resourceLinkId) {
    return [];
  }

  const filters = [];
  if (options.ltiContextId) {
    filters.push(eq(groups.ltiContextId, options.ltiContextId));
  }
  if (options.resourceLinkId) {
    filters.push(eq(groups.resourceLinkId, options.resourceLinkId));
  }

  const whereClause = filters.length === 1 ? filters[0] : and(...filters);
  if (!whereClause) {
    return [];
  }

  const result = await db.select().from(groups).where(whereClause).orderBy(groups.createdAt);
  return result.map(mapGroup);
}

export async function isGroupMember(groupId: string, userId: string): Promise<boolean> {
  const db = getDb();
  
  const result = await db.select({ id: groupMembers.id })
    .from(groupMembers)
    .where(and(
      eq(groupMembers.groupId, groupId),
      eq(groupMembers.userId, userId)
    ))
    .limit(1);
  
  return result.length > 0;
}

export async function removeGroupMember(groupId: string, userId: string): Promise<boolean> {
  const db = getDb();
  
  await db.delete(groupMembers).where(and(
    eq(groupMembers.groupId, groupId),
    eq(groupMembers.userId, userId)
  ));
  
  return true;
}

export async function deleteGroup(groupId: string): Promise<boolean> {
  const db = getDb();
  
  await db.delete(groupMembers).where(eq(groupMembers.groupId, groupId));
  await db.delete(groups).where(eq(groups.id, groupId));
  
  return true;
}
