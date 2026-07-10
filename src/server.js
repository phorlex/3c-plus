import "dotenv/config";
import express from "express";
import helmet from "helmet";
import {
  buildPipefyFields,
  buildTitle,
  createPipefyCard,
  normalizeInput,
  parseFieldMap
} from "./pipefy.js";

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/favicon.ico", (req, res) => {
  res.status(204).end();
});

function getConfig() {
  return {
    baseUrl: process.env.BASE_URL || `http://localhost:${port}`,
    pipefyToken: process.env.PIPEFY_TOKEN || "",
    pipefyPipeId: process.env.PIPEFY_PIPE_ID || "",
    integrationSecret: process.env.INTEGRATION_SECRET || "",
    cardTitleTemplate: process.env.PIPEFY_CARD_TITLE || "Agendamento 3C - {nome}",
    fieldMap: parseFieldMap(process.env.PIPEFY_FIELD_MAP || "{}")
  };
}

function validateSecret(req, config) {
  if (!config.integrationSecret) {
    return true;
  }
  return req.query.chave === config.integrationSecret || req.body.chave === config.integrationSecret;
}

app.get("/api/config", (req, res) => {
  const config = getConfig();
  const params = [
    "nome=[nome]",
    "telefone=[telefone]",
    "ramal=[ramal]",
    "protocolo=[protocolo]",
    "identificador=[identificador]",
    "campanha=[id_campanha]"
  ];

  if (config.integrationSecret) {
    params.push(`chave=${encodeURIComponent(config.integrationSecret)}`);
  }

  res.json({
    configured: Boolean(config.pipefyToken && config.pipefyPipeId),
    baseUrl: config.baseUrl,
    integrationUrl: `${config.baseUrl.replace(/\/$/, "")}/3c/agendamento?${params.join("&")}`,
    mappedFields: Object.keys(config.fieldMap)
  });
});

app.all("/3c/agendamento", async (req, res) => {
  const config = getConfig();
  const wantsJson = req.query.formato === "json" || req.body.formato === "json" || req.accepts(["html", "json"]) === "json";

  if (!validateSecret(req, config)) {
    const result = {
      status: "erro",
      title: "Chave invalida",
      message: "A chave de integracao enviada pela 3C nao confere."
    };
    return sendResult(req, res, 401, result, wantsJson);
  }

  const input = normalizeInput({ ...req.query, ...req.body });
  const title = buildTitle(config.cardTitleTemplate, input);
  const fields = buildPipefyFields(input, config.fieldMap);

  try {
    const card = await createPipefyCard({
      token: config.pipefyToken,
      pipeId: config.pipefyPipeId,
      title,
      fields
    });

    return sendResult(req, res, 201, {
      status: "sucesso",
      title: "Agendamento enviado",
      message: "O card foi criado no Pipefy com sucesso.",
      card
    }, wantsJson);
  } catch (error) {
    console.error(error);
    return sendResult(req, res, 500, {
      status: "erro",
      title: "Nao foi possivel criar o card",
      message: error.message
    }, wantsJson);
  }
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

function renderResult({ status, title, message, card }) {
  const isSuccess = status === "sucesso";
  const cardLink = card?.url
    ? `<a class="button" href="${escapeHtml(card.url)}" target="_blank" rel="noreferrer">Abrir card no Pipefy</a>`
    : "";

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="/styles.css">
  </head>
  <body class="result-page">
    <main class="result ${isSuccess ? "success" : "error"}">
      <div class="status-dot"></div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      ${card?.id ? `<p class="muted">Card: ${escapeHtml(card.id)} - ${escapeHtml(card.title || "")}</p>` : ""}
      ${cardLink}
    </main>
  </body>
</html>`;
}

function sendResult(req, res, httpStatus, result, wantsJson) {
  if (wantsJson) {
    return res.status(httpStatus).json(result);
  }

  return res.status(httpStatus).send(renderResult(result));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

app.listen(port, () => {
  console.log(`Sistema 3C + Pipefy rodando em http://localhost:${port}`);
});
