import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';

// A análise é feita no backend. O GitHub Pages não executa /api/*, então
// encaminhamos a requisição diretamente para a Cloud Function já implantada.
const firebaseConfig={
  apiKey:'AIzaSyBCol6rLWUGIVvjBoaub9lv6eazYqnmOK0',
  authDomain:'abridor-de-processos.firebaseapp.com',
  projectId:'abridor-de-processos',
  storageBucket:'abridor-de-processos.firebasestorage.app',
  messagingSenderId:'955966759369',
  appId:'1:955966759369:web:781d4413800b7229820818',
  measurementId:'G-L3RX6R9KST'
};

const FUNCTION_URL='https://southamerica-east1-abridor-de-processos.cloudfunctions.net/extractProcess';
const app=getApps().length?getApp():initializeApp(firebaseConfig);
const auth=getAuth(app);

async function callExtractProcess(formData){
  const user=auth.currentUser;
  if(!user){
    return new Response(JSON.stringify({error:'Sessão não autenticada. Faça login novamente.'}),{status:401,headers:{'Content-Type':'application/json'}});
  }

  try{
    // Não forçamos refresh do token: getIdToken(true) estava causando
    // auth/quota-exceeded. O Firebase reutiliza o token válido em cache e só
    // renova quando necessário.
    const idToken=await user.getIdToken();
    const response=await fetch(FUNCTION_URL,{
      method:'POST',
      headers:{Authorization:`Bearer ${idToken}`},
      body:formData
    });
    const text=await response.text();
    return new Response(text,{status:response.status,headers:{'Content-Type':response.headers.get('content-type')||'application/json'}});
  }catch(error){
    console.error('[Costalog] Erro ao chamar Cloud Function:',error);
    return new Response(JSON.stringify({error:error?.message==='auth/quota-exceeded'?'A autenticação do Firebase atingiu temporariamente o limite de solicitações. Aguarde alguns minutos e tente novamente.':'Não foi possível conectar ao servidor de análise. Tente novamente.'}),{status:502,headers:{'Content-Type':'application/json'}});
  }
}

// Mantém compatibilidade com a página atual, que chama /api/extract-process.
// IMPORTANTE: não interceptar a própria URL da Cloud Function, pois isso
// causaria recursão infinita (fetch -> bridge -> fetch -> bridge...) e travaria
// a página ao clicar em Analisar.
const originalFetch=window.fetch.bind(window);
window.fetch=async(input,init={})=>{
  const url=typeof input==='string'?input:(input?.url||'');
  const isAiRequest=url.includes('/api/extract-process');
  if(!isAiRequest)return originalFetch(input,init);
  const body=init?.body instanceof FormData?init.body:new FormData();
  return callExtractProcess(body);
};

window.costalogAIEndpoint='/api/extract-process';
console.log('[Costalog] Análise configurada via Cloud Function, sem Firebase AI Logic/App Check no navegador.');
