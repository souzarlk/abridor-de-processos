import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';

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

// O Firebase pode ainda estar restaurando a sessão quando o usuário clica em
// analisar. Esperamos a primeira resposta do Auth em vez de consultar
// auth.currentUser imediatamente.
const authReady=new Promise(resolve=>{
  let done=false;
  const unsubscribe=onAuthStateChanged(auth,user=>{
    if(done)return;
    done=true;
    unsubscribe();
    resolve(user);
  });
});

async function callExtractProcess(formData){
  const user=await authReady;
  if(!user){
    return new Response(JSON.stringify({error:'Sessão não autenticada. Faça login novamente.'}),{status:401,headers:{'Content-Type':'application/json'}});
  }

  try{
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

// A página chama /api/extract-process. Interceptamos somente essa rota.
// A URL real da Cloud Function NUNCA é interceptada, evitando recursão infinita.
const originalFetch=window.fetch.bind(window);
window.fetch=async(input,init={})=>{
  const url=typeof input==='string'?input:(input?.url||'');
  if(!url.includes('/api/extract-process'))return originalFetch(input,init);
  const body=init?.body instanceof FormData?init.body:new FormData();
  return callExtractProcess(body);
};

window.costalogAIEndpoint='/api/extract-process';
console.log('[Costalog] Análise configurada via Cloud Function; sessão Firebase aguardará restauração antes da análise.');
