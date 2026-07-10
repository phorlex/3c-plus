const PIPEFY_API_URL = "https://api.pipefy.com/graphql";
const OPTIONS_CACHE_MS = 5 * 60 * 1000;

let optionsCache = {
  key: "",
  expiresAt: 0,
  data: null
};

export function parseFieldMap(rawValue) {
  return parseJsonObject(rawValue, "PIPEFY_FIELD_MAP");
}

export function parseDefaultValues(rawValue) {
  return parseJsonObject(rawValue, "PIPEFY_DEFAULT_VALUES");
}

function parseJsonObject(rawValue, envName) {
  if (!rawValue || !rawValue.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${envName} precisa ser um objeto JSON.`);
    }
    return parsed;
  } catch (error) {
    throw new Error(`${envName} invalido: ${error.message}`);
  }
}

export function normalizeInput(query, defaultValues = {}) {
  const input = {
    nome: query.nome || query.name || "",
    telefone: query.telefone || query.numero_de_telefone || query.phone || "",
    contato_2: query.contato_2 || query.numero_de_contato_2 || query.telefone_2 || "",
    tem_email: query.tem_email || query.email_opcao || "",
    email: query.email || "",
    plataforma: query.plataforma || "",
    ramal: query.ramal || "",
    protocolo: query.protocolo || "",
    identificador: query.identificador || query.identifier || "",
    campanha: query.campanha || query.id_campanha || query.campaign || "",
    data_agendamento: query.data_agendamento || query.data_do_agendamento || query.data || "",
    agv: query.agv || "",
    loja: query.loja || "",
    observacao: query.observacao || query.obs || ""
  };

  return applyDefaultValues(input, defaultValues);
}

export function parseSubmittedValues(input) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, parseSubmittedValue(value)])
  );
}

function parseSubmittedValue(value) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

export function applyDefaultValues(input, defaultValues) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      value === "" || value === undefined || value === null
        ? resolveDefaultValue(defaultValues[key])
        : value
    ])
  );
}

function resolveDefaultValue(value) {
  if (value === "__today") {
    return new Date().toISOString().slice(0, 10);
  }

  return value ?? "";
}

export function buildTitle(template, input) {
  const fallback = "Agendamento 3C - {nome}";
  return (template || fallback).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
    return input[key] || "";
  }).trim() || "Agendamento 3C";
}

export function buildPipefyFields(input, fieldMap) {
  return Object.entries(fieldMap)
    .filter(([sourceKey, fieldId]) => fieldId && input[sourceKey] !== undefined && input[sourceKey] !== "")
    .map(([sourceKey, fieldId]) => ({
      field_id: String(fieldId),
      field_value: input[sourceKey]
    }));
}

export async function createPipefyCard({ token, pipeId, title, fields }) {
  if (!token) {
    throw new Error("PIPEFY_TOKEN nao configurado.");
  }
  if (!pipeId) {
    throw new Error("PIPEFY_PIPE_ID nao configurado.");
  }

  const mutation = `
    mutation Create3CAgendamento($input: CreateCardInput!) {
      createCard(input: $input) {
        card {
          id
          title
          url
        }
      }
    }
  `;

  const response = await fetch(PIPEFY_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        input: {
          pipe_id: pipeId,
          title,
          fields_attributes: fields
        }
      }
    })
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.errors?.length) {
    const detail = payload?.errors?.map((error) => error.message).join("; ") || response.statusText;
    throw new Error(`Pipefy recusou a criacao do card: ${detail}`);
  }

  return payload.data.createCard.card;
}

export async function getPipefyFormOptions({ token, pipeId }) {
  if (!token || !pipeId) {
    return { platforms: [], agvs: [] };
  }

  const cacheKey = `${pipeId}:${token.slice(-8)}`;
  if (optionsCache.key === cacheKey && optionsCache.expiresAt > Date.now()) {
    return optionsCache.data;
  }

  const query = `
    query PipeFormOptions($id: ID!) {
      pipe(id: $id) {
        labels {
          id
          name
        }
        members {
          user {
            id
            name
            email
          }
        }
      }
    }
  `;

  const response = await fetch(PIPEFY_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query,
      variables: { id: pipeId }
    })
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.errors?.length) {
    const detail = payload?.errors?.map((error) => error.message).join("; ") || response.statusText;
    throw new Error(`Nao foi possivel carregar opcoes do Pipefy: ${detail}`);
  }

  const data = {
    platforms: (payload.data.pipe.labels || [])
      .map((label) => ({ id: String(label.id), name: label.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    agvs: (payload.data.pipe.members || [])
      .map((member) => member.user)
      .filter(Boolean)
      .map((user) => ({ id: String(user.id), name: user.name?.trim() || user.email || String(user.id) }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  };

  optionsCache = {
    key: cacheKey,
    expiresAt: Date.now() + OPTIONS_CACHE_MS,
    data
  };

  return data;
}
