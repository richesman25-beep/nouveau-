/* Interface sans dépendance réseau externe ; calculs effectués par l'API Flask. */
'use strict';
const $ = id => document.getElementById(id);
const form = $('analysis-form');
const nf = new Intl.NumberFormat('fr-FR', {maximumFractionDigits:4});
const number = value => Number.isFinite(value) ? nf.format(value) : '—';
let last = null;
let activePanel = 'market';
const settingsNames = ['account_balance','max_risk_pct','atr_multiple','reward_ratio','pullback_pct','fee_pct','slippage_pct'];
const plotConfig = {responsive:true, displaylogo:false};
const layout = {paper_bgcolor:'transparent',plot_bgcolor:'#fff',font:{family:'system-ui',size:11,color:'#8290a8'},margin:{l:52,r:18,t:20,b:35},showlegend:true,legend:{orientation:'h',y:1.15},xaxis:{gridcolor:'#f0f3f8',rangeslider:{visible:false}},yaxis:{gridcolor:'#edf1f7',fixedrange:false},hovermode:'x unified'};

function sourceFields(){
  const csv = $('source').value === 'csv';
  $('demo-fields').hidden = csv; $('csv-fields').hidden = !csv;
  $('csv-file').required = csv;
  for(const name of ['bars','seed']) form.elements[name].disabled = csv;
}
$('source').addEventListener('change',sourceFields);

async function draw(){
  if(!last) return;
  if(typeof Plotly === 'undefined') throw new Error('La bibliothèque graphique ne s’est pas chargée. Rechargez la page.');
  const c = last.chart;
  const colors = ['#14b8a6','#f2b94b','#8b7cf8'];
  const lines = [20,50,200].map((p,i)=>({x:c.dates,y:c['ema_'+p],type:'scatter',mode:'lines',name:'EMA '+p,line:{color:colors[i],width:1.5}}));
  await Plotly.react('market-chart', [{x:c.dates,open:c.open,high:c.high,low:c.low,close:c.close,type:'candlestick',name:'Prix',increasing:{line:{color:'#14b8a6'}},decreasing:{line:{color:'#eb7180'}}},...lines,
    ...['support','resistance'].map(name=>({x:c.dates,y:c[name],name,mode:'lines',line:{width:1,dash:'dot',color:'#b9c4da'}}))],layout,plotConfig);
  await Plotly.react('rsi-chart',[{x:c.dates,y:c.rsi,name:'RSI',line:{color:'#6366f1',width:1.5}}],{...layout,showlegend:false,yaxis:{...layout.yaxis,range:[0,100]},shapes:[40,60].map(y=>({type:'line',xref:'paper',x0:0,x1:1,y0:y,y1:y,line:{color:'#cbd5e1',dash:'dot',width:1}}))},plotConfig);
  if(last.history) await Plotly.react('equity-chart',[{x:last.history.equity.dates,y:last.history.equity.values,name:'Capital',fill:'tozeroy',fillcolor:'rgba(99,102,241,.06)',line:{color:'#6366f1',width:2}}],{...layout,showlegend:false},plotConfig);
}

