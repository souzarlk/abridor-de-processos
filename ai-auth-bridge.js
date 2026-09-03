import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app-check.js';
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

// App Check precisa ser inicializado antes dos serviços Firebase.
// A renovação automática evita tokens expirados durante o uso da IA.
const appCheck=initializeAppCheck(app,{
  provider:new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
  isTokenAutoRefreshEnabled:true
});

const auth=getAuth(app);
// Tokens de uso limitado ajudam a evitar rejeições por reutilização/replay do token.
const ai=getAI(app,{backend:new GoogleAIBackend(),useLimitedUseAppCheckTokens:true});

const FIELD_KEYS=['process_number','client','document_type','transport_operation','terminal_service','release_billing_date','closing_date','client_reference','document_number','reservation_number','product','chemical_product','shipper','pickup_location','shipping_agency','customs_broker','broker_reference','bl_awb','consignee','delivery_location','ship','voyage_number','origin_port','maritime_operation','pickup_deadline','delivery_deadline','storage_deadline','demurrage_date','containerized_cargo','container_model','empty_return_deadline','empty_container_terminal','loading_quantity','process_billed','billing_started','estimated_billing_value','estimated_payment_value','checklist','observation','show_turns','route','storage_location','generate_empty_turn','generate_full_turn'];

const JSON_TEMPLATE=FIELD_KEYS.reduce((o,k)=>{o[k]={value:null,confidence:0,source:null,warning:null};return o},{});
const JSON_EXAMPLE=JSON.stringify(JSON_TEMPLATE,null,2);

const SYSTEM_INSTRUCTION=`Você é um extrator documental para processos logísticos da COSTALOG. Analise TODOS os PDFs enviados e extraia somente informações que estejam explicitamente presentes nos documentos. NUNCA invente, complete por contexto ou suponha. Se não houver evidência suficiente, use value:null e confidence:0. Transcreva números, datas, códigos, nomes, valores e referências exatamente como aparecem. Em conflito, escolha a evidência mais direta e explique em warning. Para campos de pergunta/booleanos, use somente “Sim” ou “Não” quando houver evidência explícita; caso contrário null. Para cada campo preenchido informe source com file_index, filename, page e quote literal curto. confidence deve ser número de 0 a 1. Retorne SOMENTE JSON válido, sem markdown, sem comentários e sem texto antes ou depois do JSON.`;

const model=getGenerativeModel(ai,{model:'gemini-3.7-flash',systemInstruction:SYSTEM_INSTRUCTION,generationConfig:{responseMimeType:'application/json'}});

let currentUser=auth.currentUser;
let resolveAuthReady;
const authReady=new Promise(resolve=>{resolveAuthReady=resolve;});
onAuthStateChanged(auth,user=>{currentUser=user;resolveAuthReady(user);});

function fileToGenerativePart(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onloadend=()=>{
      try{
        const result=String(reader.result||'');
        const comma=result.indexOf(',');
        if(comma<0)throw new Error(`Não foi possível preparar o PDF ${file.name}.`);
        resolve({inlineData:{data:result.slice(comma+1),mimeType:'application/pdf'}});
      }catch(e){reject(e)}
    };
    reader.onerror=()=>reject(reader.error||new Error('Não foi possível ler o PDF.'));
    reader.readAsDataURL(file);
  });
}

function cleanJsonText(text){
  let value=String(text||'').trim();
  if(value.startsWith('```')){
    value=value.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
  }
  const first=value.indexOf('{');
  const last=value.lastIndexOf('}');
  if(first>=0&&last>first)value=value.slice(first,last+1);
  return value;
}

function normalizeFields(fields){
  const out={};
  for(const key of FIELD_KEYS){
    const x=fields?.[key];
    if(x&&typeof x==='object'){
      out[key]={
        value:x.value===undefined?null:x.value,
        confidence:Number.isFinite(Number(x.confidence))?Math.max(0,Math.min(1,Number(x.confidence))):0,
        source:x.source&&typeof x.source==='object'?x.source:null,
        warning:x.warning??null
      };
    }else{
      out[key]={value:null,confidence:0,source:null,warning:null};
    }
  }
  return out;
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

  const parts=[{
    text:`ARQUIVOS ENVIADOS:\n${files.map((f,i)=>`${i+1}: ${f.name}`).join('\n')}\n\nTAREFA: extraia os campos abaixo usando os PDFs. file_index começa em 1. page é o número da página do PDF. quote deve ser uma pequena transcrição literal da evidência. Se um campo não estiver nos documentos, mantenha value:null, confidence:0, source:null e warning:null.\n\nCAMPOS OBRIGATÓRIOS:\n${FIELD_KEYS.join(', ')}\n\nESTRUTURA EXATA DE CADA CAMPO:\n${JSON.stringify({value:null,confidence:0,source:{file_index:1,filename:'nome.pdf',page:1,quote:'evidência'},warning:null})}\n\nEXEMPLO DE ESTRUTURA COMPLETA:\n${JSON_EXAMPLE}`
  }];

  for(const f of files)parts.push(await fileToGenerativePart(f));

  const result=await model.generateContent(parts);
  const text=result.response.text();
  if(!text)throw new Error('A IA não retornou uma resposta válida.');

  let fields;
  try{fields=JSON.parse(cleanJsonText(text));}
  catch(e){console.error('Resposta bruta da IA:',text);throw new Error('A IA retornou um formato inválido. Tente novamente.');}

  return new Response(JSON.stringify({fields:normalizeFields(fields),meta:{model:'gemini-3.7-flash',files:files.map(f=>f.name)}}),{status:200,headers:{'Content-Type':'application/json'}});
}

const originalFetch=window.fetch.bind(window);
window.fetch=async(input,init={})=>{
  const url=typeof input==='string'?input:(input?.url||'');
  const isAiRequest=url.includes('/api/extract-process')||url.includes('cloudfunctions.net/extractProcess');
  if(!isAiRequest)return originalFetch(input,init);
  try{return await analyzeWithGemini(init.body instanceof FormData?init.body:new FormData());}
  catch(error){
    console.error('Falha na análise com Firebase AI Logic:',error);
    return new Response(JSON.stringify({error:error?.message||'Não foi possível concluir a análise com a IA.'}),{status:500,headers:{'Content-Type':'application/json'}});
  }
};

window.costalogAIEndpoint='/api/extract-process';
