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
    const options={method:'POST',headers:{Authorization:`Bearer ${idToken}`},body:makeFormData(formData)};
    return url==='/api/extract-process'?originalFetch(url,options):fetch(url,options);
  }

  async function callExtractProcess(formData){
    const user=await authReady;
    if(!user){
      return new Response(JSON.stringify({error:'Sua sessão não está ativa. Volte para o início, faça login novamente e tente analisar o PDF.'}),{status:401,headers:{'Content-Type':'application/json'}});
    }

    const idToken=await user.getIdToken();
    const endpoints=[
      '/api/extract-process',
      'https://southamerica-east1-abridor-de-processos.cloudfunctions.net/extractProcess'
    ];
    let lastError=null;

    for(const url of endpoints){
      try{
        const response=await request(url,formData,idToken);
        const text=await response.text();

        if(response.ok || (response.status>=400 && response.status<500)){
          return new Response(text,{status:response.status,headers:{'Content-Type':response.headers.get('content-type')||'application/json'}});
        }
        lastError=new Error(`Endpoint ${url} respondeu HTTP ${response.status}`);
      }catch(error){
        lastError=error;
        console.warn('[Costalog] Falha no endpoint de IA:',url,error);
      }
    }

    console.error('[Costalog] Todos os endpoints de IA falharam:',lastError);
    return new Response(JSON.stringify({error:'Não foi possível conectar ao servidor de análise. O servidor da IA não respondeu. Tente novamente em alguns segundos.'}),{status:502,headers:{'Content-Type':'application/json'}});
  }

  window.fetch=async(input,init={})=>{
    const url=typeof input==='string'?input:(input?.url||'');
    if(!url.includes('/api/extract-process'))return originalFetch(input,init);
    const body=init?.body instanceof FormData?init.body:new FormData();
    return callExtractProcess(body);
  };

  window.costalogAIEndpoint='/api/extract-process';
  console.log('[Costalog] Análise de PDFs configurada via Firebase + Cloud Function.');
}
