import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import { writeFileSync, mkdirSync } from "node:fs";

/** Creates a test user and writes a signed-in storage state (no real OAuth needed). */
export default async function globalSetup() {
  const db = new PrismaClient();
  await db.intelIndex.deleteMany();
  await db.$executeRaw`DELETE FROM "IntelEmbedding"`;
  await db.analysisView.deleteMany();
  await db.analysis.deleteMany();
  await db.usageDay.deleteMany();
  await db.repoVisit.deleteMany();
  const user = await db.user.upsert({
    where: { email: "tester@example.com" },
    create: { email: "tester@example.com", name: "Test User", githubLogin: "tester" },
    update: {},
  });
  // A second user for the repo intelligence suite, so its questions don't spend the main user's quota.
  const intelUser = await db.user.upsert({
    where: { email: "intel@example.com" },
    create: { email: "intel@example.com", name: "Intel User", githubLogin: "intel" },
    update: {},
  });
  await db.$disconnect();

  mkdirSync("tests/e2e/.auth", { recursive: true });
  for (const [file, u, login] of [
    ["user.json", user, "tester"],
    ["intel.json", intelUser, "intel"],
  ] as const) {
    const token = await encode({
      secret: process.env.NEXTAUTH_SECRET!,
      token: { sub: u.id, name: u.name, email: u.email, login, accessToken: "gho_test" },
    });
    writeFileSync(
      `tests/e2e/.auth/${file}`,
      JSON.stringify({
        cookies: [
          { name: "next-auth.session-token", value: token, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Lax", expires: -1 },
        ],
        origins: [],
      }),
    );
  }
}
