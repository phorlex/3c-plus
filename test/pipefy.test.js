import test from "node:test";
import assert from "node:assert/strict";
import { buildPipefyFields, buildTitle, cleanPlaceholder, formatBrazilianPhone, normalizeInput, parseFieldMap, parseSubmittedValues } from "../src/pipefy.js";

test("normaliza parametros vindos da 3C", () => {
  const input = normalizeInput({
    nome: "Ana",
    numero_de_telefone: "11999999999",
    numero_de_contato_2: "11888888888",
    data_do_agendamento: "2026-07-10",
    id_campanha: "44"
  });

  assert.equal(input.nome, "Ana");
  assert.equal(input.telefone, "11 99999-9999");
  assert.equal(input.contato_2, "11 88888-8888");
  assert.equal(input.data_agendamento, "2026-07-10");
  assert.equal(input.campanha, "44");
});

test("monta titulo com variaveis", () => {
  const title = buildTitle("Agendamento - {nome} - {telefone}", {
    nome: "Ana",
    telefone: "11999999999"
  });

  assert.equal(title, "Agendamento - Ana - 11999999999");
});

test("gera fields_attributes com o mapa configurado", () => {
  const fields = buildPipefyFields(
    { nome: "Ana", telefone: "11999999999", vazio: "" },
    { nome: "nome_cliente", telefone: "telefone", vazio: "campo_vazio" }
  );

  assert.deepEqual(fields, [
    { field_id: "nome_cliente", field_value: "Ana" },
    { field_id: "telefone", field_value: "11999999999" }
  ]);
});

test("valida JSON do mapa de campos", () => {
  assert.deepEqual(parseFieldMap('{"nome":"nome_cliente"}'), { nome: "nome_cliente" });
  assert.throws(() => parseFieldMap("nao-json"), /PIPEFY_FIELD_MAP invalido/);
});

test("converte valores enviados por selects com listas JSON", () => {
  const input = parseSubmittedValues({
    plataforma: '["317663860"]',
    agv: '["307251915"]',
    nome: "Ana"
  });

  assert.deepEqual(input.plataforma, ["317663860"]);
  assert.deepEqual(input.agv, ["307251915"]);
  assert.equal(input.nome, "Ana");
});

test("converte plataforma e agv simples para listas de IDs", () => {
  const input = parseSubmittedValues({
    plataforma: "317663860",
    agv: "307655006"
  });

  assert.deepEqual(input.plataforma, ["317663860"]);
  assert.deepEqual(input.agv, ["307655006"]);
});

test("formata telefones brasileiros para o Pipefy", () => {
  assert.equal(formatBrazilianPhone("5521965043422"), "21 96504-3422");
  assert.equal(formatBrazilianPhone("(21) 96504-3422"), "21 96504-3422");
  assert.equal(formatBrazilianPhone("2133334444"), "21 3333-4444");
  assert.equal(formatBrazilianPhone("123"), "123");
});

test("remove placeholders nao substituidos pela 3C", () => {
  assert.equal(cleanPlaceholder("[nome]"), "");
  assert.equal(cleanPlaceholder("Lucas Souza"), "Lucas Souza");
  assert.equal(formatBrazilianPhone("[telefone]"), "");

  const input = normalizeInput({
    nome: "[nome]",
    telefone: "[telefone]",
    protocolo: "[protocolo]"
  });

  assert.equal(input.nome, "");
  assert.equal(input.telefone, "");
  assert.equal(input.protocolo, "");
});
