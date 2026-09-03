/* Costalog — Leitura local de processos
   Não usa OpenAI, Firebase AI Logic, App Check ou servidor de IA.
   Extrai texto diretamente do PDF no navegador e aplica regras determinísticas.
*/
(async()=>{
  'use strict';
  const PDFJS='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';
  const WORKER='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
  const FIELDS=[
    ['process_number','Nº Processo'],['client','Cliente'],['document_type','Tipo Documento'],['transport_operation','Operação de Transporte'],['terminal_service','Serviço de Terminal?'],['release_billing_date','Data de Liberação para Faturamento Processo'],['closing_date','Data de Encerramento'],['client_reference','Ref. do cliente'],['document_number','Nº Documento'],['reservation_number','Nº Reserva'],['product','Produto'],['chemical_product','Produto químico?'],['shipper','Remetente'],['pickup_location','Local de Coleta'],['shipping_agency','Agência Marítima'],['customs_broker','Despachante'],['broker_reference','Ref. Despachante'],['bl_awb','Nº BL / AWB'],['consignee','Destinatário'],['delivery_location','Local de Entrega'],['ship','Navio'],['voyage_number','Nº Viagem Navio'],['origin_port','Porto Origem'],['maritime_operation','Operação Marítima'],['pickup_deadline','Prazo Coleta'],['delivery_deadline','Prazo Entrega'],['storage_deadline','Prazo vencimento armazenagem'],['demurrage_date','Data Demurrage'],['containerized_cargo','Carga com Container?'],['container_model','Modelo Container'],['empty_return_deadline','Prev. Ret/Dev Vazio'],['empty_container_terminal','Terminal do Container Vazio'],['loading_quantity','Qtd. Carregamento'],['process_billed','Processo Faturado'],['billing_started','Faturamento Iniciado'],['estimated_billing_value','Valor Previsto a Faturar'],['estimated_payment_value','Valor Previsto a Pagar'],['checklist','Checklist'],['observation','Observação'],['show_turns','Mostrar Viras?'],['route','Rota'],['storage_location','Local de Armazenagem'],['generate_empty_turn','Gerar Vira Vazio'],['generate_full_turn','Gerar Vira Cheio']
  ];
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const clean=s=>String(s||'').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
  const date=/\b(?:0?[1-9]|[12]\d|3[01])[\/-](?:0?[1-9]|1[0-2])[\/-](?:20\d{2}|\d{2})\b/;
  function empty(){return {value:'',confidence:0,source:null,warning:''};}
  function val(value,confidence,source,warning=''){return {value:clean(value),confidence,source,warning};}
  function lines(text){return text.split(/\n+/).map(x=>x.trim()).filter(Boolean);}
  function findLabeled(text,labels,opts={}){
    const ls=lines(text); const wanted=labels.map(norm);
    for(let i=0;i<ls.length;i++){
      const n=norm(ls[i]);
      for(const label of wanted){
        const pos=n.indexOf(label);
        if(pos>=0){
          let rest=ls[i].slice(Math.max(0,pos+label.length)).replace(/^\s*[:\-–—]?\s*/,'').trim();
          if(rest && norm(rest)!==label) return {value:rest,line:i};
          if(ls[i+1]) return {value:ls[i+1],line:i+1};
        }
      }
    }
    return null;
  }
  function findPattern(text,re){const m=text.match(re);return m?m[1]||m[0]:'';}
  function firstMeaningful(s){return lines(s).find(x=>x.length>2&&!/^(página|page)\s+\d+/i.test(x))||'';}
  function boolFrom(text,yes,no=''){
    const n=norm(text); if(n.includes(norm(yes)))return 'Sim'; if(no&&n.includes(norm(no)))return 'Não'; return '';
  }
  function infer(text,filename){
    const out={}; FIELDS.forEach(([k])=>out[k]=empty());
    const set=(k,v,c=0.86,source=null,w='')=>{if(v)out[k]=val(v,c,source,w)};
    const s=clean(text); const n=norm(s);
    const src={file:filename,page:null,snippet:''};
    let x;
    x=findLabeled(s,['Nº Processo','Número do Processo','Processo','Process No','Process Number']); if(x)set('process_number',x.value,.95,{...src,snippet:x.value});
    x=findLabeled(s,['Cliente','Client','Tomador']); if(x)set('client',x.value,.92,{...src,snippet:x.value});
    x=findLabeled(s,['Tipo Documento','Documento','Document Type']); if(x)set('document_type',x.value,.88,{...src,snippet:x.value});
    x=findLabeled(s,['Operação de Transporte','Operação Transporte','Transport Operation']); if(x)set('transport_operation',x.value,.88,{...src,snippet:x.value});
    x=findLabeled(s,['Serviço de Terminal','Terminal Service']); if(x)set('terminal_service',x.value,.88,{...src,snippet:x.value});
    x=findLabeled(s,['Data de Liberação para Faturamento Processo','Liberação para Faturamento','Data Liberação Faturamento']); if(x)set('release_billing_date',x.value,.9,{...src,snippet:x.value});
    x=findLabeled(s,['Data de Encerramento','Encerramento','Closing Date']); if(x)set('closing_date',x.value,.9,{...src,snippet:x.value});
    x=findLabeled(s,['Ref. do cliente','Referência do cliente','Ref cliente','Client Reference']); if(x)set('client_reference',x.value,.9,{...src,snippet:x.value});
    x=findLabeled(s,['Nº Documento','Número Documento','Document Number']); if(x)set('document_number',x.value,.9,{...src,snippet:x.value});
    x=findLabeled(s,['Nº Reserva','Reserva','Booking','Reservation']); if(x)set('reservation_number',x.value,.9,{...src,snippet:x.value});
    x=findLabeled(s,['Produto','Product','Mercadoria','Cargo']); if(x)set('product',x.value,.86,{...src,snippet:x.value});
    x=findLabeled(s,['Produto químico','Produto quimico','Chemical Product']); if(x)set('chemical_product',x.value,.88,{...src,snippet:x.value});
    x=findLabeled(s,['Remetente','Shipper','Embarcador']); if(x)set('shipper',x.value,.91,{...src,snippet:x.value});
    x=findLabeled(s,['Local de Coleta','Coleta','Pickup Location','Pickup']); if(x)set('pickup_location',x.value,.88,{...src,snippet:x.value});
    x=findLabeled(s,['Agência Marítima','Agencia Maritima','Shipping Agency']); if(x)set('shipping_agency',x.value,.9,{...src,snippet:x.value});
    x=findLabeled(s,['Despachante','Customs Broker']); if(x)set('customs_broker',x.value,.9,{...src,snippet:x.value});
    x=findLabeled(s,['Ref. Despachante','Referência Despachante','Broker Reference']); if(x)set('broker_reference',x.value,.9,{...src,snippet:x.value});
    x=findLabeled(s,['Nº BL / AWB','BL / AWB','BL','AWB']); if(x)set('bl_awb',x.value,.9,{...src,snippet:x.value});
    x=findLabeled(s,['Destinatário','Consignee']); if(x)set('consignee',x.value,.91,{...src,snippet:x.value});
    x=findLabeled(s,['Local de Entrega','Entrega','Delivery Location','Delivery']); if(x)set('delivery_location',x.value,.88,{...src,snippet:x.value});
    x=findLabeled(s,['Navio','Ship','Vessel']); if(x)set('ship',x.value,.88,{...src,snippet:x.value});
    x=findLabeled(s,['Nº Viagem Navio','Número Viagem','Voyage Number','Voyage']); if(x)set('voyage_number',x.value,.9,{...src,snippet:x.value});
    x=findLabeled(s,['Porto Origem','Origem','Origin Port']); if(x)set('origin_port',x.value,.88,{...src,snippet:x.value});
    x=findLabeled(s,['Operação Marítima','Maritime Operation']); if(x)set('maritime_operation',x.value,.88,{...src,snippet:x.value});
    x=findLabeled(s,['Prazo Coleta','Deadline Coleta','Pickup Deadline']); if(x)set('pickup_deadline',x.value,.9,{...src,snippet:x.value});
    x=findLabeled(s,['Prazo Entrega','Deadline Entrega','Delivery Deadline']); if(x)set('delivery_deadline',x.value,.9,{...src,snippet:x.value});
    x=findLabeled(s,['Prazo vencimento armazenagem','Vencimento armazenagem','Storage Deadline']); if(x)set('storage_deadline',x.value,.9,{...src,snippet:x.value});
    x=findLabeled(s,['Data Demurrage','Demurrage']); if(x)set('demurrage_date',x.value,.9,{...src,snippet:x.value});
    x=findLabeled(s,['Carga com Container','Containerizada','Containerized Cargo']); if(x)set('containerized_cargo',x.value,.9,{...src,snippet:x.value});
    x=findLabeled(s,['Modelo Container','Container Model','Tipo Container']); if(x)set('container_model',x.value,.9,{...src,snippet:x.value});
    x=findLabeled(s,['Prev. Ret/Dev Vazio','Retorno Vazio','Devolução Vazio','Empty Return']); if(x)set('empty_return_deadline',x.value,.9,{...src,snippet:x.value});
    x=findLabeled(s,['Terminal do Container Vazio','Terminal Vazio','Empty Container Terminal']); if(x)set('empty_container_terminal',x.value,.88,{...src,snippet:x.value});
    x=findLabeled(s,['Qtd. Carregamento','Quantidade Carregamento','Loading Quantity']); if(x)set('loading_quantity',x.value,.9,{...src,snippet:x.value});
    x=findLabeled(s,['Processo Faturado','Faturado','Process Billed']); if(x)set('process_billed',x.value,.88,{...src,snippet:x.value});
    x=findLabeled(s,['Faturamento Iniciado','Billing Started']); if(x)set('billing_started',x.value,.88,{...src,snippet:x.value});
    x=findLabeled(s,['Valor Previsto a Faturar','Previsto a Faturar','Estimated Billing Value']); if(x)set('estimated_billing_value',x.value,.88,{...src,snippet:x.value});
    x=findLabeled(s,['Valor Previsto a Pagar','Previsto a Pagar','Estimated Payment Value']); if(x)set('estimated_payment_value',x.value,.88,{...src,snippet:x.value});
    x=findLabeled(s,['Checklist']); if(x)set('checklist',x.value,.8,{...src,snippet:x.value});
    x=findLabeled(s,['Observação','Observacao','Observation','Obs.']); if(x)set('observation',x.value,.82,{...src,snippet:x.value});
    x=findLabeled(s,['Mostrar Viras','Mostrar Vira','Show Turns']); if(x)set('show_turns',x.value,.86,{...src,snippet:x.value});
    x=findLabeled(s,['Rota','Route']); if(x)set('route',x.value,.86,{...src,snippet:x.value});
    x=findLabeled(s,['Local de Armazenagem','Armazenagem','Storage Location']); if(x)set('storage_location',x.value,.88,{...src,snippet:x.value});
    x=findLabeled(s,['Gerar Vira Vazio','Vira Vazio','Generate Empty Turn']); if(x)set('generate_empty_turn',x.value,.86,{...src,snippet:x.value});
    x=findLabeled(s,['Gerar Vira Cheio','Vira Cheio','Generate Full Turn']); if(x)set('generate_full_turn',x.value,.86,{...src,snippet:x.value});
    if(!out.process_number.value){const m=s.match(/\b(?:PROC(?:ESSO)?)[\s:#-]*([A-Z0-9][A-Z0-9./_-]{3,})\b/i);if(m)set('process_number',m[1],.72,{...src,snippet:m[0]})}
    if(!out.reservation_number.value){const m=s.match(/\b(?:BOOKING|RESERVA)[\s:#-]*([A-Z0-9-]{4,})\b/i);if(m)set('reservation_number',m[1],.7,{...src,snippet:m[0]})}
    if(!out.bl_awb.value){const m=s.match(/\b(?:BL|AWB)[\s:#/-]*([A-Z0-9-]{5,})\b/i);if(m)set('bl_awb',m[1],.7,{...src,snippet:m[0]})}
    if(!out.voyage_number.value){const m=s.match(/\b(?:VIAGEM|VOYAGE)[\s:#-]*([A-Z0-9/-]{2,})\b/i);if(m)set('voyage_number',m[1],.7,{...src,snippet:m[0]})}
    if(!out.container_model.value){const m=s.match(/\b(20|40|45)(?:'|\s*)?(?:DC|HC|HQ|GP|RF|REEFER|OT|HC)\b/i);if(m)set('container_model',m[0],.72,{...src,snippet:m[0]})}
    if(!out.containerized_cargo.value && /\b(container|contêiner|conteiner)\b/i.test(s))set('containerized_cargo','Sim',.68,{...src,snippet:'Container encontrado no documento'});
    if(!out.chemical_product.value && /\b(químico|quimico|chemical|imo|dangerous goods|carga perigosa)\b/i.test(s))set('chemical_product','Sim',.68,{...src,snippet:'Termo relacionado a produto químico encontrado'});
    return out;
  }
  async function extract(){
    const {default:pdfjs}=await import(PDFJS); pdfjs.GlobalWorkerOptions.workerSrc=WORKER;
    let all=''; const pages=[];
    for(const file of window.__costalogLocalFiles){
      const data=await file.arrayBuffer(); const pdf=await pdfjs.getDocument({data}).promise;
      for(let p=1;p<=pdf.numPages;p++){
        const page=await pdf.getPage(p); const content=await page.getTextContent();
        const text=content.items.map(i=>i.str).join(' ');
        pages.push({file:file.name,page:p,text}); all+=`\n${text}`;
      }
    }
    const merged=infer(all,window.__costalogLocalFiles.map(f=>f.name).join(', '));
    Object.keys(merged).forEach(k=>{const src=merged[k].source;if(src){const hit=pages.find(p=>norm(p.text).includes(norm(src.snippet).slice(0,60)));if(hit)merged[k].source={...src,page:hit.page}}});
    return merged;
  }
  function render(data){
    const result=$('result'), fields=$('fields'); if(!result||!fields)return;
    fields.innerHTML=FIELDS.map(([key,label],i)=>{const x=data[key]||empty();const has=!!x.value;return `<article class="field"><div class="field-top"><span class="field-name">${i+1}. ${esc(label)}</span><div class="field-actions"><button class="icon-btn" ${has?'':'disabled'} data-local-copy="${esc(key)}">⧉</button><button class="icon-btn" ${has?'':'disabled'} data-local-source="${esc(key)}">▣</button></div></div><div class="value ${has?'':'empty'}">${has?esc(x.value):'Não localizado com segurança'}</div><div class="confidence">Extração local: ${Math.round((x.confidence||0)*100)}%</div>${x.warning?`<div class="warning">⚠ ${esc(x.warning)}</div>`:''}</article>`}).join('');
    result.classList.add('show');
    fields.querySelectorAll('[data-local-copy]').forEach(b=>b.onclick=async()=>{const v=data[b.dataset.localCopy]?.value||'';if(v){await navigator.clipboard.writeText(v);b.textContent='✓';setTimeout(()=>b.textContent='⧉',800)}});
    fields.querySelectorAll('[data-local-source]').forEach(b=>b.onclick=()=>{const x=data[b.dataset.localSource];const modal=$('modal'),viewer=$('viewer'),title=$('modalTitle');if(!modal||!viewer)return;title.textContent='Origem da informação';viewer.innerHTML=`<div style="max-width:900px;width:100%;background:#fff;padding:24px;border-radius:12px;line-height:1.7;font-size:13px"><strong>Arquivo:</strong> ${esc(x.source?.file||'Documento')}<br><strong>Página:</strong> ${esc(x.source?.page||'não identificada')}<br><br><strong>Trecho localizado:</strong><br>${esc(x.source?.snippet||x.value||'Não foi possível determinar o trecho exato.')}</div>`;modal.classList.add('show')});
    const copyAll=$('copyAll'); if(copyAll){copyAll.onclick=async()=>{const txt=FIELDS.map(([k,l])=>`${l}: ${data[k]?.value||''}`).join('\n');await navigator.clipboard.writeText(txt);copyAll.textContent='Copiado ✓';setTimeout(()=>copyAll.textContent='Copiar tudo',1000)}}
  }
  function setBusy(on,text){const loading=$('loading');if(loading)loading.classList.toggle('show',on);const lt=$('loadingText');if(lt)lt.textContent=text}
  document.addEventListener('click',async e=>{
    const btn=e.target.closest('#analyzeBtn'); if(!btn)return;
    e.preventDefault(); e.stopImmediatePropagation();
    const input=$('pdfInput'); const selected=Array.from(input?.files||[]); if(!selected.length)return;
    window.__costalogLocalFiles=selected;
    btn.disabled=true; setBusy(true,'Lendo PDF(s) diretamente no navegador...');
    const status=$('status'); if(status){status.textContent='Processando os documentos localmente. Nenhum PDF será enviado para uma IA ou servidor.';status.className='status show info'}
    try{const data=await extract();render(data);if(status){status.textContent='Leitura concluída. Os campos foram identificados automaticamente por regras locais. Revise os itens antes de usar.';status.className='status show ok'}}catch(err){console.error(err);if(status){status.textContent='Não foi possível ler este PDF. Se ele for digitalizado como imagem, a leitura automática local pode não conseguir reconhecer o texto.';status.className='status show error'}}finally{setBusy(false);btn.disabled=!selected.length}
  },true);
  const close=$('closeModal'); if(close)close.onclick=()=>{$('modal')?.classList.remove('show')};
  const hero=document.querySelector('.hero p'); if(hero)hero.textContent='Envie os PDFs. O navegador fará a leitura e organizará os dados automaticamente, sem usar IA externa.';
  const secure=document.querySelector('.secure'); if(secure)secure.textContent='🔒 Processamento local';
  const analyze=$('analyzeBtn'); if(analyze)analyze.textContent='✦ Analisar processo';
})();
