# Integração de IA — Abridor de Processos

A tela `abrir-processo.html` já está pronta para receber um ou vários PDFs e apresentar os 43 campos na ordem do formulário operacional de referência. Cada campo possui copiar, confiança, origem e visualização do PDF.

## Arquitetura

- Frontend: GitHub Pages / HTML + PDF.js.
- Autenticação: Firebase Authentication.
- Backend: Firebase Cloud Functions 2nd gen em `functions/index.js`.
- IA: OpenAI Responses API, com entrada de PDF e saída estruturada em JSON Schema.
- Chave da OpenAI: somente no servidor, via Firebase Secret Manager. Nunca colocar a chave no HTML/JavaScript do navegador.

## Ativação do servidor

No computador com o Firebase CLI autenticado e o projeto Firebase `abridor-de-processos` selecionado:

```bash
firebase use abridor-de-processos
firebase functions:secrets:set OPENAI_API_KEY
cd functions
npm install
cd ..
firebase deploy --only functions:extractProcess
```

O comando do secret solicitará a chave localmente; ela não deve ser enviada pelo chat ou commitada no Git.

## Hospedagem

Para usar o endpoint como `/api/extract-process`, publique o frontend também no Firebase Hosting com o `firebase.json` deste repositório. O rewrite já está preparado para a função `extractProcess` na região `southamerica-east1`.

```bash
firebase deploy --only hosting
```

Se o site continuar exclusivamente no GitHub Pages, a interface continuará funcionando, mas a chamada `/api/extract-process` não será servida pelo GitHub Pages. Nesse caso, a etapa de IA precisa apontar para a URL HTTPS da Cloud Function ou, preferencialmente, o frontend deve ser hospedado junto ao Firebase Hosting.

## Precisão

O prompt do servidor instrui a IA a não adivinhar dados, retornar `null` quando não houver evidência suficiente, cruzar múltiplos PDFs, informar página/arquivo/trecho de origem e fornecer coordenadas visuais somente quando determinadas com segurança. Ainda assim, dados operacionais críticos devem passar por conferência humana antes de serem efetivamente gravados em um processo.
