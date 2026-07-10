import "dotenv/config";
import express from "express";
import helmet from "helmet";
import {
  buildPipefyFields,
  buildTitle,
  createPipefyCard,
  normalizeInput,
  parseDefaultValues,
  parseFieldMap,
  parseSubmittedValues
} from "./pipefy.js";

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  frameguard: false
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
    defaultValues: parseDefaultValues(process.env.PIPEFY_DEFAULT_VALUES || "{}"),
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
    "campanha=[id_campanha]",
    "data_agendamento=[data_agendamento]"
  ];

  if (config.integrationSecret) {
    params.push(`chave=${encodeURIComponent(config.integrationSecret)}`);
  }

  res.json({
    configured: Boolean(config.pipefyToken && config.pipefyPipeId),
    baseUrl: config.baseUrl,
    integrationUrl: `${config.baseUrl.replace(/\/$/, "")}/3c/agendamento?${params.join("&")}`,
    defaultValues: Object.keys(config.defaultValues),
    mappedFields: Object.keys(config.fieldMap)
  });
});

const formOptions = {
  platforms: [
    { id: "317845261", name: "Campanha (Troco na Troca)" },
    { id: "317476820", name: "Campanha Facebook" },
    { id: "317720758", name: "Chat (Plataformas) 💻" },
    { id: "317476818", name: "Chave na Mão" },
    { id: "317663860", name: "Feito por IA" },
    { id: "317681036", name: "Google ADS" },
    { id: "317476796", name: "iCarros" },
    { id: "317476829", name: "Indicação" },
    { id: "317476827", name: "Instagram" },
    { id: "317476821", name: "Marketplace" },
    { id: "317476813", name: "Mercado Livre" },
    { id: "317476822", name: "Messenger" },
    { id: "317476814", name: "Mobiauto" },
    { id: "317476815", name: "NaPista" },
    { id: "317476817", name: "OLX" },
    { id: "317476828", name: "Site" },
    { id: "317672474", name: "Umbler" },
    { id: "317476795", name: "Webmotors" },
    { id: "317476826", name: "WhatsApp" }
  ],
  agvs: [
    { id: "307655006", name: "Samuel Modesto" },
    { id: "307655007", name: "Maria Beatriz Galino" },
    { id: "307655009", name: "Lorrana Oliveira" },
    { id: "307655010", name: "Amanda Correa Chagas" },
    { id: "307655011", name: "Gabrielly da Silva Clementino" },
    { id: "307756026", name: "Marcela Machado Faria" },
    { id: "307756027", name: "Joice Oliveira" },
    { id: "307798778", name: "Lucas Palermo Ferreira" },
    { id: "307800051", name: "Kaíque Bertolini" },
    { id: "307807456", name: "Ana Shirley" },
    { id: "307864387", name: "KAYLANE BERTOLINI" }
  ]
};

app.get("/3c/agendamento", async (req, res) => {
  const config = getConfig();

  if (!validateSecret(req, config)) {
    return res.status(401).send(renderResult({
      status: "erro",
      title: "Chave invalida",
      message: "A chave de integracao enviada pela 3C nao confere."
    }));
  }

  const input = normalizeInput(req.query, config.defaultValues);
  return res.send(renderSchedulingForm(input, config, formOptions));
});

app.post("/3c/agendamento", async (req, res) => {
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

  const input = parseSubmittedValues(normalizeInput({ ...req.query, ...req.body }, config.defaultValues));
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

function renderSchedulingForm(input, config, options) {
  const action = `${config.baseUrl.replace(/\/$/, "")}/3c/agendamento`;
  const secretInput = config.integrationSecret
    ? `<input type="hidden" name="chave" value="${escapeHtml(config.integrationSecret)}">`
    : "";

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Agendamento Pipefy</title>
    <link rel="stylesheet" href="/styles.css">
  </head>
  <body class="embedded-page">
    <main class="embedded-shell">
      <header class="embedded-header">
        <p class="eyebrow">3C Plus para Pipefy</p>
        <h1>Novo agendamento</h1>
      </header>
      <form class="manual-form" method="post" action="${escapeHtml(action)}">
        ${secretInput}
        ${hiddenInput("protocolo", input.protocolo)}
        ${hiddenInput("identificador", input.identificador)}
        ${hiddenInput("campanha", input.campanha)}
        ${hiddenInput("ramal", input.ramal)}

        <label>Nome
          <input name="nome" value="${escapeHtml(input.nome)}" required>
        </label>

        <label>Número de telefone
          <input name="telefone" value="${escapeHtml(input.telefone)}" required>
        </label>

        <label>Número de contato 2
          <input name="contato_2" value="${escapeHtml(input.contato_2)}">
        </label>

        <label>TEM E-MAIL?
          <select name="tem_email" required>
            ${option("❌ Não", input.tem_email)}
            ${option("✅ Sim", input.tem_email)}
          </select>
        </label>

        <label>Email
          <input name="email" type="email" value="${escapeHtml(input.email)}">
        </label>

        <label>PLATAFORMA
          <select name="plataforma" required>
            ${renderIdListOptions(options.platforms, input.plataforma)}
          </select>
        </label>

        <label>DATA DO AGENDAMENTO
          <input name="data_agendamento" type="date" value="${escapeHtml(input.data_agendamento)}" required>
        </label>

        <label>AGV
          <select name="agv" required>
            ${renderIdListOptions(options.agvs, input.agv)}
          </select>
        </label>

        <label>Loja
          <select name="loja" required>
            ${option("📍 Nova Iguaçu", input.loja)}
            ${option("📍 Duque de Caxias", input.loja)}
          </select>
        </label>

        <label class="wide">Observação
          <textarea name="observacao" rows="4">${escapeHtml(input.observacao)}</textarea>
        </label>

        <button class="submit" type="submit">Criar card no Pipefy</button>
      </form>
    </main>
  </body>
</html>`;
}

function hiddenInput(name, value) {
  return `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`;
}

function option(value, selectedValue) {
  return optionValue(value, value, selectedValue);
}

function optionValue(value, label, selectedValue) {
  const normalized = Array.isArray(selectedValue) ? JSON.stringify(selectedValue) : String(selectedValue ?? "");
  const selected = normalized === value ? " selected" : "";
  return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`;
}

function renderIdListOptions(items, selectedValue) {
  return items
    .map((item) => optionValue(JSON.stringify([item.id]), item.name, selectedValue))
    .join("");
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
