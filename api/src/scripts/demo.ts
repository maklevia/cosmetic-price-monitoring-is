import { AppDataSource } from "@api/config/data-source.js";
import { RabbitMqJobQueue } from "@api/modules/job/RabbitMqJobQueue.js";
import { JobType } from "@api/modules/job/jobTypes.js";
import { StoreName } from "@api/types/Enums.js";
import {
  DEMO_PRODUCTS,
  DemoProductFixture,
} from "@api/scripts/demoFixtures.js";

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "DemoPass123";
const DEMO_NAME = "Demo User";
const DEFAULT_REQUESTS = 24;
const REQUEST_DELAY_MS = 60;

type CookieJar = Record<string, string>;

interface DemoStoreRecord {
  id: number;
  productId: number;
  storeName: StoreName;
  price: number;
}

interface DemoProductResult {
  productId: number;
  records: DemoStoreRecord[];
}

interface JsonBody {
  [key: string]: unknown;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await AppDataSource.query(sql, params);
  return (Array.isArray(result) ? result : []) as T[];
}

function readRequestsArg(): number {
  const arg = process.argv.find((value) => value.startsWith("--requests="));
  if (!arg) return DEFAULT_REQUESTS;

  const value = Number(arg.slice("--requests=".length));
  if (!Number.isInteger(value) || value < 1 || value > 200) {
    throw new Error("--requests must be an integer between 1 and 200");
  }

  return value;
}

function buildUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

function getApiBase(): string {
  return process.env.API_INTERNAL_URL ?? "http://api:3001";
}

function getAuthBase(): string {
  if (process.env.AUTH_INTERNAL_URL) {
    return process.env.AUTH_INTERNAL_URL;
  }

  return `http://auth-service:${process.env.AUTH_SERVICE_PORT ?? "3002"}`;
}

function cookieHeader(jar: CookieJar): string {
  return Object.entries(jar)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function absorbCookies(response: Response, jar: CookieJar): void {
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookies =
    typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];

  for (const setCookie of setCookies) {
    const [pair] = setCookie.split(";");
    const separator = pair.indexOf("=");

    if (separator <= 0) continue;

    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1);
    jar[name] = value;
  }
}

async function request(
  base: string,
  path: string,
  init: RequestInit = {},
  jar?: CookieJar,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  if (jar) {
    const cookies = cookieHeader(jar);
    if (cookies) headers.set("Cookie", cookies);
  }

  const response = await fetch(buildUrl(base, path), {
    ...init,
    headers,
    redirect: "manual",
  });

  if (jar) {
    absorbCookies(response, jar);
  }

  return response;
}

async function readJson(response: Response): Promise<JsonBody | null> {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text) as JsonBody;
  } catch {
    return null;
  }
}

async function expectStatus(
  response: Response,
  expected: number[],
  label: string,
): Promise<void> {
  if (expected.includes(response.status)) return;

  const body = await response.text();
  throw new Error(`${label} returned ${response.status}: ${body}`);
}

async function ensureDemoUser(): Promise<{ jar: CookieJar; userId: number }> {
  const authBase = getAuthBase();
  const apiBase = getApiBase();
  const jar: CookieJar = {};
  const credentials = {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    name: DEMO_NAME,
  };

  const signup = await request(
    authBase,
    "/signup",
    { method: "POST", body: JSON.stringify(credentials) },
    jar,
  );

  if (signup.status === 409) {
    await signup.text();
    console.log(`[demo] ${DEMO_EMAIL} already exists; logging in`);
  } else {
    await expectStatus(signup, [201], "Signup");
  }

  // Generate an auth failure for the dashboard, then perform a real login.
  await request(authBase, "/login", {
    method: "POST",
    body: JSON.stringify({
      email: DEMO_EMAIL,
      enteredPassword: "wrong-demo-password",
    }),
  });

  const login = await request(
    authBase,
    "/login",
    {
      method: "POST",
      body: JSON.stringify({
        email: DEMO_EMAIL,
        enteredPassword: DEMO_PASSWORD,
      }),
    },
    jar,
  );
  await expectStatus(login, [200], "Login");

  const refresh = await request(
    authBase,
    "/refresh",
    { method: "POST" },
    jar,
  );
  await expectStatus(refresh, [200], "Token refresh");

  const profile = await request(apiBase, "/user/profile", { method: "GET" }, jar);
  await expectStatus(profile, [200], "User profile");
  const profileBody = await readJson(profile);
  const userId = Number(profileBody?.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("Could not determine the demo user ID");
  }

  return { jar, userId };
}

