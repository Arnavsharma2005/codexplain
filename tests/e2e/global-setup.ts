import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import { writeFileSync, mkdirSync } from "node:fs";

/** Creates a test user and writes a signed-in storage state (no real OAuth needed). */
export default async function globalSetup() {
  const db = new PrismaClient();
  await db.analysisView.deleteMany();
  await db.analysis.deleteMany();
  await db.usageDay.deleteMany();
  await db.repoVisit.deleteMany();
  const user = await db.user.upsert({
    where: { email: "tester@example.com" },
    create: { email: "tester@example.com", name: "Test User", githubLogin: "tester" },
    update: {},
  });
  await db.$disconnect();

  const token = await encode({
    secret: process.env.NEXTAUTH_SECRET!,
    token: { sub: user.id, name: "Test User", email: "tester@example.com", login: "tester", accessToken: "gho_test" },
  });

  mkdirSync("tests/e2e/.auth", { recursive: true });
  writeFileSync(
    "tests/e2e/.auth/user.json",
    JSON.stringify({
      cookies: [
        { name: "next-auth.session-token", value: token, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Lax", expires: -1 },
      ],
      origins: [],
    }),
  );
}
