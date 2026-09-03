import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';

const app = initializeApp({
  apiKey:'AIzaSyBCol6rLWUGIVvjBoaub9lv6eazYqnmOK0',
  authDomain:'abridor-de-processos.firebaseapp.com',
  projectId:'abridor-de-processos',
  storageBucket:'abridor-de-processos.firebasestorage.app',
  messagingSenderId:'955966759369',
  appId:'1:955966759369:web:781d4413800b7229820818',
  measurementId:'G-L3RX6R9KST'
});
const auth=getAuth(app);
const originalFetch=window.fetch.bind(window);
const AI_ENDPOINT='https://southamerica-east1-abridor-de-processos.cloudfunctions.net/extractProcess';

window.fetch=async(input,init={})=>{
  const url=typeof input==='string'?input:input?.url||'';
  const isAiRequest=url.includes('/api/extract-process')||url===AI_ENDPOINT;
  if(!isAiRequest)return originalFetch(input,init);
  const user=auth.currentUser;
  if(!user)throw new Error('Sua sessão expirou. Faça login novamente.');
  const token=await user.getIdToken();
  const headers=new Headers(init.headers||{});
  headers.set('Authorization',`Bearer ${token}`);
  return originalFetch(AI_ENDPOINT,{...init,headers});
};
