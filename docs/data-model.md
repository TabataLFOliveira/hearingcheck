# Modelo de Dados

## Usuário

Representa a pessoa que utiliza o HearingCheck.

- id
- nome
- telefone

## Teste

Representa uma realização específica do HearingCheck.

- id
- usuário_id

## Pergunta

Representa uma pergunta do questionário.

- id
- texto
- ordem

## Resposta

Representa a resposta fornecida pelo usuário em uma pergunta durante uma realização específica do teste.

- id
- teste_id
- pergunta_id
- resposta

## Resultado

Representa o resultado obtido em uma realização específica do teste.

- id
- teste_id

## Termo

Termo 1 — Representa a Ciência e finalidade do HearingCheck
Termo 2 - Representa o Consentimento para tratamento de dados

- id
- texto
- versão

## Aceite

Representa o aceite do usuário nos termos propostos pelo HearingCheck

- id
- usuário_id
- teste_id
- termo_id
- data/hora

## Lead

Representa o usuário que dá entrada com seus dados pessoais no sistema.

- id
- nome
- contato

             
- pontuação
- classificação
