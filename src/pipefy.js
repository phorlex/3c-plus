const PIPEFY_API_URL = "https://api.pipefy.com/graphql";

export function parseFieldMap(rawValue) {
  if (!rawValue || !rawValue.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("PIPEFY_FIELD_MAP precisa ser um objeto JSON.");
    }
    return parsed;
  } catch (error) {
    throw new Error(`PIPEFY_FIELD_MAP invalido: ${error.message}`);
  }
}

export function normalizeInput(query) {
  return {
    nome: query.nome || query.name || "",
    telefone: query.telefone || query.phone || "",
    ramal: query.ramal || "",
    protocolo: query.protocolo || "",
    identificador: query.identificador || query.identifier || "",
    campanha: query.campanha || query.id_campanha || query.campaign || "",
    data_agendamento: query.data_agendamento || query.data || "",
    observacao: query.observacao || query.obs || ""
  };
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
      field_value: String(input[sourceKey])
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
