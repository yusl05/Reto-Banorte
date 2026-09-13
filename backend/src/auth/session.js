import crypto from "crypto";

const sessions = new Map();
const COOKIE_NAME = "banorte_session";
const DEMO_USER_ID = "demo-user";

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([key, value]) => key && value)
      .map(([key, ...value]) => [key, decodeURIComponent(value.join("="))])
  );
}

export function createDemoSession(_req, res) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { userId: DEMO_USER_ID, createdAt: Date.now() });
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`
  );
  res.json({ userId: DEMO_USER_ID });
}

export function requireSession(req, res, next) {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  const session = token && sessions.get(token);
  if (!session) {
    return res.status(401).json({ error: "Sesión requerida" });
  }
  req.userId = session.userId;
  next();
}
