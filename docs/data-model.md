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

Representa os termos apresentados pelo HearingCheck.

**Termo 1 — Ciência e finalidade do HearingCheck**  
Informa que o HearingCheck é uma pré-triagem e não constitui diagnóstico médico.

**Termo 2 — Consentimento para tratamento de dados**  
Informa sobre o tratamento dos dados fornecidos pelo usuário.

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

Lead representa uma oportunidade de contato gerada quando o usuário fornece seus dados e solicita uma avaliação.

- id
- nome
- contato            
- pontuação
- classificação

Decisão em aberto

Definir posteriormente a relação entre os dados do HearingCheck e o Lead, especialmente se a pontuação e a classificação deverão ser disponibilizadas à clínica ou permanecer apenas associadas ao histórico do usuário.
