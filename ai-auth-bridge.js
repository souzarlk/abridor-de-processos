import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getAI, getGenerativeModel, GoogleAIBackend, SchemaType } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-ai.js';

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
const ai=getAI(app,{backend:new GoogleAIBackend()});

const FIELD_KEYS=['process_number','client','document_type','transport_operation','terminal_service','release_billing_date','closing_date','client_reference','document_number','reservation_number','product','chemical_product','shipper','pickup_location','shipping_agency','customs_broker','broker_reference','bl_awb','consignee','delivery_location','ship','voyage_number','origin_port','maritime_operation','pickup_deadline','delivery_deadline','storage_deadline','demurrage_date','containerized_cargo','container_model','empty_return_deadline','empty_container_terminal','loading_quantity','process_billed','billing_started','estimated_billing_value','estimated_payment_value','checklist','observation','show_turns','route','storage_location','generate_empty_turn','generate_full_turn'];

const fieldProperties={};
for(const key of FIELD_KEYS){
  fieldProperties[key]={type:SchemaType.OBJECT,properties:{value:{type:SchemaType.STRING,nullable:true},confidence:{type:SchemaType.NUMBER},source:{type:SchemaType.OBJECT,nullable:true,properties:{file_index:{type:SchemaType.NUMBER},filename:{type:SchemaType.STRING},page:{type:SchemaType.NUMBER},quote:{type:SchemaType.STRING}},required:['file_index','filename','page','quote']},warning:{type:SchemaType.STRING,nullable:true}},required:['value','confidence','source','warning']};
}

const responseSchema={type:SchemaType.OBJECT,properties:fieldProperties,required:FIELD_KEYS};
const SYSTEM_INSTRUCTION=`Você é um extrator documental para processos logísticos da COSTALOG. Preencha EXATAMENTE os campos solicitados usando SOMENTE evidências presentes nos PDFs. NUNCA invente, complete por contexto ou suponha. Se não houver evidência suficiente, value=null e confidence=0. Transcreva números, datas, códigos, nomes, valores e referências exatamente como aparecem. Leia TODOS os PDFs e faça conferência cruzada. Em conflito, escolha apenas a evidência mais direta e explique em warning. Para perguntas booleanas use somente “Sim” ou “Não” quando houver evidência explícita; caso contrário null. Para cada campo preenchido informe arquivo, página e pequeno quote literal. Não invente coordenadas. confidence varia de 0 a 1; >=0.95 somente com evidência muito clara. O resultado será usado em operação logística, portanto priorize precisão sobre completude.`;

const model=getGenerativeModel(ai,{model:'gemini-3.7-flash',systemInstruction:SYSTEM_INSTRUCTION,generationConfig:{responseMimeType:'application/json',responseSchema}});

let currentUser=auth.currentUser;
let resolveAuthReady;
const authReady=new Promise(resolve=>{resolveAuthReady=resolve;});
onAuthStateChanged(auth,user=>{currentUser=user;resolveAuthReady(user);});

function fileToGenerativePart(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onloadend=()=>{try{const comma=reader.result.indexOf(',');resolve({inlineData:{data:reader.result.slice(comma+1),mimeType:file.type||'application/pdf'}})}catch(e){reject(e)}};
    reader.onerror=()=>reject(reader.error||new Error('Não foi possível ler o PDF.'));
    reader.readAsDataURL(file);
  });
}

async function analyzeWithGemini(formData){
  const user=currentUser||await authReady;
  if(!user)throw new Error('Sua sessão expirou. Faça login novamente.');
  const files=formData.getAll('files').filter(x=>x instanceof File);
  if(!files.length)throw new Error('Envie pelo menos um PDF.');
  if(files.length>3)throw new Error('Para a análise direta por IA, envie no máximo 3 PDFs por vez.');
  const total=files.reduce((n,f)=>n+f.size,0);
  if(total>14*1024*1024)throw new Error('Os PDFs selecionados são grandes demais para uma única análise. Reduza o tamanho ou envie menos arquivos.');
  for(const f of files)if(f.type!=='application/pdf')throw new Error(`O arquivo ${f.name} não é PDF.`);
  const parts=[{text:`ARQUIVOS (file_index):\n${files.map((f,i)=>`${i+1}: ${f.name}`).join('\n')}\n\nUsuário autenticado: ${user.uid}.`}];
  for(const f of files)parts.push(await fileToGenerativePart(f));
  const result=await model.generateContent(parts);
  const text=result.response.text();
  if(!text)throw new Error('A IA não retornou uma resposta válida.');
  const fields=JSON.parse(text);
  return new Response(JSON.stringify({fields,meta:{model:'gemini-3.7-flash',files:files.map(f=>f.name)}}),{status:200,headers:{'Content-Type':'application/json'}});
}

const originalFetch=window.fetch.bind(window);
window.fetch=async(input,init={})=>{
  const url=typeof input==='string'?input:(input?.url||'');
  const isAiRequest=url.includes('/api/extract-process')||url.includes('cloudfunctions.net/extractProcess');
  if(!isAiRequest)return originalFetch(input,init);
  try{return await analyzeWithGemini(init.body instanceof FormData?init.body:new FormData());}
  catch(error){console.error('Falha na análise com Firebase AI Logic:',error);return new Response(JSON.stringify({error:error?.message||'Não foi possível concluir a análise com a IA.'}),{status:500,headers:{'Content-Type':'application/json'}});}
};

window.costalogAIEndpoint='/api/extract-process';
