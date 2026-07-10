# 3C Plus -> Pipefy Agendamento

Sistema simples para transformar o clique em **Agendamento** da 3C Plus em um card criado automaticamente no Pipefy.

## Como configurar

1. Instale as dependencias:

```bash
npm install
```

2. Crie o arquivo `.env` a partir do exemplo:

```bash
copy .env.example .env
```

3. Preencha no `.env`:

- `PIPEFY_TOKEN`: token da API do Pipefy.
- `PIPEFY_PIPE_ID`: ID do pipe onde o card sera criado.
- `PIPEFY_FIELD_MAP`: mapa entre parametros da 3C e IDs dos campos do Pipefy.
- `BASE_URL`: URL publica onde esse sistema vai rodar.
- `INTEGRATION_SECRET`: opcional, para exigir uma chave na URL.

4. Rode o sistema:

```bash
npm start
```

5. Abra `http://localhost:3000` e copie a URL gerada para o campo **URL de integracao** na campanha da 3C.

## Preparar URL real

Quando tiver a URL publica, coloque ela em `BASE_URL`.

Exemplo:

```env
BASE_URL=https://agendamento.suaempresa.com.br
INTEGRATION_SECRET=uma-chave-grande-e-dificil
```

Depois reinicie o sistema e abra a tela inicial. A URL para colar na 3C sera gerada com o dominio real.

Checklist antes de colar na 3C:

- `https://sua-url/health` deve responder `{"ok":true}`.
- `https://sua-url` deve abrir a tela do sistema.
- `https://sua-url/api/config` deve mostrar `"configured": true`.
- O `.env` deve ter `PIPEFY_TOKEN`, `PIPEFY_PIPE_ID` e `PIPEFY_FIELD_MAP`.

## URL da 3C

Modelo:

```text
https://seudominio.com/3c/agendamento?nome=[nome]&telefone=[telefone]&ramal=[ramal]&protocolo=[protocolo]&identificador=[identificador]&campanha=[id_campanha]
```

Se `INTEGRATION_SECRET` estiver preenchido, a tela inicial ja inclui `chave=...` na URL gerada.

Para receber JSON em vez de HTML, adicione:

```text
&formato=json
```

Isso ajuda em testes tecnicos e automacoes.

## Deploy

O projeto esta pronto para deploy em servidores Node comuns e inclui:

- `Dockerfile` para VPS, EasyPanel, Coolify, Dokploy ou Portainer.
- `render.yaml` para Render.
- `railway.json` para Railway.

Em qualquer hospedagem, configure as variaveis de ambiente do `.env.example` no painel da plataforma.

## Deploy no Railway

1. Crie um novo projeto no Railway a partir deste repositorio.
2. Em **Variables**, cadastre as variaveis do arquivo `railway.env.example`.
3. Depois do primeiro deploy, copie o dominio gerado pelo Railway, algo como:

```text
https://seu-projeto.up.railway.app
```

4. Atualize `BASE_URL` no Railway com esse dominio.
5. Abra `https://seu-projeto.up.railway.app/health` e confira se responde:

```json
{"ok":true}
```

6. Abra a raiz do site, copie a URL gerada e cole no campo **URL de integracao** da campanha da 3C.

O Railway injeta a porta automaticamente pela variavel `PORT`; o sistema ja usa essa porta em producao.

## Campos aceitos

- `nome`
- `telefone`
- `contato_2` ou `numero_de_contato_2`
- `tem_email`
- `plataforma`
- `ramal`
- `protocolo`
- `identificador`
- `campanha` ou `id_campanha`
- `data_agendamento` ou `data_do_agendamento`
- `agv`
- `loja`
- `observacao`

## Campos da tela do Pipefy

Pela tela enviada, o mapa deve seguir estes titulos:

| Tela do Pipefy | Parametro no sistema | Field ID provavel |
| --- | --- | --- |
| Nome | `nome` | `nome` |
| Numero de telefone | `telefone` | `numero_de_telefone` |
| Numero de contato 2 | `contato_2` | `numero_de_contato_2` |
| TEM E-MAIL? | `tem_email` | `tem_e_mail` |
| PLATAFORMA | `plataforma` | `plataforma` |
| DATA DO AGENDAMENTO | `data_agendamento` | `data_do_agendamento` |
| AGV | `agv` | `agv` |
| Loja | `loja` | `loja` |
| Observacao | `observacao` | `observacao` |

No Railway, comece com:

```env
PIPEFY_DEFAULT_VALUES={"tem_email":"Nao","plataforma":"Feito por IA","agv":"Alessandro Mendes","loja":""}
PIPEFY_FIELD_MAP={"nome":"nome","telefone":"numero_de_telefone","contato_2":"numero_de_contato_2","tem_email":"tem_e_mail","plataforma":"plataforma","data_agendamento":"data_do_agendamento","agv":"agv","loja":"loja","observacao":"observacao"}
```

Se o Pipefy retornar erro dizendo que algum campo nao existe, copie o `field_id` real desse campo no Pipefy e troque o valor da direita.

Para campos predefinidos, configure `PIPEFY_DEFAULT_VALUES`. Pela tela enviada:

```env
PIPEFY_DEFAULT_VALUES={"tem_email":"Nao","plataforma":"Feito por IA","agv":"Alessandro Mendes","loja":""}
```

Use `Sim` ou `Nao` em `tem_email`. Para `plataforma`, use uma das etiquetas exatamente como aparece no Pipefy, por exemplo `Feito por IA`, `Google ADS`, `iCarros`, `Campanha Facebook`. Para `agv`, use o nome do responsavel exatamente como aparece, por exemplo `Alessandro Mendes`.

Se a 3C enviar algum desses parametros na URL, o valor da 3C substitui o valor padrao.

## Observacao de seguranca

O token do Pipefy fica no servidor, dentro do `.env`. Ele nao deve ser colocado na URL da 3C.