async function upsertProduct(
  fixture: DemoProductFixture,
): Promise<DemoProductResult> {
  const rows = await query<{ id: number }>(
    `SELECT "id" FROM "Products" WHERE "name" = $1 AND "brand" = $2 LIMIT 1`,
    [fixture.name, fixture.brand],
  );

  let productId = rows[0]?.id;

  if (!productId) {
    const inserted = await query<{ id: number }>(
      `INSERT INTO "Products"
        ("name", "brand", "image", "primary_store_name")
       VALUES ($1, $2, $3, $4::"store_name_enum")
       RETURNING "id"`,
      [fixture.name, fixture.brand, fixture.image, fixture.primaryStore],
    );
    productId = inserted[0].id;
  }

  for (const store of fixture.stores) {
    await query(
      `INSERT INTO "Store_Records"
        ("product_id", "store_name", "product_store_name", "link", "image",
         "latest_price", "in_stock", "parsed_at", "updated_at")
       VALUES ($1, $2::"store_name_enum", $3, $4, $5, $6, true, now(), now())
       ON CONFLICT ("product_id", "store_name") DO UPDATE SET
         "product_store_name" = EXCLUDED."product_store_name",
         "link" = EXCLUDED."link",
         "image" = EXCLUDED."image",
         "latest_price" = EXCLUDED."latest_price",
         "in_stock" = EXCLUDED."in_stock",
         "updated_at" = now()`,
      [
        productId,
        store.store,
        fixture.name,
        store.link,
        fixture.image,
        store.price,
      ],
    );
  }

  const records = await query<{
    id: number;
    store_name: StoreName;
    latest_price: number | null;
  }>(
    `SELECT "id", "store_name", "latest_price"
     FROM "Store_Records"
     WHERE "product_id" = $1
     ORDER BY "id"`,
    [productId],
  );

  return {
    productId,
    records: records.map((record) => ({
      id: record.id,
      productId,
      storeName: record.store_name,
      price: record.latest_price ?? 0,
    })),
  };
}

async function addToCollection(userId: number, productId: number): Promise<void> {
  await query(
    `INSERT INTO "Collections" ("user_id", "product_id", "notify_on_price_drop")
     SELECT $1, $2, true
     WHERE NOT EXISTS (
       SELECT 1 FROM "Collections" WHERE "user_id" = $1 AND "product_id" = $2
     )`,
    [userId, productId],
  );
}

async function seedPriceHistory(record: DemoStoreRecord): Promise<void> {
  const countRows = await query<{ count: number }>(
    `SELECT count(*)::int AS count
     FROM "Price_History"
     WHERE "store_record_id" = $1`,
    [record.id],
  );
  const existing = Number(countRows[0]?.count ?? 0);

  if (existing === 0) {
    const points: Array<{ daysAgo: number; factor: number }> = [
      { daysAgo: 7, factor: 1.12 },
      { daysAgo: 3, factor: 0.98 },
      { daysAgo: 1, factor: 1.04 },
      { daysAgo: 0, factor: 1 },
    ];

    for (const point of points) {
      await query(
        `INSERT INTO "Price_History"
          ("store_record_id", "store_name", "price", "in_stock", "recorded_at")
         VALUES ($1, $2::"Price_History_store_name_enum", $3, true,
                 now() - ($4 * interval '1 day'))`,
        [
          record.id,
          record.storeName,
          Math.max(1, Math.round(record.price * point.factor)),
          point.daysAgo,
        ],
      );
    }

    return;
  }

  await query(
    `INSERT INTO "Price_History"
      ("store_record_id", "store_name", "price", "in_stock", "recorded_at")
     VALUES ($1, $2::"Price_History_store_name_enum", $3, true, now())`,
    [record.id, record.storeName, record.price],
  );
}

async function seedPriceDrop(
  product: DemoProductResult,
  fixture: DemoProductFixture,
): Promise<void> {
  const pendingRows = await query<{ id: number }>(
    `SELECT "id" FROM "Price_Drop_Queue"
     WHERE "product_id" = $1 AND "status" = 'pending'
     LIMIT 1`,
    [product.productId],
  );

  if (pendingRows.length > 0) return;

  const preferredStore =
    product.records.find((record) => record.storeName === fixture.primaryStore) ??
    product.records[0];

  if (!preferredStore || preferredStore.price <= 0) return;

  await query(
    `INSERT INTO "Price_Drop_Queue"
      ("store_record_id", "product_id", "old_price", "new_price", "status")
     VALUES ($1, $2, $3, $4, 'pending')`,
    [
      preferredStore.id,
      product.productId,
      Math.round(preferredStore.price * 1.15),
      preferredStore.price,
    ],
  );
}

async function seedDemoData(
  userId: number,
): Promise<{ products: DemoProductResult[] }> {
  // The demo account is intentionally reset so rerunning the script produces
  // one fresh notification per product instead of duplicate in-app messages.
  await query(`DELETE FROM "User_Notifications" WHERE "user_id" = $1`, [userId]);

  const products: DemoProductResult[] = [];

  for (const fixture of DEMO_PRODUCTS) {
    const product = await upsertProduct(fixture);
    await addToCollection(userId, product.productId);

    for (const record of product.records) {
      await seedPriceHistory(record);
    }

    await seedPriceDrop(product, fixture);
    products.push(product);
  }

  return { products };
}

