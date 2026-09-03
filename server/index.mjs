import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calculateValuation } from "./valuation.mjs";

const app = express();
const port = Number(process.env.PORT ?? 8787);
const apiKey = process.env.ZILLAPI_API_KEY;
const apiBaseUrl = "https://api.zillapi.com";
const here = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(here, "../dist");

app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, configured: Boolean(apiKey) });
});

async function getZillApi(pathname, query = {}) {
  if (!apiKey) {
    const error = new Error("The local server is missing its ZillAPI key.");
    error.status = 503;
    throw error;
  }

  const url = new URL(pathname, apiBaseUrl);
  for (const [name, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) url.searchParams.set(name, String(value));
  }

  const upstream = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(30_000),
  });

  const payload = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const error = new Error(payload?.error?.message ?? "ZillAPI could not complete this lookup.");
    error.status = upstream.status;
    error.code = payload?.error?.code;
    throw error;
  }
  return payload;
}

app.post("/api/evaluate", async (request, response) => {
  const address = typeof request.body?.address === "string" ? request.body.address.trim() : "";
  if (address.length < 6) {
    return response.status(400).json({ error: "Enter a full US street address, including city and state." });
  }

  try {
    const propertyResponse = await getZillApi("/v1/properties/by-address", {
      address,
      status: "FOR_SALE",
    });
    const property = Array.isArray(propertyResponse.data)
      ? propertyResponse.data[0]
      : propertyResponse.data;

    if (!property?.zpid) {
      return response.status(404).json({ error: "No for-sale property was found at that address." });
    }

    const nearbyResponse = await getZillApi(`/v1/properties/${encodeURIComponent(property.zpid)}/nearby`);
    const result = calculateValuation(property, Array.isArray(nearbyResponse.data) ? nearbyResponse.data : []);
    return response.json(result);
  } catch (error) {
    const status = Number(error.status);
    const safeStatus = status >= 400 && status < 500 ? status : 502;
    const message = error instanceof Error ? error.message : "Unable to calculate a fair value.";
    console.error("Valuation request failed", {
      status: safeStatus,
      code: error?.code,
      message,
    });
    return response.status(safeStatus).json({ error: message });
  }
});

app.use(express.static(distPath));
app.get("/{*splat}", (_request, response, next) => {
  if (process.env.NODE_ENV !== "production") return next();
  return response.sendFile(path.join(distPath, "index.html"));
});

app.listen(port, "127.0.0.1", () => {
  console.log(`Home Fair Value API ready on http://127.0.0.1:${port}`);
});