function text(id,value){$(id).textContent=value;}
function render(){
  const r=last.report;
  text('price',number(r.last_price));text('trend',r.trend_regime);text('rsi',number(r.indicators.rsi));text('atr',number(r.indicators.atr));
  text('source-label',r.data_source==='demo'?'DÉMO · PRIX FICTIFS':'CSV IMPORTÉ · '+r.symbol);
  $('source-label').classList.toggle('real',r.data_source==='csv');
  text('period',last.count.toLocaleString('fr-FR')+' bougies · '+last.start+' → '+last.end+' · UTC');
  $('checklist').replaceChildren();
  for(const [label,passed] of Object.entries(r.checklist)){
    const li=document.createElement('li');li.textContent=(passed?'✓  ':'○  ')+label;li.className=passed?'positive':'';$('checklist').append(li);
  }
  const detail=$('signal-details');detail.replaceChildren();
  function paragraph(value,heading=false){const p=document.createElement(heading?'h3':'p');p.textContent=value;detail.append(p);}
  if(r.signal){const s=r.signal,p=s.position_sizing;
    paragraph('Scénario détecté : '+s.direction,true);
    paragraph('Entrée indicative : '+number(s.entry_price)+' · Stop : '+number(s.stop_loss)+' · Objectif : '+number(s.take_profit));
    paragraph('Taille théorique : '+number(p.units)+' unités · Exposition : '+number(p.notional_value));
    paragraph('Perte estimée au stop avec coûts : '+number(p.risk_amount_usd)+' / budget : '+number(p.risk_budget));
    paragraph('Ratio gain/risque brut : '+number(s.risk_reward_ratio)+'. Recalculez la taille si le prix d’exécution change.');
  }else paragraph('Aucun scénario conforme : les conditions ne sont pas toutes réunies, ou les niveaux calculés sont invalides.');
  const h=last.history;$('history-results').hidden=!h;
  text('history-status',h?'Signal clôturé puis entrée à la bougie suivante. Résultats après frais et glissement.':'Simulation désactivée ou historique inférieur à 202 bougies.');
  if(h){const m=h.metrics;
    text('final-balance',number(m.final_balance));text('return',number(m.return_pct)+' %');text('drawdown',number(m.max_drawdown_pct)+' %');text('trade-count',m.trades);
    text('trade-summary',m.trades?'Positions gagnantes : '+number(m.win_rate_pct)+' % · Frais cumulés : '+number(m.fees):'Aucune position simulée : aucune performance ne peut être déduite.');
    $('trades').replaceChildren();
    for(const t of h.trades){const row=document.createElement('tr');for(const v of [t.entry_time,t.direction,number(t.entry),number(t.exit),number(t.pnl),t.reason]){const cell=document.createElement('td');cell.textContent=v;row.append(cell);}row.children[4].className=t.pnl>=0?'positive':'negative';$('trades').append(row);}
    $('download-journal').disabled=!m.trades;
  }
}

for(const button of document.querySelectorAll('[role=tab]')) button.addEventListener('click',()=>{
  activePanel=button.dataset.panel;
  for(const b of document.querySelectorAll('[role=tab]'))b.setAttribute('aria-selected',String(b===button));
  for(const panel of document.querySelectorAll('[role=tabpanel]'))panel.hidden=panel.id!==activePanel;
  requestAnimationFrame(()=>{if(typeof Plotly!=='undefined')for(const id of ['market-chart','rsi-chart','equity-chart'])if($(id).data)Plotly.Plots.resize($(id)).catch(()=>{});});
});

function download(content,name,type){if(!last)return;const url=URL.createObjectURL(new Blob([content],{type}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('download-data').onclick=()=>last&&download(last.csv,'donnees_ohlcv.csv','text/csv;charset=utf-8');
$('download-report').onclick=()=>last&&download(JSON.stringify(last.report,null,2),'rapport_analyse.json','application/json');
$('download-journal').onclick=()=>last?.history&&download(last.history.csv,'journal_simulation.csv','text/csv;charset=utf-8');

async function analyze(event){
  if(event)event.preventDefault();
  $('submit').disabled=true;$('error').hidden=true;$('loading').hidden=false;$('results').hidden=true;text('loading','Analyse en cours…');last=null;
  try{
    const body={source:$('source').value,symbol:form.elements.symbol.value,settings:Object.fromEntries(settingsNames.map(k=>[k,Number(form.elements[k].value)])),allow_short:form.elements.allow_short.checked,run_backtest:form.elements.run_backtest.checked};
    if(body.source==='csv'){
      const file=$('csv-file').files[0];if(!file)throw new Error('Sélectionnez un fichier CSV.');
      if(file.size>3*1024*1024)throw new Error('Maximum 3 Mo par fichier CSV.');body.csv=await file.text();
    }else{body.bars=Number(form.elements.bars.value);body.seed=Number(form.elements.seed.value);}
    const response=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    let result;try{result=await response.json();}catch{throw new Error('Le serveur n’a pas pu terminer le calcul. Réduisez la période puis réessayez.');}
    if(!response.ok)throw new Error(result.error||'Échec de l’analyse.');
    last=result;render();$('results').hidden=false;await draw();
  }catch(error){text('error',error.message||'Une erreur est survenue.');$('error').hidden=false;}
  finally{$('loading').hidden=true;$('submit').disabled=false;}
}
form.addEventListener('submit',analyze);
sourceFields();analyze();
