# hearingcheck
HearingCheck

Sistema de pré-triagem auditiva online para conscientização sobre saúde auditiva e geração de oportunidades de atendimento.

Status
Em desenvolvimento

## Executar

O questionário público fica em `/`. A fila da equipe fica em `/painel`.

```bash
npm install
npm test
npm run build
npm start
```

Abra `http://127.0.0.1:8787`. Para simular um anúncio, use `/?utm_source=google&utm_medium=cpc&utm_campaign=percepcao-outubro`. O totem usa `/?origem=totem`.

Demonstração do painel: `recepcao@ouvix.local` e `avaliacao@ouvix.local`, senha `ouvix-demo`. A recepção vê a fila sem a pontuação. A avaliação vê a pontuação e as respostas.

O servidor MCP lê a mesma base: `npm run mcp`. No Cursor ele está em `.cursor/mcp.json`, com as ferramentas `resumo_leads`, `listar_leads`, `atualizar_status` e `abrir_contato`.

Objetivo

O HearingCheck é um projeto pessoal criado para estudar Engenharia de Software, desenvolvimento web e design de produtos digitais.

A ideia surgiu da observação de uma necessidade real durante minha experiência profissional no mercado de aparelhos auditivos: facilitar o primeiro contato entre pessoas com possíveis dificuldades auditivas e clínicas especializadas.

Importante

Este projeto não realiza diagnóstico médico.

O objetivo é apenas orientar o usuário sobre a possibilidade de procurar um especialista, utilizando um questionário baseado em critérios reconhecidos na literatura científica.

Funcionalidades previstas

✔ Questionário de autoavaliação

✔ Cálculo automático da pontuação

✔ Classificação de risco

✔ Recomendações personalizadas

✔ Captura de lead

✔ Integração futura com CRM

✔ Dashboard para clínicas

✔ Teste auditivo com sons (versão futura)

Tecnologias previstas

HTML

CSS

JavaScript

Git

GitHub

React (futuro)

Banco de dados (futuro)

API (futuro)

Autor

Tabata Longo Freire