async function waitForJob(jobId: number): Promise<void> {
  const deadline = Date.now() + 20_000;

  while (Date.now() < deadline) {
    const rows = await query<{
      status: string;
      last_error: string | null;
    }>(
      `SELECT "status", "last_error" FROM "Parse_Jobs" WHERE "id" = $1`,
      [jobId],
    );
    const job = rows[0];

    if (!job) {
      throw new Error(`Job #${jobId} disappeared from Parse_Jobs`);
    }

    if (job.status === "done") return;

    if (job.status === "failed") {
      throw new Error(`Job #${jobId} failed: ${job.last_error ?? "unknown error"}`);
    }

    await sleep(500);
  }

  throw new Error(`Timed out waiting for job #${jobId}`);
}

async function generateHttpTraffic(
  jar: CookieJar,
  products: DemoProductResult[],
  requestCount: number,
): Promise<{ notifications: number }> {
  const apiBase = getApiBase();
  const authBase = getAuthBase();
  const productIds = products.map((product) => product.productId);
  const paths = [
    "/user/profile",
    "/product/collection?page=1&limit=8",
    productIds[0]
      ? `/product/${productIds[0]}/details`
      : "/product/collection?page=1&limit=8",
    "/notification/getAll",
  ];

  // These produce ordinary 401/404 series without generating 5xx noise.
  await request(apiBase, "/product/collection", { method: "GET" });
  await request(
    apiBase,
    "/product/999999/details",
    { method: "GET" },
    jar,
  );

  for (let index = 0; index < requestCount; index += 1) {
    const response = await request(
      apiBase,
      paths[index % paths.length],
      { method: "GET" },
      jar,
    );

    if (response.status >= 500) {
      console.warn(`[demo] API ${paths[index % paths.length]} returned ${response.status}`);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  const profile = await request(
    apiBase,
    "/user/updateName",
    {
      method: "PATCH",
      body: JSON.stringify({ newName: DEMO_NAME }),
    },
    jar,
  );
  await expectStatus(profile, [200], "Update user name");

  const notificationsResponse = await request(
    apiBase,
    "/notification/getAll",
    { method: "GET" },
    jar,
  );
  await expectStatus(notificationsResponse, [200], "Get notifications");
  const notificationsBody = await readJson(notificationsResponse);
  const notifications = Array.isArray(notificationsBody?.notifications)
    ? (notificationsBody.notifications as JsonBody[])
    : [];

  const firstUnread = notifications.find((notification) => notification.isRead === false);
  if (firstUnread && typeof firstUnread.notifId === "number") {
    await request(
      apiBase,
      `/notification/${firstUnread.notifId}/markAsRead`,
      { method: "PATCH" },
      jar,
    );
  }

  // Keep one failed login in the auth metrics without logging the user out.
  await request(authBase, "/login", {
    method: "POST",
    body: JSON.stringify({
      email: DEMO_EMAIL,
      enteredPassword: "still-wrong",
    }),
  });

  return { notifications: notifications.length };
}

async function enqueueJobs(
  products: DemoProductResult[],
  withParser: boolean,
): Promise<number[]> {
  const queue = new RabbitMqJobQueue();
  const createdJobs: number[] = [];

  try {
    const notificationJob = await queue.enqueue({
      type: JobType.NotificationsDispatch,
      payload: { requestedAt: new Date().toISOString() },
    });
    createdJobs.push(notificationJob);
    await waitForJob(notificationJob);

    if (withParser) {
      const queuedProducts = new Set<number>();

      for (const product of products) {
        const record = product.records[0];

        if (!record || queuedProducts.has(product.productId)) continue;

        queuedProducts.add(product.productId);
        const parserJob = await queue.enqueue({
          type: JobType.ParseStoreRecord,
          store: record.storeName,
          payload: { storeRecordId: record.id },
        });
        createdJobs.push(parserJob);
      }
    }

    return createdJobs;
  } finally {
    await queue.close();
  }
}

async function main(): Promise<void> {
  const withParser = process.argv.includes("--with-parser");
  const requestCount = readRequestsArg();

  await AppDataSource.initialize();

  try {
    console.log(`[demo] Demo account: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
    const { jar, userId } = await ensureDemoUser();
    const { products } = await seedDemoData(userId);

    console.log(
      `[demo] Seeded ${products.length} products, ${products.reduce(
        (sum, product) => sum + product.records.length,
        0,
      )} store records and price history`,
    );

    const createdJobs = await enqueueJobs(products, withParser);
    const traffic = await generateHttpTraffic(jar, products, requestCount);

    const parserNote = withParser
      ? `Parser jobs: ${createdJobs.length - 1} queued (external store availability applies)`
      : "Parser jobs: not queued (use --with-parser to try real store links)";

    console.log(`[demo] HTTP requests generated: ~${requestCount + 7}`);
    console.log(`[demo] In-app notifications visible: ${traffic.notifications}`);
    console.log(`[demo] Notification job: #${createdJobs[0] ?? "none"}`);
    console.log(`[demo] ${parserNote}`);
    console.log(
      "[demo] Open Grafana: http://localhost:3000/d/cosmetics-overview",
    );
    console.log(
      "[demo] Log in to the app with the demo account and open the collection/notifications",
    );

    await sleep(500);
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  console.error("[demo] Failed:", error);
  process.exitCode = 1;
});
