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

const app=getApps().length?getApp():initializeApp(firebaseConfig);
const auth=getAuth(app);
const AI_ENDPOINT='https://southamerica-east1-abridor-de-processos.cloudfunctions.net/extractProcess';
const originalFetch=window.fetch.bind(window);

let currentUser=auth.currentUser;
let resolveAuthReady;
const authReady=new Promise(resolve=>{resolveAuthReady=resolve;});
onAuthStateChanged(auth,user=>{
  currentUser=user;
  resolveAuthReady(user);
});

// GitHub Pages não possui o rewrite /api/extract-process do Firebase Hosting.
// Interceptamos somente essa rota e enviamos a chamada para a Cloud Function HTTPS.
window.fetch=async(input,init={})=>{
  const url=typeof input==='string'?input:(input?.url||'');
  const isAiRequest=url.includes('/api/extract-process')||url===AI_ENDPOINT;
  if(!isAiRequest)return originalFetch(input,init);

  const user=currentUser||await authReady;
  if(!user)throw new Error('Sua sessão expirou. Faça login novamente.');

  const token=await user.getIdToken();
  const headers=new Headers(init.headers||{});
  headers.set('Authorization',`Bearer ${token}`);

  try{
    return await originalFetch(AI_ENDPOINT,{...init,headers});
  }catch(error){
    console.error('Falha na conexão com a Cloud Function da IA:',error);
    throw new Error('Não foi possível conectar ao servidor seguro da IA. Verifique se a função extractProcess está publicada no Firebase.');
  }
};

window.costalogAIEndpoint=AI_ENDPOINT;
