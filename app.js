/*
 * Polo Finance 1.4 — app principal.
 * HTML = estrutura; CSS = aparência; este arquivo = comportamento.
 * Para preservar os dados da versão 1.3, o diário continua usando
 * a chave localStorage "polo_diary_v1" e os mesmos campos principais.
 */
'use strict';

const KEYS = Object.freeze({
  diary: 'polo_diary_v1',        // COMPATÍVEL com a v1.3
  settings: 'polo_settings_v1',  // COMPATÍVEL com a v1.3
  expenses: 'polo_expenses_v14',
  pots: 'polo_pots_v14'
});
const POT_NAMES = Object.freeze({
  ipva: 'IPVA + Licenciamento',
  maintenance: 'Pneus + Manutenção',
  financing: 'Financiamento'
});
const POT_ICONS = Object.freeze({ipva:'▤',maintenance:'⚙',financing:'▣'});
const CATEGORY_NAMES = Object.freeze({
  combustivel:'Combustível',pedagios:'Pedágio / estacionamento',outros:'Outros',
  financiamento:'Financiamento',manutencao:'Manutenção',pneus:'Pneus',
  seguro:'Seguro',ipva:'IPVA',licenciamento:'Licenciamento'
});
const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL'}).format(Number(n)||0);
const number = n => new Intl.NumberFormat('pt-BR', {maximumFractionDigits:1}).format(Number(n)||0);
const oneDecimal = n => new Intl.NumberFormat('pt-BR', {minimumFractionDigits:1,maximumFractionDigits:1}).format(Number(n)||0);
const isDate = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(new Date(d+'T12:00:00').getTime()) && new Date(d+'T12:00:00').toISOString().slice(0,10) === d;
const dateToday = () => {const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const monthToday = () => dateToday().slice(0,7);
const dateBR = d => isDate(d) ? d.split('-').reverse().join('/') : 'Data não informada';
const monthLabel = m => /^\d{4}-\d{2}$/.test(m||'') ? new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(Number(m.slice(0,4)),Number(m.slice(5,7))-1,1)) : 'Mês atual';
const enc = v => String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const decimal = raw => {
  if(raw===undefined||raw===null) return 0;
  let s=String(raw).trim().replace(/\s/g,'').replace(/R\$/gi,'');
  if(!s)return 0;
  const comma=s.lastIndexOf(','),dot=s.lastIndexOf('.');
  if(comma>=0&&dot>=0){s=comma>dot?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'')}
  else if(comma>=0){s=s.replace(',','.')}
  const n=Number(s);return Number.isFinite(n)?n:NaN;
};
const finite = v => {const n=decimal(v);return Number.isFinite(n)?n:0};
const positive = v => Math.max(0,finite(v));
const sum = (items,fn) => items.reduce((acc,item)=>acc+(fn(item)||0),0);
// ID numérico para manter o botão Excluir compatível com o diário original 1.3.
const idNew = () => Date.now()*1000 + Math.floor(Math.random()*1000);
const legacyCompatibleId = raw => Number.isSafeInteger(Number(raw)) && Number(raw)>0 ? Number(raw) : idNew();
function readStorage(key,fallback){try{const raw=localStorage.getItem(key);return raw===null?fallback:JSON.parse(raw)}catch{return fallback}}
function writeStorage(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{toast('Não foi possível salvar neste navegador. Faça um backup.',true);return false}}
function safeText(x){return String(x??'').slice(0,160)}
function sanitizeDiary(input){
  if(!Array.isArray(input))return [];
  return input.slice(0,30000).filter(x=>x&&typeof x==='object'&&isDate(x.date)).map(x=>{
    const uber=x.uber===null||x.uber===undefined?null:positive(x.uber);
    const ninetyNine=x.ninetyNine===null||x.ninetyNine===undefined?null:positive(x.ninetyNine);
    return {id:legacyCompatibleId(x.id),date:x.date,period:safeText(x.period||'Outro'),
      hours:positive(x.hours),rides:positive(x.rides),gross:positive(x.gross??((uber||0)+(ninetyNine||0))),
      uber,ninetyNine,km:positive(x.km),liters:positive(x.liters),fuelCost:positive(x.fuelCost),
      tolls:positive(x.tolls),otherVariable:positive(x.otherVariable),note:safeText(x.note)};
  });
}
function sanitizeExpenses(input){
  if(!Array.isArray(input))return [];
  return input.slice(0,30000).filter(x=>x&&isDate(x.date)&&Number(x.amount)>0).map(x=>({
    id:String(x.id??idNew()),date:x.date,category:CATEGORY_NAMES[x.category]?x.category:'outros',
    amount:positive(x.amount),note:safeText(x.note)
  }));
}
function sanitizePots(raw){
  const goals={ipva:0,maintenance:0,financing:0};
  if(raw&&typeof raw.goals==='object') for(const k of Object.keys(goals))goals[k]=positive(raw.goals[k]);
  const movements=Array.isArray(raw?.movements)?raw.movements.slice(0,30000).filter(x=>x&&isDate(x.date)&&POT_NAMES[x.pot]&&['deposit','withdraw'].includes(x.type)&&positive(x.amount)>0).map(x=>({
    id:String(x.id??idNew()),date:x.date,pot:x.pot,type:x.type,amount:positive(x.amount),note:safeText(x.note)
  })):[];
  return {goals,movements};
}
const state={
  diary:sanitizeDiary(readStorage(KEYS.diary,[])),
  expenses:sanitizeExpenses(readStorage(KEYS.expenses,[])),
  pots:sanitizePots(readStorage(KEYS.pots,null)),
  month:monthToday(),view:'dashboard',editingDayId:null,editingExpenseId:null
};
let toastHandle;
function toast(message,error=false){
  const box=$('toast');box.textContent=message;box.classList.toggle('error',error);box.classList.add('show');
  clearTimeout(toastHandle);toastHandle=setTimeout(()=>box.classList.remove('show'),3500);
}
function selectView(view){
  if(!['dashboard','registrar','historico','cofrinhos'].includes(view))return;
  state.view=view;
  document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.id==='view-'+view));
  document.querySelectorAll('.nav-item').forEach(el=>{
    const selected=el.dataset.nav===view;
    el.classList.toggle('active',selected);
    if(selected)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');
  });
  $('toolsPanel').hidden=true;$('backupMenuButton').setAttribute('aria-expanded','false');
  renderAll();window.scrollTo({top:0,behavior:'instant'});
}
function monthDiary(){return state.diary.filter(x=>x.date.slice(0,7)===state.month)}
function monthExpenses(){return state.expenses.filter(x=>x.date.slice(0,7)===state.month)}
function monthPotMoves(){return state.pots.movements.filter(x=>x.date.slice(0,7)===state.month)}
function potBalance(key){return sum(state.pots.movements.filter(x=>x.pot===key),x=>x.type==='deposit'?x.amount:-x.amount)}
function allPotBalances(){return Object.keys(POT_NAMES).reduce((acc,key)=>acc+potBalance(key),0)}
function breakdown(diaries,expenses){
  const out={};
  const add=(k,v)=>{if(v>0)out[k]=(out[k]||0)+v};
  for(const d of diaries){add('combustivel',d.fuelCost);add('pedagios',d.tolls);add('outros',d.otherVariable)}
  for(const x of expenses)add(x.category,x.amount);
  return out;
}
function calcMonth(){
  const days=monthDiary(),expenses=monthExpenses(),moves=monthPotMoves();
  const gross=sum(days,x=>x.gross),km=sum(days,x=>x.km),hours=sum(days,x=>x.hours);
  const fuel=sum(days,x=>x.fuelCost)+sum(expenses.filter(x=>x.category==='combustivel'),x=>x.amount);
  const costs=sum(days,x=>x.fuelCost+x.tolls+x.otherVariable)+sum(expenses,x=>x.amount);
  const reserved=sum(moves,x=>x.type==='deposit'?x.amount:-x.amount);
  return {days,expenses,moves,gross,km,hours,fuel,costs,reserved,profit:gross-costs,available:gross-costs-reserved,
    categories:breakdown(days,expenses)};
}
function renderDashboard(){
  const m=calcMonth();
  $('heroMonth').textContent=monthLabel(state.month).toUpperCase();
  $('heroAvailable').textContent=money(m.available);$('heroAvailable').style.color=m.available<0?'var(--red)':'var(--text)';
  $('heroDays').textContent=`${m.days.length} ${m.days.length===1?'registro':'registros'} de jornada`;
  $('heroKm').textContent=`${number(m.km)} km rodados`;
  $('statGross').textContent=money(m.gross);$('statExpenses').textContent=money(m.costs);
  $('statProfit').textContent=money(m.profit);$('statProfit').style.color=m.profit<0?'var(--red)':'var(--text)';
  $('statReserved').textContent=money(m.reserved);
  $('indicatorPerKm').textContent=m.km>0?money(m.gross/m.km)+'/km':'—';
  $('indicatorPerHour').textContent=m.hours>0?money(m.gross/m.hours)+'/h':'—';
  $('indicatorKm').textContent=number(m.km)+' km';$('indicatorFuel').textContent=money(m.fuel);
  const settings=readStorage(KEYS.settings,{});
  const goal=Math.max(0,finite(settings?.profitGoal??1500));
  $('goalAmount').textContent=money(goal);
  $('goalProgress').style.width=(goal>0?Math.min(100,Math.max(0,m.profit/goal*100)):0)+'%';
  $('goalExplanation').textContent=goal>0?m.profit>=goal?'Meta de lucro alcançada!':`Faltam ${money(goal-m.profit)} de lucro para a meta.`:'Configure sua meta no planejamento.';
  renderChart(m);renderBreakdown(m);
}
function renderChart(m){
  const el=$('dailyChart');
  const byDate=new Map();
  const row=d=>{if(!byDate.has(d))byDate.set(d,{income:0,cost:0});return byDate.get(d)};
  m.days.forEach(d=>{const x=row(d.date);x.income+=d.gross;x.cost+=d.fuelCost+d.tolls+d.otherVariable});
  m.expenses.forEach(e=>{row(e.date).cost+=e.amount});
  const dates=[...byDate.keys()].sort().slice(-12);
  if(!dates.length){el.innerHTML='<div class="empty-state">Seu gráfico aparece após o primeiro registro.</div>';return}
  const max=Math.max(1,...dates.flatMap(date=>[byDate.get(date).income,byDate.get(date).cost]));
  el.innerHTML=dates.map(d=>{
    const x=byDate.get(d),hi=x.income>0?Math.max(2,x.income/max*100):0,hc=x.cost>0?Math.max(2,x.cost/max*100):0;
    return `<div class="chart-day" title="${dateBR(d)} • Ganhos ${money(x.income)} • Gastos ${money(x.cost)}"><div class="chart-bars"><div class="chart-bar income" style="height:${hi}%"></div><div class="chart-bar expense" style="height:${hc}%"></div></div><div class="chart-date">${enc(d.slice(8))}</div></div>`;
  }).join('');
}
function renderBreakdown(m){
  const el=$('costBreakdown'),entries=Object.entries(m.categories).sort((a,b)=>b[1]-a[1]);
  if(!entries.length){el.innerHTML='<div class="empty-state">Nenhuma despesa registrada neste mês.</div>';return}
  const high=Math.max(1,entries[0][1]);
  el.innerHTML=entries.map(([k,v])=>`<div class="breakdown-row"><div class="breakdown-label"><span>${enc(CATEGORY_NAMES[k]||'Outros')}</span><b>${money(v)}</b></div><div class="breakdown-track"><div class="breakdown-fill" style="width:${Math.max(2,v/high*100)}%"></div></div></div>`).join('');
}
function formNum(id){return decimal($(id).value)}
function previewDay(){
  const gross=finite($('dayUber').value)+finite($('day99').value);
  const cost=finite($('dayFuel').value)+finite($('dayTolls').value)+finite($('dayOther').value);
  const km=finite($('dayKm').value);
  $('previewGross').textContent=money(gross);$('previewCosts').textContent=money(cost);
  $('previewProfit').textContent=money(gross-cost);$('previewProfit').style.color=gross-cost<0?'var(--red)':'var(--green)';
  $('previewPerKm').textContent=km>0?money(gross/km)+'/km':'—';
  $('previewAlert').textContent=gross>0||cost>0||km>0?'Resumo parcial deste registro. As reservas dos cofrinhos são calculadas separadamente.':'Preencha os valores para visualizar o resumo.';
}
function hasInvalidNumbers(ids){return ids.some(id=>{const raw=$(id).value.trim();return raw!==''&&(!Number.isFinite(formNum(id))||formNum(id)<0)})}
function onDaySubmit(e){
  e.preventDefault();
  const fields=['dayUber','day99','dayKm','dayHours','dayRides','dayFuel','dayLiters','dayTolls','dayOther'];
  if(!isDate($('dayDate').value)){toast('Selecione uma data válida.',true);$('dayDate').focus();return}
  if(hasInvalidNumbers(fields)){toast('Informe apenas valores numéricos iguais ou maiores que zero.',true);return}
  const uber=formNum('dayUber'),ninetyNine=formNum('day99'),fuel=formNum('dayFuel'),tolls=formNum('dayTolls'),other=formNum('dayOther'),km=formNum('dayKm');
  if(!(uber+ninetyNine+fuel+tolls+other+km>0)){toast('Informe pelo menos um ganho, km ou despesa.',true);return}
  const rec={id:idNew(),date:$('dayDate').value,period:$('dayPeriod').value,hours:formNum('dayHours'),
    rides:formNum('dayRides'),uber,ninetyNine,gross:uber+ninetyNine,km,liters:formNum('dayLiters'),
    fuelCost:fuel,tolls,otherVariable:other,note:safeText($('dayNote').value)};
  const previous=state.diary.slice();
  if(state.editingDayId!==null){
    const i=state.diary.findIndex(x=>String(x.id)===String(state.editingDayId));
    if(i<0){toast('Registro original não encontrado.',true);return}
    rec.id=state.diary[i].id;
    state.diary[i]=rec;
  }else state.diary.push(rec);
  if(!writeStorage(KEYS.diary,state.diary)){state.diary=previous;return}
  state.month=rec.date.slice(0,7);$('monthPicker').value=state.month;
  clearDayEdit();renderAll();toast('Registro salvo! Dashboard e Histórico atualizados.');
}
function clearDayEdit(){
  state.editingDayId=null;
  for(const id of ['dayUber','day99','dayKm','dayHours','dayRides','dayFuel','dayLiters','dayTolls','dayOther','dayNote'])$(id).value='';
  $('daySubmitButton').textContent='✓ Salvar registro do dia';$('cancelDayEdit').hidden=true;
  previewDay();
}
function clearExpenseEdit(){
  state.editingExpenseId=null;$('expenseAmount').value='';$('expenseNote').value='';
  $('expenseSubmitButton').textContent='+ Registrar despesa';$('cancelExpenseEdit').hidden=true;
}
function editHistory(kind,id){
  if(kind==='diary'){
    const d=state.diary.find(x=>String(x.id)===String(id));
    if(!d||d.uber===null||d.ninetyNine===null){toast('Registro antigo: para corrigir, faça um novo lançamento.',true);return}
    state.editingDayId=d.id;
    const fields={dayDate:d.date,dayPeriod:d.period,dayUber:d.uber,day99:d.ninetyNine,dayKm:d.km,dayHours:d.hours,dayRides:d.rides,dayFuel:d.fuelCost,dayLiters:d.liters,dayTolls:d.tolls,dayOther:d.otherVariable,dayNote:d.note};
    for(const [id,value] of Object.entries(fields))$(id).value=value;
    $('daySubmitButton').textContent='✓ Salvar alterações do dia';$('cancelDayEdit').hidden=false;
    selectView('registrar');previewDay();
  }else if(kind==='expense'){
    const e=state.expenses.find(x=>String(x.id)===String(id));if(!e)return;
    state.editingExpenseId=e.id;
    $('expenseDate').value=e.date;$('expenseCategory').value=e.category;$('expenseAmount').value=e.amount;$('expenseNote').value=e.note;
    $('expenseSubmitButton').textContent='✓ Salvar alterações da despesa';$('cancelExpenseEdit').hidden=false;
    selectView('historico');$('expenseAmount').focus();
  }
}
function historyItem({id,title,meta,date,amount,second,kind,positiveAmount}){
  return `<div class="history-entry"><div class="entry-main"><div class="entry-title">${enc(title)}</div><div class="entry-meta">${enc(meta)}</div><div class="entry-date">${dateBR(date)}</div></div><div class="entry-right"><div class="entry-amount ${positiveAmount?'positive':'negative'}">${positiveAmount?'+':'−'} ${money(amount)}</div>${second?`<div class="entry-second">${enc(second)}</div>`:''}${kind==='pot'?'':`<button type="button" class="delete-link" data-edit-kind="${kind}" data-edit-id="${enc(id)}">Editar</button>`}<button type="button" class="delete-link" data-delete-kind="${kind}" data-delete-id="${enc(id)}">Excluir</button></div></div>`;
}
function renderHistory(){
  const m=calcMonth();
  $('historyGross').textContent=money(m.gross);$('historyCost').textContent=money(m.costs);$('historyProfit').textContent=money(m.profit);
  const items=[...m.days.map(d=>({kind:'diary',...d})),...m.expenses.map(x=>({kind:'expense',...x}))].sort((a,b)=>b.date.localeCompare(a.date)||String(b.id).localeCompare(String(a.id)));
  $('historyCount').textContent=`${items.length} ${items.length===1?'REGISTRO':'REGISTROS'}`;
  if(!items.length){$('historyList').innerHTML='<div class="empty-state">Nenhum lançamento neste mês. Registre um dia ou adicione uma despesa.</div>';return}
  $('historyList').innerHTML=items.map(x=>{
    if(x.kind==='expense')return historyItem({id:x.id,title:CATEGORY_NAMES[x.category]||'Outros',meta:x.note||'Despesa avulsa',date:x.date,amount:x.amount,kind:'expense',positiveAmount:false});
    const described=x.uber!==null||x.ninetyNine!==null?`Uber ${money(x.uber||0)} · 99 ${money(x.ninetyNine||0)}`:'Faturamento legado (v1.3, sem divisão Uber/99)';
    const extra=`${number(x.km)} km · Gastos ${money(x.fuelCost+x.tolls+x.otherVariable)}${x.note?' · '+x.note:''}`;
    return historyItem({id:x.id,title:'Jornada Uber / 99',meta:described+' · '+extra,date:x.date,amount:x.gross,second:x.gross===0?'Somente gastos/km registrados':`Saldo do dia: ${money(x.gross-x.fuelCost-x.tolls-x.otherVariable)}`,kind:'diary',positiveAmount:true});
  }).join('');
}
function onExpenseSubmit(e){
  e.preventDefault();const amount=formNum('expenseAmount');
  if(!isDate($('expenseDate').value)){toast('Selecione uma data válida.',true);return}
  if(!Number.isFinite(amount)||amount<=0){toast('Informe o valor pago maior que zero.',true);$('expenseAmount').focus();return}
  const rec={id:idNew(),date:$('expenseDate').value,category:$('expenseCategory').value,amount,note:safeText($('expenseNote').value)};
  const previous=state.expenses.slice();
  if(state.editingExpenseId!==null){
    const i=state.expenses.findIndex(x=>String(x.id)===String(state.editingExpenseId));
    if(i<0){toast('Despesa original não encontrada.',true);return}
    rec.id=state.expenses[i].id;state.expenses[i]=rec;
  }else state.expenses.push(rec);
  if(!writeStorage(KEYS.expenses,state.expenses)){state.expenses=previous;return}
  state.month=rec.date.slice(0,7);$('monthPicker').value=state.month;
  clearExpenseEdit();renderAll();toast('Despesa salva uma única vez.');
}
function deleteHistory(kind,id){
  if(!confirm('Excluir este registro? Essa ação não pode ser desfeita.'))return;
  if(kind==='diary'){
    const previous=state.diary;state.diary=state.diary.filter(x=>String(x.id)!==String(id));
    if(!writeStorage(KEYS.diary,state.diary)){state.diary=previous;return}
  }else if(kind==='expense'){
    const previous=state.expenses;state.expenses=state.expenses.filter(x=>String(x.id)!==String(id));
    if(!writeStorage(KEYS.expenses,state.expenses)){state.expenses=previous;return}
  }else if(kind==='pot'){
    const previous=state.pots.movements;
    const match=previous.find(x=>String(x.id)===String(id));
    if(!match)return;
    const remainder=previous.filter(x=>String(x.id)!==String(id));
    const balanceAfter=sum(remainder.filter(x=>x.pot===match.pot),x=>x.type==='deposit'?x.amount:-x.amount);
    if(balanceAfter<-.001){toast('Não é possível excluir este aporte: existem retiradas que dependem dele.',true);return}
    state.pots.movements=remainder;
    if(!writeStorage(KEYS.pots,state.pots)){state.pots.movements=previous;return}
  }
  renderAll();toast('Registro excluído.');
}
function renderPots(){
  $('potsTotal').textContent=money(allPotBalances());
  $('potCards').innerHTML=Object.entries(POT_NAMES).map(([key,name])=>{
    const bal=potBalance(key),goal=state.pots.goals[key],perc=goal>0?Math.min(100,Math.max(0,bal/goal*100)):0;
    return `<article class="pot-card"><div class="pot-card-top"><div class="pot-icon">${POT_ICONS[key]}</div><div><h2>${enc(name)}</h2><div class="pot-caption">Reserva para despesas futuras</div></div></div><div class="pot-label">VALOR GUARDADO</div><div class="pot-balance">${money(bal)}</div><div class="pot-progress"><div class="pot-progress-fill" style="width:${perc}%"></div></div><div class="pot-target-description"><span>${goal>0?`${oneDecimal(perc)}% da meta`:'Meta ainda não definida'}</span><b>${goal>0?money(goal):'—'}</b></div><form class="pot-goal-edit" data-pot-goal="${key}"><input type="text" name="goal" inputmode="decimal" aria-label="Meta do cofrinho ${enc(name)}" placeholder="Meta em R$" value="${goal>0?goal.toFixed(2):''}"><button type="submit">Salvar meta</button></form></article>`;
  }).join('');
  const items=monthPotMoves().sort((a,b)=>b.date.localeCompare(a.date)||String(b.id).localeCompare(String(a.id)));
  $('potHistory').innerHTML=!items.length?'<div class="empty-state">Nenhuma movimentação neste mês.</div>':items.map(x=>historyItem({id:x.id,title:POT_NAMES[x.pot],meta:x.note||(x.type==='deposit'?'Dinheiro guardado':'Dinheiro retirado'),date:x.date,amount:x.amount,kind:'pot',positiveAmount:x.type==='deposit'})).join('');
}
function onGoalSubmit(e){
  const form=e.target.closest('form[data-pot-goal]');if(!form)return;
  e.preventDefault();const pot=form.dataset.potGoal,val=decimal(form.elements.goal.value);
  if(!POT_NAMES[pot]||!Number.isFinite(val)||val<0){toast('Informe uma meta válida, igual ou maior que zero.',true);return}
  const old=state.pots.goals[pot];state.pots.goals[pot]=val;
  if(!writeStorage(KEYS.pots,state.pots)){state.pots.goals[pot]=old;return}
  renderPots();toast('Meta do cofrinho atualizada.');
}
function onPotSubmit(e){
  e.preventDefault();const pot=$('potSelect').value,type=$('potType').value,amount=formNum('potAmount');
  if(!POT_NAMES[pot]||!['deposit','withdraw'].includes(type)||!isDate($('potDate').value)){toast('Confira os dados da movimentação.',true);return}
  if(!Number.isFinite(amount)||amount<=0){toast('Informe um valor maior que zero.',true);return}
  if(type==='withdraw'&&amount>potBalance(pot)+.001){toast('A retirada é maior que o saldo deste cofrinho.',true);return}
  const rec={id:idNew(),pot,type,amount,date:$('potDate').value,note:safeText($('potNote').value)};
  state.pots.movements.push(rec);
  if(!writeStorage(KEYS.pots,state.pots)){state.pots.movements.pop();return}
  state.month=rec.date.slice(0,7);$('monthPicker').value=state.month;
  $('potAmount').value='';$('potNote').value='';renderAll();toast(type==='deposit'?'Dinheiro reservado com sucesso.':'Retirada registrada.');
}
function renderAll(){renderDashboard();renderHistory();renderPots()}
function downloadBlob(content,mime,filename){
  const blob=new Blob([content],{type:mime}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function exportBackup(){
  const settings=readStorage(KEYS.settings,{});
  const payload={version:'1.4',vehicle:'Volkswagen Polo Comfortline Automático 2023/2024',exportedAt:new Date().toISOString(),settings,
    diary:state.diary,expenses:state.expenses,pots:state.pots};
  downloadBlob(JSON.stringify(payload,null,2),'application/json;charset=utf-8',`polo-finance-backup-${dateToday()}.json`);
  toast('Backup preparado. Salve o arquivo em local seguro.');
}
async function importBackup(e){
  const file=e.target.files?.[0];if(!file)return;
  try{
    const data=JSON.parse(await file.text());
    if(!data||typeof data!=='object'||!Array.isArray(data.diary))throw Error('Backup sem diário válido.');
    if(data.expenses!==undefined&&!Array.isArray(data.expenses))throw Error('Despesas inválidas.');
    if(!confirm('Restaurar este backup? Isso SUBSTITUI todos os registros deste navegador. Exporte um backup antes se necessário.'))return;
    const nextDiary=sanitizeDiary(data.diary),nextExpenses=sanitizeExpenses(data.expenses||[]),nextPots=sanitizePots(data.pots||null);
    // Faça o backup do atual antes de aplicar. A v1.3 fornece apenas diary e settings.
    const currentSettings=readStorage(KEYS.settings,{});
    const nextSettings=data.settings&&typeof data.settings==='object'&&!Array.isArray(data.settings)?data.settings:currentSettings;
    const ok=[writeStorage(KEYS.diary,nextDiary),writeStorage(KEYS.expenses,nextExpenses),writeStorage(KEYS.pots,nextPots),writeStorage(KEYS.settings,nextSettings)];
    if(ok.some(v=>!v)){toast('Falha ao gravar backup. Verifique o espaço de armazenamento.',true);return}
    state.diary=nextDiary;state.expenses=nextExpenses;state.pots=nextPots;
    renderAll();toast('Backup restaurado! Dados da versão 1.3 compatíveis.');
  }catch(err){toast('Não foi possível importar: '+(err?.message||'arquivo inválido.'),true)}
  finally{e.target.value=''}
}
function exportCSV(){
  const m=calcMonth(),records=[];
  for(const d of m.days)records.push([d.date,'Jornada',d.uber??'',d.ninetyNine??'',d.gross,d.km,d.fuelCost,d.liters,d.tolls,d.otherVariable,'',d.note]);
  for(const e of m.expenses)records.push([e.date,CATEGORY_NAMES[e.category]||'Despesa','','','','','','','','',e.amount,e.note]);
  records.sort((a,b)=>a[0].localeCompare(b[0]));
  if(!records.length){toast('Não há registros para exportar neste mês.',true);return}
  const columns=['Data','Tipo','Uber','99','Faturamento bruto','Km','Combustível no diário','Litros','Pedágio','Outros no diário','Valor de despesa avulsa','Observação'];
  const escape=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const csv='\uFEFF'+[columns,...records].map(row=>row.map(escape).join(';')).join('\r\n');
  downloadBlob(csv,'text/csv;charset=utf-8',`polo-finance-${state.month}.csv`);
  toast('CSV do mês preparado.');
}
function init(){
  $('monthPicker').value=state.month;
  $('dayDate').value=dateToday();$('expenseDate').value=dateToday();$('potDate').value=dateToday();
  $('monthPicker').addEventListener('change',e=>{if(/^\d{4}-\d{2}$/.test(e.target.value)){state.month=e.target.value;renderAll()}});
  document.querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>selectView(b.dataset.nav)));
  document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>{selectView(b.dataset.go);if(b.dataset.focus==='expense')$('expenseAmount').focus()}));
  $('dayForm').addEventListener('submit',onDaySubmit);
  $('dayForm').addEventListener('input',previewDay);
  $('expenseForm').addEventListener('submit',onExpenseSubmit);
  $('potForm').addEventListener('submit',onPotSubmit);
  $('potCards').addEventListener('submit',onGoalSubmit);
  document.addEventListener('click',e=>{
    const button=e.target.closest('[data-delete-kind]');
    if(button)deleteHistory(button.dataset.deleteKind,button.dataset.deleteId);
    const edit=e.target.closest('[data-edit-kind]');
    if(edit)editHistory(edit.dataset.editKind,edit.dataset.editId);
  });
  $('cancelDayEdit').addEventListener('click',clearDayEdit);
  $('cancelExpenseEdit').addEventListener('click',clearExpenseEdit);
  $('backupMenuButton').addEventListener('click',()=>{
    $('toolsPanel').hidden=!$('toolsPanel').hidden;
    $('backupMenuButton').setAttribute('aria-expanded',String(!$('toolsPanel').hidden));
  });
  $('exportBackupButton').addEventListener('click',exportBackup);
  $('importBackupButton').addEventListener('click',()=>$('backupFile').click());
  $('backupFile').addEventListener('change',importBackup);
  $('historyExportCsv').addEventListener('click',exportCSV);
  $('historyExportMobile').addEventListener('click',exportCSV);
  window.addEventListener('pageshow',renderAll); // Ao voltar do planejamento, atualize a meta.
  previewDay();renderAll();
  if(!storageAvailable())toast('Armazenamento local indisponível: seus dados podem não ser salvos.',true);
  if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')){
    window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(err=>console.info('PWA offline não ativado:',err)));
  }
}
function storageAvailable(){try{const k='__polo_test__';localStorage.setItem(k,'1');localStorage.removeItem(k);return true}catch{return false}}
document.addEventListener('DOMContentLoaded',init);
