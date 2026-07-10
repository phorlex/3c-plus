const PIPEFY_API_URL = "https://api.pipefy.com/graphql";

export function parseFieldMap(rawValue) {
  return parseJsonObject(rawValue, "PIPEFY_FIELD_MAP");
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

export function normalizeInput(query) {
  const input = {
    nome: cleanPlaceholder(query.nome || query.name || ""),
    telefone: formatBrazilianPhone(query.telefone || query.numero_de_telefone || query.phone || ""),
    contato_2: formatBrazilianPhone(query.contato_2 || query.numero_de_contato_2 || query.telefone_2 || ""),
    tem_email: cleanPlaceholder(query.tem_email || query.email_opcao || ""),
    email: cleanPlaceholder(query.email || ""),
    plataforma: cleanPlaceholder(query.plataforma || ""),
    ramal: cleanPlaceholder(query.ramal || ""),
    protocolo: cleanPlaceholder(query.protocolo || ""),
    identificador: cleanPlaceholder(query.identificador || query.identifier || ""),
    campanha: cleanPlaceholder(query.campanha || query.id_campanha || query.campaign || ""),
    data_agendamento: cleanPlaceholder(query.data_agendamento || query.data_do_agendamento || query.data || ""),
    agv: cleanPlaceholder(query.agv || ""),
    loja: cleanPlaceholder(query.loja || ""),
    observacao: cleanPlaceholder(query.observacao || query.obs || "")
  };

  return input;
}

export function cleanPlaceholder(value) {
  const text = String(value || "").trim();
  return /^\[[a-zA-Z0-9_]+\]$/.test(text) ? "" : text;
}

export function formatBrazilianPhone(value) {
  const cleaned = cleanPlaceholder(value);
  const digitsOnly = String(cleaned || "").replace(/\D/g, "");
  const digits = digitsOnly.length > 11 && digitsOnly.startsWith("55")
    ? digitsOnly.slice(2)
    : digitsOnly;

  if (digits.length === 11) {
    return `+55 ${digits.slice(0, 2)} ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `+55 ${digits.slice(0, 2)} ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return cleaned || "";
}

export function parseSubmittedValues(input) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, parseSubmittedValue(key, value)])
  );
}

function parseSubmittedValue(key, value) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) {
    if ((key === "plataforma" || key === "agv") && trimmed) {
      return [trimmed];
    }
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    if ((key === "plataforma" || key === "agv") && trimmed) {
      return [trimmed];
    }
    return value;
  }
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
