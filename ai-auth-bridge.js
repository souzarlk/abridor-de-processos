import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';

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
const AI_ENDPOINT='https://southamerica-east1-abridor-de-processos.cloudfunctions.net/extractProcess';

let resolveAuthReady;
const authReady=new Promise(resolve=>{resolveAuthReady=resolve;});
onAuthStateChanged(auth,user=>resolveAuthReady(user));

window.costalogAIRequest=async(formData)=>{
  const user=await authReady;
  if(!user)throw new Error('Sua sessão expirou. Faça login novamente.');

  const token=await user.getIdToken();
  const headers=new Headers();
  headers.set('Authorization',`Bearer ${token}`);

  return fetch(AI_ENDPOINT,{method:'POST',body:formData,headers});
};

window.costalogAIEndpoint=AI_ENDPOINT;
