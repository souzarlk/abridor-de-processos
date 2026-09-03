import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';

const firebaseConfig={
  apiKey:'AIzaSyBCol6rLWUGIVvjBoaub9lv6eazYqnmOK0',
  authDomain:'abridor-de-processos.firebaseapp.com',
  projectId:'abridor-de-processos',
  storageBucket:'abridor-de-processos.firebasestorage.app',
  messagingSenderId:'955966759369',
  appId:'1:955966759369:web:781d4413800b7229820818',
  measurementId:'G-L3RX6R9KST'
};

if(window.__costalogAIBridgeInstalled){
  console.log('[Costalog] Bridge de IA já estava ativo.');
}else{
  window.__costalogAIBridgeInstalled=true;

  const FUNCTION_URLS=[
    'https://abridor-de-processos.web.app/api/extract-process',
    'https://southamerica-east1-abridor-de-processos.cloudfunctions.net/extractProcess'
  ];

  const app=getApps().length?getApp():initializeApp(firebaseConfig);
  const auth=getAuth(app);

  const authReady=new Promise(resolve=>{
    let finished=false;
    const unsubscribe=onAuthStateChanged(auth,user=>{
      if(finished)return;
      finished=true;
      unsubscribe();
      resolve(user||null);
    });
  });

  async function callExtractProcess(formData){
    const user=await authReady;
    if(!user){
      return new Response(JSON.stringify({error:'Sua sessão não está ativa. Volte para o início, faça login novamente e tente analisar o PDF.'}),{status:401,headers:{'Content-Type':'application/json'}});
    }

    let lastError=null;
    for(const url of FUNCTION_URLS){
      try{
        const idToken=await user.getIdToken();
        const response=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${idToken}`},body:formData});
        const text=await response.text();

        // 404/405/5xx no primeiro endereço: tenta o endereço direto da função.
        // 200/400/401/403/429 são respostas reais da API e devem voltar para a página.
        if(response.status!==404 && response.status!==405 && response.status<500){
          return new Response(text,{status:response.status,headers:{'Content-Type':response.headers.get('content-type')||'application/json'}});
        }
        lastError=new Error(`Endpoint ${url} respondeu HTTP ${response.status}`);
      }catch(error){
        lastError=error;
        console.warn('[Costalog] Falha no endpoint de IA:',url,error);
      }
    }

    console.error('[Costalog] Todos os endpoints de IA falharam:',lastError);
    return new Response(JSON.stringify({error:'Não foi possível conectar ao servidor de análise. A conexão com a IA está indisponível no momento. Tente novamente em alguns segundos.'}),{status:502,headers:{'Content-Type':'application/json'}});
  }

  const originalFetch=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{
    const url=typeof input==='string'?input:(input?.url||'');
    if(!url.includes('/api/extract-process'))return originalFetch(input,init);
    const body=init?.body instanceof FormData?init.body:new FormData();
    return callExtractProcess(body);
  };

  window.costalogAIEndpoint='/api/extract-process';
  console.log('[Costalog] Análise de PDFs configurada via Firebase + Cloud Function.');
}
