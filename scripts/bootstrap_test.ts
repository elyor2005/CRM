// Bootstrap script to guarantee DATABASE_URL is pointing to preview_test before any modules load
process.env.DATABASE_URL =
  "postgresql://neondb_owner:npg_xXVo0zLEleH8@ep-restless-meadow-b4qxavuq.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=preview_test";
process.env.DATABASE_URL_UNPOOLED =
  "postgresql://neondb_owner:npg_xXVo0zLEleH8@ep-restless-meadow-b4qxavuq.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=preview_test";

async function run() {
  await import("./run_full_verification");
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
