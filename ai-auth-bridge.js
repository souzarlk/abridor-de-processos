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

  const originalFetch=window.fetch.bind(window);
  const app=getApps().length?getApp():initializeApp(firebaseConfig);
  const auth=getAuth(app);

  const HOSTING_ENDPOINT='https://abridor-de-processos.web.app/api/extract-process';
  const FUNCTION_ENDPOINT='https://southamerica-east1-abridor-de-processos.cloudfunctions.net/extractProcess';

  const authReady=new Promise(resolve=>{
    let finished=false;
    const unsubscribe=onAuthStateChanged(auth,user=>{
      if(finished)return;
      finished=true;
      unsubscribe();
      resolve(user||null);
    });
  });

  function makeFormData(source){
    const fd=new FormData();
    if(source instanceof FormData){
      for(const [key,value] of source.entries()){
        if(value instanceof File) fd.append(key,value,value.name);
        else fd.append(key,value);
      }
    }
    return fd;
  }

  async function request(url,formData,idToken){
    // Sempre usa o fetch original. Isso evita que a própria ponte intercepte
    // novamente a URL do Firebase e entre em recursão.
    return originalFetch(url,{
      method:'POST',
      headers:{Authorization:`Bearer ${idToken}`},
      body:makeFormData(formData)
    });
  }

  async function callExtractProcess(formData){
    const user=await authReady;
    if(!user){
      return new Response(JSON.stringify({error:'Sua sessão não está ativa. Volte para o início, faça login novamente e tente analisar o PDF.'}),{status:401,headers:{'Content-Type':'application/json'}});
    }

    let idToken;
    try{
      idToken=await user.getIdToken();
    }catch(error){
      console.error('[Costalog] Não foi possível obter o token do Firebase:',error);
      return new Response(JSON.stringify({error:'Sua sessão expirou. Volte para o início, faça login novamente e tente analisar o PDF.'}),{status:401,headers:{'Content-Type':'application/json'}});
    }

    const endpoints=[HOSTING_ENDPOINT,FUNCTION_ENDPOINT];
    let lastResponse=null;
    let lastError=null;

    for(const url of endpoints){
      try{
        const response=await request(url,formData,idToken);
        const text=await response.text();
        lastResponse={response,text,url};

        // Qualquer resposta HTTP significa que conseguimos chegar ao servidor.
        // Retornamos o erro real em vez de mascará-lo como 502.
        if(response.status!==404 && response.status!==405 && response.status!==502 && response.status!==503){
          return new Response(text,{status:response.status,headers:{'Content-Type':response.headers.get('content-type')||'application/json'}});
        }

        console.warn('[Costalog] Endpoint não utilizável:',url,'HTTP',response.status);
      }catch(error){
        lastError=error;
        console.warn('[Costalog] Falha de conexão com endpoint:',url,error);
      }
    }

    // Se o Hosting estiver sem rewrite, o segundo endpoint ainda pode funcionar.
    // Se ambos falharem, informe exatamente o último status recebido.
    if(lastResponse){
      const {response,text}=lastResponse;
      return new Response(text||JSON.stringify({error:`Servidor de IA respondeu HTTP ${response.status}.`}),{
        status:response.status,
        headers:{'Content-Type':response.headers.get('content-type')||'application/json'}
      });
    }

    console.error('[Costalog] Nenhum endpoint de IA pôde ser acessado:',lastError);
    return new Response(JSON.stringify({error:'Não foi possível conectar ao servidor de análise. Verifique a publicação da Cloud Function extractProcess.'}),{status:502,headers:{'Content-Type':'application/json'}});
  }

  window.fetch=async(input,init={})=>{
    const url=typeof input==='string'?input:(input?.url||'');
    if(!url.includes('/api/extract-process'))return originalFetch(input,init);
    const body=init?.body instanceof FormData?init.body:new FormData();
    return callExtractProcess(body);
  };

  window.costalogAIEndpoint='/api/extract-process';
  console.log('[Costalog] Análise de PDFs configurada via Firebase Hosting + Cloud Function.');
}
