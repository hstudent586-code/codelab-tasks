// Точка входу: налаштування зі змінних оточення (12-factor), міграція бази, запуск сервера.
import { buildApp } from "./app.js";
import { MemoryRepo, PgRepo, type TaskRepo } from "./repo.js";

const env = (k: string, d: string) => process.env[k] ?? d;

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  let repo: TaskRepo;
  if (dbUrl) {
    const pg = new PgRepo(dbUrl);
    await pg.migrate();
    repo = pg;
  } else {
    console.warn("DATABASE_URL не задано – дані зберігаються лише в пам'яті");
    repo = new MemoryRepo();
  }

  const app = buildApp(
    repo,
    { version: env("APP_VERSION", "dev"), commit: env("GIT_SHA", "local"), builtAt: env("BUILD_TIME", "-"), env: env("APP_ENV", "local") },
    true,
  );

  const stop = async () => {
    await app.close();
    await repo.close();
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  await app.listen({ host: "0.0.0.0", port: Number(env("PORT", "3000")) });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
