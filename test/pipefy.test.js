import test from "node:test";
import assert from "node:assert/strict";
import { buildPipefyFields, buildTitle, normalizeInput, parseFieldMap } from "../src/pipefy.js";

test("normaliza parametros vindos da 3C", () => {
  const input = normalizeInput({
    nome: "Ana",
    numero_de_telefone: "11999999999",
    numero_de_contato_2: "11888888888",
    data_do_agendamento: "2026-07-10",
    id_campanha: "44"
  });

  assert.equal(input.nome, "Ana");
  assert.equal(input.telefone, "11999999999");
  assert.equal(input.contato_2, "11888888888");
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
