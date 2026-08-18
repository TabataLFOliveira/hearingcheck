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
- pontuação
- classificação
