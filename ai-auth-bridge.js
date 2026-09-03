import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app-check.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-ai.js';

const firebaseConfig={
  apiKey:'AIzaSyBCol6rLWUGIVvjBoaub9lv6eazYqnmOK0',
  authDomain:'abridor-de-processos.firebaseapp.com',
  projectId:'abridor-de-processos',
  storageBucket:'abridor-de-processos.firebasestorage.app',
  messagingSenderId:'955966759369',
  appId:'1:955966759369:web:781d4413800b7229820818',
  measurementId:'G-L3RX6R9KST'
};
const RECAPTCHA_SITE_KEY='6LciI6ctAAAAACfSDExWGOw43rVUFPv4I8EiVeln';
const app=getApps().length?getApp():initializeApp(firebaseConfig);

let appCheck;
try{
  appCheck=window.__costalogAppCheck;
  if(!appCheck){
    appCheck=initializeAppCheck(app,{
      provider:new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled:true
    });
    window.__costalogAppCheck=appCheck;
  }
}catch(error){
  console.error('[Costalog] Falha ao inicializar Firebase App Check:',error);
  appCheck=window.__costalogAppCheck||null;
}

const auth=getAuth(app);
const ai=getAI(app,{
  backend:new GoogleAIBackend(),
  useLimitedUseAppCheckTokens:false
});

const model=getGenerativeModel(ai,{model:'gemini-3.7-flash'});

async function ensureFreshAppCheckToken(){
  if(!appCheck){
    throw new Error('Firebase App Check não foi inicializado.');
  }
  try{
    // Força um token novo antes da chamada à IA para evitar reutilização
    // de um token antigo/inválido armazenado no navegador.
    const result=await getToken(appCheck,true);
    if(!result?.token){
      throw new Error('Firebase App Check não retornou um token válido.');
    }
    console.log('[Costalog] App Check validado e token renovado.');
    return result.token;
  }catch(error){
    console.error('[Costalog] Falha ao renovar token do App Check:',error);
    throw new Error('Não foi possível validar o App Check. Verifique se a chave reCAPTCHA Enterprise está registrada neste app Web e se o domínio permitido é souzarlk.github.io.');
  }
}

function parseJson(text){
  const cleaned=String(text||'').replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
  return JSON.parse(cleaned);
}

async function analyzeWithGemini(formData){
  const files=[...formData.getAll('files')].filter(file=>file instanceof File);
  if(!files.length)throw new Error('Nenhum PDF foi enviado para análise.');

  // Garante uma nova atestação imediatamente antes da chamada protegida.
  await ensureFreshAppCheckToken();

  const parts=[];
  for(const file of files){
    const bytes=new Uint8Array(await file.arrayBuffer());
    let binary='';
    const chunkSize=0x8000;
    for(let i=0;i<bytes.length;i+=chunkSize){
      binary+=String.fromCharCode(...bytes.subarray(i,i+chunkSize));
    }
    const base64=btoa(binary);
    parts.push({inlineData:{mimeType:file.type||'application/pdf',data:base64}});
  }

  parts.push({text:`Analise os documentos PDF enviados e extraia os dados necessários para abrir o processo no sistema COSTALOG. Responda SOMENTE em JSON válido, sem markdown, usando exatamente este formato:
{
  "processo": "",
  "cliente": "",
  "cnpj": "",
  "terminal": "",
  "transportadora": "",
  "motorista": "",
  "placa": "",
  "container": "",
  "data": "",
  "hora": "",
  "observacoes": ""
}
Se algum dado não estiver presente, deixe o campo vazio. Não invente informações.`});

  const response=await model.generateContent(parts);
  const text=response?.response?.text?.()||'';
  return parseJson(text);
}

const originalFetch=window.fetch.bind(window);
window.fetch=async(input,init={})=>{
  const url=typeof input==='string'?input:(input?.url||'');
  const isAiRequest=url.includes('/api/extract-process')||url.includes('cloudfunctions.net/extractProcess');
  if(!isAiRequest)return originalFetch(input,init);
  try{
    return await analyzeWithGemini(init.body instanceof FormData?init.body:new FormData());
  }catch(error){
    console.error('Falha na análise com Firebase AI Logic:',error);
    return new Response(JSON.stringify({
      error:error?.message||'Não foi possível concluir a análise com a IA.'
    }),{status:500,headers:{'Content-Type':'application/json'}});
  }
};
window.costalogAIEndpoint='/api/extract-process';

onAuthStateChanged(auth,user=>{
  if(user)console.log('[Costalog] Usuário autenticado:',user.uid);
});
