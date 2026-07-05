// ─── AUTH ───
let authToken = null, currentUser = null;
function getToken() { return authToken || sessionStorage.getItem('dp_token'); }
function setSession(data) { authToken = data.token; currentUser = data; sessionStorage.setItem('dp_token', data.token); sessionStorage.setItem('dp_user', JSON.stringify(data)); }
function clearSession() { authToken = null; currentUser = null; sessionStorage.removeItem('dp_token'); sessionStorage.removeItem('dp_user'); }
function loadSession() { const t = sessionStorage.getItem('dp_token'), u = sessionStorage.getItem('dp_user'); if (t && u) { authToken = t; currentUser = JSON.parse(u); return true; } return false; }

function switchAuthTab(tab) {
  document.getElementById('tabLogin').classList.toggle('active', tab==='login');
  document.getElementById('tabRegistro').classList.toggle('active', tab==='registro');
  document.getElementById('formLogin').classList.toggle('hidden', tab!=='login');
  document.getElementById('formRegistro').classList.toggle('hidden', tab!=='registro');
  hideAuthError('login'); hideAuthError('registro');
}
function showAuthError(f,m){const e=document.getElementById(f+'Error');e.textContent=m;e.classList.add('show');}
function hideAuthError(f){document.getElementById(f+'Error').classList.remove('show');}
function setAuthLoading(id,l){const b=document.getElementById(id);b.disabled=l;b.textContent=l?'Aguarde...':(id==='btnLogin'?'Entrar':'Criar conta');}

async function doLogin() {
  const email=document.getElementById('loginEmail').value.trim(), senha=document.getElementById('loginSenha').value;
  hideAuthError('login');
  if(!email||!senha){showAuthError('login','Preencha e-mail e senha.');return;}
  setAuthLoading('btnLogin',true);
  try {
    const res=await fetch(API_BASE+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,senha})});
    if(!res.ok){
      let body=null;
      try{ body = await res.json(); }catch(_){}
      const err=new Error(body?.message || 'Credenciais inválidas');
      err.status=res.status;
      throw err;
    }
    setSession(await res.json()); onLoginSuccess();
  } catch(e){
    showAuthError('login', e.status===401||e.status===403 ? 'E-mail ou senha incorretos.' : (e.message||'Erro ao entrar.'));
  }
  finally{setAuthLoading('btnLogin',false);}
}

async function doRegistro() {
  const n=document.getElementById('regNome').value.trim(), e=document.getElementById('regEmail').value.trim(), s=document.getElementById('regSenha').value;
  hideAuthError('registro');
  if(!n||!e||!s){showAuthError('registro','Preencha todos os campos.');return;}
  if(s.length<8){showAuthError('registro','Senha precisa ter no mínimo 8 caracteres.');return;}
  setAuthLoading('btnRegistro',true);
  try {
    const res=await fetch(API_BASE+'/api/auth/registro',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nomeCompleto:n,emailUsuario:e,senha:s})});
    if(!res.ok){
      let body=null;
      try{ body = await res.json(); }catch(_){}
      const err=new Error(body?.message || 'Erro ao criar conta');
      err.fieldErrors = body?.fieldErrors || null;
      throw err;
    }
    toast('Conta criada! Faça o login.','success'); switchAuthTab('login'); document.getElementById('loginEmail').value=e;
  } catch(e){showAuthError('registro', formatApiError(e));}
  finally{setAuthLoading('btnRegistro',false);}
}


function onLoginSuccess() { document.getElementById('authScreen').classList.add('hidden'); updateUserChip(); loadDashboard(); }
function updateUserChip() {
  if(!currentUser)return;
  const i=(currentUser.nomeCompleto||currentUser.email||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
  document.getElementById('userAvatar').textContent=i;
  document.getElementById('userChipName').textContent=currentUser.nomeCompleto||currentUser.email;
  document.getElementById('ddName').textContent=currentUser.nomeCompleto||'—';
  document.getElementById('ddEmail').textContent=currentUser.email||'—';
  const isAdmin=(currentUser.role||'').includes('ADMIN');
  const r=document.getElementById('ddRole'); r.textContent=isAdmin?'Admin':'Usuário'; r.className='role-badge '+(isAdmin?'role-admin':'role-user');
}
function doLogout(){clearSession();toggleUserDropdown(false);document.getElementById('authScreen').classList.remove('hidden');toast('Sessão encerrada.','info');}
// ─── TROCA DE SENHA ───
function openChangePasswordModal(){
  document.getElementById('tsPasso1').classList.remove('hidden');
  document.getElementById('tsPasso2').classList.add('hidden');
  document.getElementById('tsCodigo').value='';
  document.getElementById('tsNovaSenha').value='';
  document.getElementById('tsConfirmarSenha').value='';
  hideTsError(1); hideTsError(2);
  const btn=document.getElementById('btnTsAcao');
  btn.textContent='Enviar código'; btn.onclick=solicitarCodigoSenha; btn.disabled=false;
  openModal('modalTrocarSenha');
}
function showTsError(step,msg){const e=document.getElementById('tsErro'+step);e.textContent=msg;e.classList.add('show');}
function hideTsError(step){document.getElementById('tsErro'+step).classList.remove('show');}

async function solicitarCodigoSenha(){
  hideTsError(1); hideTsError(2);
  const btn=document.getElementById('btnTsAcao');
  const btnReenviar=document.getElementById('btnReenviarCodigo');
  btn.disabled=true; if(btn.textContent==='Enviar código') btn.textContent='Enviando...';
  if(btnReenviar) btnReenviar.disabled=true;
  try{
    await apiFetch('/api/auth/solicitar-codigo',{method:'POST'});
    toast('Código enviado para o seu e-mail!','success');
    document.getElementById('tsPasso1').classList.add('hidden');
    document.getElementById('tsPasso2').classList.remove('hidden');
    btn.textContent='Alterar Senha';
    btn.onclick=confirmarTrocaSenha;
  }catch(e){
    showTsError(document.getElementById('tsPasso2').classList.contains('hidden')?1:2, e.message||'Erro ao solicitar código.');
    btn.textContent = document.getElementById('tsPasso2').classList.contains('hidden') ? 'Enviar código' : 'Alterar Senha';
  }finally{
    btn.disabled=false;
    if(btnReenviar) btnReenviar.disabled=false;
  }
}

async function confirmarTrocaSenha(){
  hideTsError(2);
  const codigo=document.getElementById('tsCodigo').value.trim();
  const novaSenha=document.getElementById('tsNovaSenha').value;
  const confirmar=document.getElementById('tsConfirmarSenha').value;

  if(!codigo){showTsError(2,'Informe o código recebido por e-mail.');return;}
  if(novaSenha.length<8){showTsError(2,'A nova senha precisa ter no mínimo 8 caracteres.');return;}
  if(novaSenha!==confirmar){showTsError(2,'As senhas não coincidem.');return;}

  const btn=document.getElementById('btnTsAcao');
  btn.disabled=true; btn.textContent='Alterando...';
  try{
    await apiFetch('/api/auth/trocar-senha',{method:'PATCH',body:JSON.stringify({codigo,newPassword:novaSenha})});
    toast('Senha alterada com sucesso!','success');
    closeModal('modalTrocarSenha');
  }catch(e){
    showTsError(2, e.message||'Erro ao trocar a senha.');
  }finally{
    btn.disabled=false; btn.textContent='Alterar Senha';
  }
}
function toggleUserDropdown(f){const d=document.getElementById('userDropdown');d.classList.toggle('open',f!==undefined?f:!d.classList.contains('open'));}
document.addEventListener('click',e=>{if(!document.getElementById('userDropdownWrap')?.contains(e.target))toggleUserDropdown(false);});

// ─── STATE ───
let API_BASE = 'http://apidispesas.etheris.tec.br';
//let API_BASE = 'http://186.249.34.150:8089';
//let API_BASE = 'http://localhost:8080';
let currentPage=0, totalPages=0, invPage=0, invTotalPages=0;
let charts={}, currentSection='dashboard';

function setApiBase(v){API_BASE=v.trim().replace(/\/$/,'');}

// ─── MONTH/YEAR ───
function populateMonthYear(mesId,anoId,changeFunc){
  const meses=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const mes=document.getElementById(mesId), ano=document.getElementById(anoId), now=new Date();
  meses.forEach((m,i)=>{const o=document.createElement('option');o.value=i+1;o.textContent=m;if(i+1===now.getMonth()+1)o.selected=true;mes.appendChild(o);});
  for(let y=now.getFullYear()-2;y<=now.getFullYear()+1;y++){const o=document.createElement('option');o.value=y;o.textContent=y;if(y===now.getFullYear())o.selected=true;ano.appendChild(o);}
  if(changeFunc){mes.onchange=changeFunc;ano.onchange=changeFunc;}
}

// ─── API ───
async function apiFetch(path,options={}){
  const token=getToken();
  const res=await fetch(API_BASE+path,{headers:{'Content-Type':'application/json',...(token?{'Authorization':'Bearer '+token}:{}),...options.headers},...options});

  if(res.status===401||res.status===403){
    clearSession();
    document.getElementById('authScreen').classList.remove('hidden');
    toast('Sessão expirada.','error');
    throw new Error('Não autorizado');
  }
  if(res.status===204||(res.status===201&&!res.headers.get('content-type')))return null;

  if(!res.ok){
    let body=null;
    try{ body = await res.json(); }catch(_){ /* corpo não é JSON */ }
    const err = new Error(body?.message || res.statusText || 'Erro desconhecido');
    err.status = res.status;
    err.fieldErrors = body?.fieldErrors || null;
    throw err;
  }

  const ct=res.headers.get('content-type')||'';
  if(ct.includes('application/json'))return res.json();
  if(ct.includes('image')||ct.includes('pdf')||ct.includes('octet-stream')||ct.startsWith('application/')||res.headers.get('content-disposition')?.includes('inline'))return res.blob();
  return res.text();
}

function formatApiError(err){
  if(err?.fieldErrors && Object.keys(err.fieldErrors).length){
    return Object.entries(err.fieldErrors).map(([campo,msg])=>`${campo}: ${msg}`).join(' · ');
  }
  return err?.message || 'Erro desconhecido';
}

// ─── NAVIGATION ───
const sections={dashboard:'Dashboard',despesas:'Despesas',parcelas:'Parcelas em Aberto',investimentos:'Investimentos',relatorios:'Gastos por Mês',top5:'Top 5 Ranking',categorias:'Por Categoria',comparativo:'Comparativo'};
function navigate(id){
  currentSection=id;
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('sec-'+id).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>{if(n.textContent.trim().toLowerCase().includes((sections[id]||'').toLowerCase().split(' ')[0].toLowerCase()))n.classList.add('active');});
  document.getElementById('topbarTitle').textContent=sections[id]||id;
  closeSidebar();
  loaders[id]?.();
}
const loaders={dashboard:loadDashboard,despesas:loadDespesas,parcelas:loadParcelas,investimentos:loadInvestimentos,relatorios:loadRelatorios,top5:loadTop5,categorias:loadCategorias,comparativo:()=>{}};

function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('sidebarOverlay').classList.toggle('open');}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('sidebarOverlay').classList.remove('open');}

// ─── TOAST ───
function toast(msg,type='info'){
  const t=document.getElementById('toast'),d=document.createElement('div');
  d.className=`toast-item ${type}`;
  const icons={success:'✅',error:'❌',info:'🔔'};
  d.innerHTML=`<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  t.appendChild(d);
  setTimeout(()=>{d.style.opacity='0';d.style.transform='translateX(110%)';d.style.transition='.3s';setTimeout(()=>d.remove(),300);},3200);
}

// ─── FORMAT ───
function formatBRL(v){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);}
function formatDate(d){if(!d)return'—';const p=d.split('-');return`${p[2]}/${p[1]}/${p[0]}`;}

const categoryLabel={ALIMENTACAO:'Alimentação',TRANSPORTE:'Transporte',COMBUSTIVEL:'Combustível',MORADIA:'Moradia',AGUA:'Água',ENERGIA:'Energia',INTERNET:'Internet',TELEFONIA:'Telefonia',GAS:'Gás',CONDOMINIO:'Condomínio',SAUDE:'Saúde',FARMACIA:'Farmácia',EDUCACAO:'Educação',CUIDADOS_PESSOAIS:'Cuidados Pessoais',CURSOS:'Cursos',LAZER:'Lazer',VIAGEM:'Viagem',VESTUARIO:'Vestuário',PRESENTES:'Presentes',PETS:'Pets',ASSINATURAS:'Assinaturas',IMPOSTOS:'Impostos',SEGUROS:'Seguros',INVESTIMENTOS:'Investimentos',SALARIO:'Salário',MANUTENCAO_VEICULO:'Manutenção Veículo',ESCRITORIO:'Escritório',OUTROS:'Outros'};
const paymentLabel={DINHEIRO:'Dinheiro',CREDITO:'Crédito',DEBITO:'Débito',PIX:'PIX',BOLETO:'Boleto'};
const statusBadge={PAGO:'badge-green',PENDENTE:'badge-yellow',CANCELADO:'badge-red'};
const typeBadge={DESPESA:'badge-red',RECEITA:'badge-green'};
const catIcon={ALIMENTACAO:'🍽️',TRANSPORTE:'🚗',COMBUSTIVEL:'⛽',MORADIA:'🏠',AGUA:'🚰',ENERGIA:'⚡',INTERNET:'🌐',TELEFONIA:'📱',GAS:'🔥',CONDOMINIO:'🏢',SAUDE:'🏥',FARMACIA:'💊',EDUCACAO:'📚',CUIDADOS_PESSOAIS:'💇',CURSOS:'🎓',LAZER:'🎉',VIAGEM:'✈️',VESTUARIO:'👗',PRESENTES:'🎁',PETS:'🐶',ASSINATURAS:'📺',IMPOSTOS:'🧾',SEGUROS:'🛡️',INVESTIMENTOS:'📈',SALARIO:'💰',MANUTENCAO_VEICULO:'🔧',ESCRITORIO:'💼',OUTROS:'📦'};
const monthNames=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const invTipoLabel = {
    TESOURO_DIRETO: 'Tesouro Direto',
    CDB: 'CDB',
    LCI: 'LCI',
    LCA: 'LCA',
    DEBENTURE: 'Debênture',
    CRI: 'CRI',
    CRA: 'CRA',
    POUPANCA: 'Poupança',

    ACOES: 'Ações',
    FIIS: 'FIIs',
    ETFS: 'ETFs',
    BDRS: 'BDRs',

    FUNDOS_DE_INVESTIMENTO: 'Fundos de Investimento',

    CRIPTOMOEDAS: 'Criptomoedas',

    IMOVEIS: 'Imóveis',

    PREVIDENCIA_PRIVADA: 'Previdência Privada',

    OURO: 'Ouro',
    PRATA: 'Prata',
    COMMODITIES: 'Commodities',

    CAMBIO: 'Câmbio',

    COE: 'COE',

    OUTROS: 'Outros'
};

const invTipoIcon = {
    TESOURO_DIRETO: '🇧🇷',
    CDB: '🏦',
    LCI: '🏠',
    LCA: '🌾',
    DEBENTURE: '📜',
    CRI: '🏢',
    CRA: '🌱',
    POUPANCA: '🐷',

    ACOES: '📈',
    FIIS: '🏢',
    ETFS: '🌍',
    BDRS: '🇺🇸',

    FUNDOS_DE_INVESTIMENTO: '📂',

    CRIPTOMOEDAS: '₿',

    IMOVEIS: '🏠',

    PREVIDENCIA_PRIVADA: '🛡️',

    OURO: '🥇',
    PRATA: '🥈',
    COMMODITIES: '⛽',

    CAMBIO: '💱',

    COE: '📄',

    OUTROS: '📦'
};

const invStatusBadge={ATIVO:'badge-green',ENCERRADO:'badge-gray',VENCIDO:'badge-red',RESGATADO:'badge-blue'};

// ─── CHART DEFAULTS ───
Chart.defaults.color='#55546A'; Chart.defaults.font.family='Segoe UI, system-ui, sans-serif';
Chart.defaults.plugins.tooltip.backgroundColor='#1C1C22'; Chart.defaults.plugins.tooltip.borderColor='#2A2A35';
Chart.defaults.plugins.tooltip.borderWidth=1; Chart.defaults.plugins.tooltip.padding=10;
Chart.defaults.plugins.tooltip.titleColor='#F0EFF5'; Chart.defaults.plugins.tooltip.bodyColor='#9A99A8';
const C=['#FF6B00','#FF8C38','#FFB347','#FF4444','#22C55E','#38BDF8','#A78BFA','#FB923C'];
function destroyChart(id){if(charts[id]){charts[id].destroy();delete charts[id];}}

// ─── DASHBOARD ───
async function loadDashboard(){
  const mes=+document.getElementById('dashMes').value, ano=+document.getElementById('dashAno').value;
  try{
    const[saldo,mensal,categoria,top5g,top5c]=await Promise.all([
      apiFetch('/api/despesas/saldo'),
      apiFetch(`/api/despesas/resumo/mensal?mes=${mes}&ano=${ano}`),
      apiFetch(`/api/despesas/resumo/por-categoria?mes=${mes}&ano=${ano}`),
      apiFetch(`/api/despesas/top-5-gastos?mes=${mes}&ano=${ano}`),
      apiFetch(`/api/despesas/top-5-categorias?mes=${mes}&ano=${ano}`),
    ]);
    renderSaldoCards(saldo,mensal); renderChartMensal(mensal); renderChartCategoria(categoria); renderTop5Charts(top5g,top5c);
  }catch(e){toast('Erro ao carregar dashboard: '+e.message,'error');renderSaldoCardsError();}
}

function renderSaldoCards(saldo,mensal){
  document.getElementById('saldoCards').innerHTML=`
    <div class="stat-card"><div class="stat-icon orange">💰</div><div class="stat-label">Saldo Geral</div><div class="stat-value ${saldo?.saldo>=0?'orange':'red'}">${formatBRL(saldo?.saldo)}</div><div class="stat-sub">Receitas menos despesas totais</div></div>
    <div class="stat-card"><div class="stat-icon green">📈</div><div class="stat-label">Receitas do Mês</div><div class="stat-value green">${formatBRL(mensal?.totalReceitas)}</div><div class="stat-sub">${monthNames[(mensal?.mes||1)-1]} / ${mensal?.ano}</div></div>
    <div class="stat-card"><div class="stat-icon red">📉</div><div class="stat-label">Despesas do Mês</div><div class="stat-value red">${formatBRL(mensal?.totalDespesas)}</div><div class="stat-sub">${monthNames[(mensal?.mes||1)-1]} / ${mensal?.ano}</div></div>
    <div class="stat-card"><div class="stat-icon blue">⚖️</div><div class="stat-label">Saldo do Mês</div><div class="stat-value ${mensal?.saldo>=0?'green':'red'}">${formatBRL(mensal?.saldo)}</div><div class="stat-sub">Balanço do período</div></div>
  `;
}
function renderSaldoCardsError(){document.getElementById('saldoCards').innerHTML=`<div class="stat-card" style="grid-column:1/-1"><div class="empty"><div class="eico">⚠️</div><p>Não foi possível conectar à API.</p></div></div>`;}

function renderChartMensal(mensal){
  destroyChart('mensal');
  charts['mensal']=new Chart(document.getElementById('chartMensal').getContext('2d'),{type:'bar',data:{labels:['Receitas','Despesas','Saldo'],datasets:[{data:[mensal?.totalReceitas||0,mensal?.totalDespesas||0,Math.abs(mensal?.saldo||0)],backgroundColor:['rgba(34,197,94,.8)','rgba(255,68,68,.8)',mensal?.saldo>=0?'rgba(255,107,0,.8)':'rgba(255,68,68,.5)'],borderRadius:8,borderSkipped:false}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{grid:{color:'rgba(42,42,53,.5)'},ticks:{callback:v=>'R$'+v.toLocaleString('pt-BR')}},x:{grid:{display:false}}}}});
}
function renderChartCategoria(categoria){
  destroyChart('categoria'); if(!categoria?.length)return;
  charts['categoria']=new Chart(document.getElementById('chartCategoria').getContext('2d'),{type:'doughnut',data:{labels:categoria.map(c=>categoryLabel[c.category]||c.category),datasets:[{data:categoria.map(c=>c.total),backgroundColor:C,borderColor:'#141418',borderWidth:3}]},options:{responsive:true,cutout:'62%',plugins:{legend:{position:'right',labels:{boxWidth:10,padding:14,font:{size:12}}}}}});
}
function renderTop5Charts(top5g,top5c){
  destroyChart('top5g');destroyChart('top5c');
  if(top5g?.length){charts['top5g']=new Chart(document.getElementById('chartTop5Gastos').getContext('2d'),{type:'bar',data:{labels:top5g.map(r=>r.descricao?.length>18?r.descricao.substring(0,18)+'…':r.descricao),datasets:[{data:top5g.map(r=>r.total),backgroundColor:C[0],borderRadius:6}]},options:{indexAxis:'y',responsive:true,plugins:{legend:{display:false}},scales:{x:{grid:{color:'rgba(42,42,53,.5)'},ticks:{callback:v=>'R$'+v.toLocaleString('pt-BR')}},y:{grid:{display:false}}}}});}
  if(top5c?.length){charts['top5c']=new Chart(document.getElementById('chartTop5Cat').getContext('2d'),{type:'pie',data:{labels:top5c.map(r=>categoryLabel[r.categoria]||r.categoria),datasets:[{data:top5c.map(r=>r.total),backgroundColor:C,borderColor:'#141418',borderWidth:3}]},options:{responsive:true,plugins:{legend:{position:'bottom',labels:{boxWidth:10,padding:12}}}}});}
}

// ─── DESPESAS ───
async function loadDespesas(){
  document.getElementById('despesasTable').innerHTML='<div class="loading"><div class="spinner"></div></div>';
  const type = document.getElementById('fType').value;
const category = document.getElementById('fCategory').value;
const status = document.getElementById('fStatus').value;
const di = document.getElementById('fDataInicio').value;
const df = document.getElementById('fDataFim').value;
const ordenacao = document.getElementById('fOrdenacao').value;

const hasFilter = type || category || status || di || df || ordenacao;
  try{
    let data;
    if(hasFilter){
      let qs=[];
      if(type)qs.push('type='+type); if(category)qs.push('category='+category); if(status)qs.push('status='+status); if(di)qs.push('dataInicio='+di); if(df)qs.push('dataFim='+df); if(ordenacao)
    qs.push('ordenacaoDespesa=' + ordenacao);
      data=await apiFetch('/api/despesas/filtrar?'+qs.join('&')); renderDespesasTable(data); document.getElementById('pagination').innerHTML='';
    }else{
      data=await apiFetch(`/api/despesas?page=${currentPage}&size=10&sort=id`); totalPages=data.totalPages; renderDespesasTable(data.content); renderPagination();
    }
  }catch(e){document.getElementById('despesasTable').innerHTML=`<div class="empty"><div class="eico">⚠️</div><p>${e.message}</p></div>`;}
}


function renderDespesasTable(rows){
  if(!rows?.length){document.getElementById('despesasTable').innerHTML=`<div class="empty"><div class="eico">📋</div><p>Nenhuma despesa encontrada.</p><button class="btn btn-primary" onclick="openNewDespesa()">+ Criar primeira despesa</button></div>`;return;}
  document.getElementById('despesasTable').innerHTML=`<table><thead><tr><th>Descrição</th><th>Valor</th><th>Tipo</th><th>Categoria</th><th>Pagamento</th><th>Status</th><th>Data</th><th>Ações</th></tr></thead><tbody>${rows.map(r=>`<tr><td><span style="font-weight:600">${r.description}</span>${r.recurrent?' <span class="badge badge-orange" style="font-size:9px;margin-left:4px">🔄 Fixo</span>':''}${r.installments?`<span class="badge badge-gray" style="font-size:9px;margin-left:4px">${r.installmentNumber||1}/${r.installments}</span>`:''}</td><td style="color:${r.type==='RECEITA'?'var(--green)':'var(--red)'};font-weight:700">${formatBRL(r.value)}</td><td><span class="badge ${typeBadge[r.type]||'badge-gray'}">${r.type}</span></td><td><span style="color:var(--text2)">${catIcon[r.category]||'📦'} ${categoryLabel[r.category]||r.category}</span></td><td><span style="color:var(--text3)">${paymentLabel[r.paymentMethod]||r.paymentMethod}</span></td><td><span class="badge ${statusBadge[r.status]||'badge-gray'}">${r.status}</span></td><td style="color:var(--text3)">${formatDate(r.expenseDate)}</td><td><div style="display:flex;gap:4px"><button class="btn btn-ghost btn-sm btn-icon" onclick="viewDespesa(${r.id})" title="Detalhes">👁️</button><button class="btn btn-ghost btn-sm btn-icon" onclick="editDespesa(${r.id})" title="Editar">✏️</button><button class="btn btn-ghost btn-sm btn-icon" onclick="duplicarDespesa(${r.id})" title="Duplicar">📋</button><button class="btn btn-danger btn-sm btn-icon" onclick="deleteDespesa(${r.id})" title="Excluir">🗑️</button></div></td></tr>`).join('')}</tbody></table>`;
}
function renderPagination(){document.getElementById('pagination').innerHTML=`<button onclick="changePage(-1)" ${currentPage===0?'disabled':''}>← Anterior</button><span class="page-info">Página ${currentPage+1} de ${totalPages||1}</span><button onclick="changePage(1)" ${currentPage>=totalPages-1?'disabled':''}>Próxima →</button>`;}
function changePage(d){currentPage=Math.max(0,Math.min(totalPages-1,currentPage+d));loadDespesas();}
function clearFilters(){['fType','fCategory','fStatus'].forEach(id=>document.getElementById(id).value='');
  ['fType','fCategory','fStatus','fOrdenacao'].forEach(id =>
    document.getElementById(id).value=''
);['fDataInicio','fDataFim'].forEach(id=>document.getElementById(id).value='');currentPage=0;loadDespesas();}

// ─── DESPESA CRUD ───
function openNewDespesa(){
  document.getElementById('modalTitle').textContent='Nova Despesa'; document.getElementById('despesaId').value='';
  ['fDesc','fValue','fInstallments','fInstallmentNum'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('fTypeModal').value='DESPESA'; document.getElementById('fCatModal').value='OUTROS';
  document.getElementById('fPayment').value='DINHEIRO'; document.getElementById('fStatusModal').value='PENDENTE';
  document.getElementById('fRecurrent').checked=false; document.getElementById('fDate').value=new Date().toISOString().split('T')[0];
  openModal('modalDespesa');
}
async function editDespesa(id){
  try{
    const r=await apiFetch('/api/despesas/'+id);
    document.getElementById('modalTitle').textContent='Editar Despesa'; document.getElementById('despesaId').value=r.id;
    document.getElementById('fDesc').value=r.description; document.getElementById('fValue').value=r.value;
    document.getElementById('fDate').value=r.expenseDate; document.getElementById('fTypeModal').value=r.type;
    document.getElementById('fCatModal').value=r.category; document.getElementById('fPayment').value=r.paymentMethod;
    document.getElementById('fStatusModal').value=r.status; document.getElementById('fInstallments').value=r.installments||'';
    document.getElementById('fInstallmentNum').value=r.installmentNumber||''; document.getElementById('fRecurrent').checked=r.recurrent;
    openModal('modalDespesa');
  }catch(e){toast('Erro: '+e.message,'error');}
}
async function saveDespesa(){
  const id=document.getElementById('despesaId').value;
  const body={description:document.getElementById('fDesc').value,value:parseFloat(document.getElementById('fValue').value),type:document.getElementById('fTypeModal').value,category:document.getElementById('fCatModal').value,paymentMethod:document.getElementById('fPayment').value,status:document.getElementById('fStatusModal').value,expenseDate:document.getElementById('fDate').value,installments:parseInt(document.getElementById('fInstallments').value)||null,installmentNumber:parseInt(document.getElementById('fInstallmentNum').value)||null,recurrent:document.getElementById('fRecurrent').checked};
  if(!body.description||!body.value||!body.expenseDate){toast('Preencha os campos obrigatórios','error');return;}
  try{
    if(id){await apiFetch('/api/despesas/'+id,{method:'PATCH',body:JSON.stringify(body)});toast('Despesa atualizada!','success');}
    else{await apiFetch('/api/despesas',{method:'POST',body:JSON.stringify(body)});toast('Despesa criada!','success');}
    closeModal('modalDespesa');
    if(currentSection==='despesas')loadDespesas();
    if(currentSection==='dashboard')loadDashboard();
  }catch(e){toast('Erro: '+formatApiError(e),'error');}
}
async function deleteDespesa(id){if(!confirm('Excluir esta despesa?'))return;try{await apiFetch('/api/despesas/'+id,{method:'DELETE'});toast('Despesa excluída!','success');loadDespesas();}catch(e){toast('Erro: '+e.message,'error');}}
async function duplicarDespesa(id){try{await apiFetch('/api/despesas/'+id+'/duplicar',{method:'POST'});toast('Despesa duplicada!','success');loadDespesas();}catch(e){toast('Erro: '+e.message,'error');}}

async function viewDespesa(id){
  try{
    const r=await apiFetch('/api/despesas/'+id);
    document.getElementById('detalheBody').innerHTML=`
      <div class="detail-row"><span class="detail-label">ID</span><span class="detail-value" style="color:var(--text3)">#${r.id}</span></div>
      <div class="detail-row"><span class="detail-label">Descrição</span><span class="detail-value">${r.description}</span></div>
      <div class="detail-row"><span class="detail-label">Valor</span><span class="detail-value" style="font-size:20px;font-weight:800;color:${r.type==='RECEITA'?'var(--green)':'var(--red)'}">${formatBRL(r.value)}</span></div>
      <div class="detail-row"><span class="detail-label">Tipo</span><span class="badge ${typeBadge[r.type]||'badge-gray'}">${r.type}</span></div>
      <div class="detail-row"><span class="detail-label">Categoria</span><span class="detail-value">${catIcon[r.category]} ${categoryLabel[r.category]||r.category}</span></div>
      <div class="detail-row"><span class="detail-label">Pagamento</span><span class="detail-value">${paymentLabel[r.paymentMethod]||r.paymentMethod}</span></div>
      <div class="detail-row"><span class="detail-label">Status</span><span class="badge ${statusBadge[r.status]||'badge-gray'}">${r.status}</span></div>
      <div class="detail-row"><span class="detail-label">Data</span><span class="detail-value">${formatDate(r.expenseDate)}</span></div>
      ${r.installments?`<div class="detail-row"><span class="detail-label">Parcelas</span><span class="detail-value">${r.installmentNumber||1} de ${r.installments}</span></div>`:''}
      <div class="detail-row"><span class="detail-label">Recorrente</span><span class="detail-value">${r.recurrent?'✅ Sim':'❌ Não'}</span></div>
      <div class="detail-row"><span class="detail-label">Criado em</span><span class="detail-value" style="color:var(--text3)">${r.createdAt?.replace('T',' ').substring(0,16)}</span></div>
      ${r.comprovantes?.length?`<div style="margin-top:14px"><div class="stat-label" style="margin-bottom:10px">Comprovantes (${r.comprovantes.length})</div><div class="comprovante-list">${r.comprovantes.map(c=>`<div class="comprovante-item"><span>📎 ${c.fileName} <span style="color:var(--text3);font-size:11px">(${(c.fileSizeBytes/1024).toFixed(1)} KB)</span></span><div style="display:flex;gap:4px"><button class="btn btn-ghost btn-sm" onclick="viewComprovante(${c.id})">Ver</button><button class="btn btn-danger btn-sm" onclick="deleteComprovante(${c.id},${r.id})">🗑️</button></div></div>`)
      .join('')}</div></div>`:`<div style="margin-top:14px"><div class="stat-label" style="margin-bottom:6px">Comprovantes</div><div style="color:var(--text3);font-size:13px">Nenhum comprovante anexado.</div></div>`}
      <div style="margin-top:14px"><div class="stat-label" style="margin-bottom:10px">Adicionar Comprovante</div><div class="upload-zone" onclick="document.getElementById('uploadFile').click()"><div class="uico">📤</div><div style="font-size:13px">Clique para selecionar arquivo</div><input type="file" id="uploadFile" style="display:none" onchange="uploadComprovante(${r.id},this)"></div></div>
    `;
    document.getElementById('detalheFooter').innerHTML=`<button class="btn btn-ghost" onclick="closeModal('modalDetalhe')">Fechar</button><button class="btn btn-ghost" onclick="duplicarDespesa(${r.id});closeModal('modalDetalhe')">📋 Duplicar</button><button class="btn btn-primary" onclick="closeModal('modalDetalhe');editDespesa(${r.id})">✏️ Editar</button>`;
    openModal('modalDetalhe');
  }catch(e){toast('Erro: '+e.message,'error');}
}

// ─── COMPROVANTES ───
async function uploadComprovante(despesaId,input){
  const file=input.files[0];if(!file)return;
  const fd=new FormData();fd.append('comprovante',file);
  try{
    const res=await fetch(`${API_BASE}/api/comprovante/${despesaId}/despesa`,{method:'POST',body:fd,headers:{...(getToken()?{'Authorization':'Bearer '+getToken()}:{})}});
    if(!res.ok){
      let body=null;
      try{ body = await res.json(); }catch(_){}
      throw new Error(body?.message || 'Erro ao enviar comprovante');
    }
    toast('Comprovante enviado!','success');viewDespesa(despesaId);
  }
  catch(e){toast('Erro: '+e.message,'error');}
}


async function viewComprovante(id){try{const blob=await apiFetch('/api/comprovante/'+id);window.open(URL.createObjectURL(blob),'_blank');}catch(e){toast('Erro ao abrir: '+e.message,'error');}}
async function deleteComprovante(cId,dId){if(!confirm('Excluir comprovante?'))return;try{await apiFetch('/api/comprovante/'+cId,{method:'DELETE'});toast('Comprovante excluído!','success');viewDespesa(dId);}catch(e){toast('Erro: '+e.message,'error');}}

// ─── PARCELAS ───
async function loadParcelas(){
  document.getElementById('parcelasContent').innerHTML='<div class="loading"><div class="spinner"></div></div>';
  try{
    const data=await apiFetch('/api/despesas/parcelas-em-aberto');
    if(!data?.length){document.getElementById('parcelasContent').innerHTML='<div class="empty"><div class="eico">🎉</div><p>Nenhuma parcela em aberto!</p></div>';return;}
    document.getElementById('parcelasContent').innerHTML=`<div style="display:flex;flex-direction:column;gap:12px">${
      data.map(p=>{
        const perc=p.installments?Math.round((p.parcelasPagas/p.installments)*100):100;
        const valorParcela=p.installments?(p.value/p.installments):p.value;
        const restantes=Math.max((p.installments||1)-(p.parcelasPagas||0),0);
        return`
      <div class="parcela-card"><div style="flex:1;min-width:0"><div style="font-weight:700;font-size:15px;margin-bottom:4px">${p.description}</div>
      <div style="font-size:12px;color:var(--text3)">Parcela ${p.parcelasPagas||0} de ${p.installments||1} · ${paymentLabel[p.paymentMethod]||p.paymentMethod}</div>
    
    <div class="progress-bar"><div class="progress-fill" style="width:${perc}%"></div></div><div style="font-size:11px;color:var(--text3);margin-top:4px">${perc}% pago</div></div><div style="margin-left:20px;text-align:right;flex-shrink:0"><div style="font-size:12px;font-weight:700;color:var(--red)">${restantes}x de ${formatBRL(valorParcela)}</div><div style="font-size:22px;font-weight:800;color:var(--orange2)">${formatBRL(p.value)}</div><div style="font-size:11px;color:var(--text3);margin-top:2px">#${p.id}</div></div></div>`;}).join('')}</div>`;
  }catch(e){document.getElementById('parcelasContent').innerHTML=`<div class="empty"><div class="eico">⚠️</div><p>${e.message}</p></div>`;}
}

// ─── INVESTIMENTOS ───
async function loadInvestimentos(){
  document.getElementById('invTable').innerHTML='<div class="loading"><div class="spinner"></div></div>';
  try{
    const data=await apiFetch(`/api/investimentos?page=${invPage}&size=10&sort=id`);
    invTotalPages=data.totalPages;
    renderInvSummary(data.content);
    renderInvTable(data.content);
    renderInvPagination();
  }catch(e){document.getElementById('invTable').innerHTML=`<div class="empty"><div class="eico">⚠️</div><p>${e.message}</p></div>`;}
}

function renderInvSummary(rows){
  if(!rows?.length){
    document.getElementById('invSummaryCards').innerHTML=`<div class="stat-card" style="grid-column:1/-1"><div class="empty"><div class="eico">📈</div><p>Nenhum investimento cadastrado.</p></div></div>`;
    return;
  }
  const ativos=rows.filter(r=>r.status==='ATIVO');
  const totalInicial=rows.reduce((s,r)=>s+(parseFloat(r.valorInicial)||0),0);
  const totalAtual=rows.reduce((s,r)=>s+(parseFloat(r.valorAtual)||0),0);
  const rentab=totalInicial>0?((totalAtual-totalInicial)/totalInicial*100):0;
  const lucro=totalAtual-totalInicial;

  // Projeção anual — soma dos rendimentos esperados de cada investimento com taxa
  const projecaoAnual = rows
    .filter(r => r.taxaRendimentoAnual && r.status === 'ATIVO')
    .reduce((s, r) => {
      const taxa = parseFloat(r.taxaRendimentoAnual) / 100;
      return s + (parseFloat(r.valorAtual) * taxa);
    }, 0);

  document.getElementById('invSummaryCards').innerHTML=`
    <div class="stat-card"><div class="stat-icon purple">📊</div><div class="stat-label">Total Investido</div><div class="stat-value purple">${formatBRL(totalInicial)}</div><div class="stat-sub">Valor inicial aportado</div></div>
    <div class="stat-card"><div class="stat-icon ${totalAtual>=totalInicial?'green':'red'}">💹</div><div class="stat-label">Valor Atual</div><div class="stat-value ${totalAtual>=totalInicial?'green':'red'}">${formatBRL(totalAtual)}</div><div class="stat-sub">Posição atual da carteira</div></div>
    <div class="stat-card"><div class="stat-icon ${lucro>=0?'green':'red'}">📈</div><div class="stat-label">Lucro / Prejuízo</div><div class="stat-value ${lucro>=0?'green':'red'}">${formatBRL(lucro)}</div><div class="stat-sub">${rentab>=0?'+':''}${rentab.toFixed(2)}% de rentabilidade</div></div>
    <div class="stat-card"><div class="stat-icon green">🎯</div><div class="stat-label">Projeção Anual</div><div class="stat-value green">${formatBRL(projecaoAnual)}</div><div class="stat-sub">Rendimento estimado em 12 meses</div></div>
  `;
}

function renderInvTable(rows){
  if(!rows?.length){
    document.getElementById('invTable').innerHTML=`<div class="empty"><div class="eico">📈</div><p>Nenhum investimento encontrado.</p><button class="btn btn-primary" onclick="openNewInvestimento()">+ Criar primeiro</button></div>`;
    return;
  }
  document.getElementById('invTable').innerHTML=`
    <table>
      <thead><tr>
        <th>Nome</th><th>Tipo</th><th>Instituição</th><th>Valor Inicial</th><th>Valor Atual</th><th>Rentab.</th><th>Taxa/Ano</th><th>Vencimento</th><th>Status</th><th>Ações</th>
      </tr></thead>
      <tbody>
        ${rows.map(r=>{
          const vi=parseFloat(r.valorInicial)||0, va=parseFloat(r.valorAtual)||0;
          const rentab=vi>0?((va-vi)/vi*100):0;
          const rentabColor=rentab>=0?'var(--green)':'var(--red)';
          return`<tr>
            <td><span style="font-weight:600">${r.nome}</span></td>
            <td><span style="color:var(--text2)">${invTipoIcon[r.tipo]||'📦'} ${invTipoLabel[r.tipo]||r.tipo}</span></td>
            <td><span style="color:var(--text3)">${r.instituicao||'—'}</span></td>
            <td style="font-weight:600">${formatBRL(r.valorInicial)}</td>
            <td style="font-weight:700;color:${va>=vi?'var(--green)':'var(--red)'}">${formatBRL(r.valorAtual)}</td>
            <td style="font-weight:700;color:${rentabColor}">${rentab>=0?'+':''}${rentab.toFixed(2)}%</td>
            <td style="color:var(--green);font-weight:600">${r.taxaRendimentoAnual ? r.taxaRendimentoAnual+'%' : '—'}</td>
            <td style="color:var(--text3)">${formatDate(r.dataVencimento)}</td>
            <td><span class="badge ${invStatusBadge[r.status]||'badge-gray'}">${r.status}</span></td>
            <td><div style="display:flex;gap:4px">
              <button class="btn btn-ghost btn-sm btn-icon" onclick="viewInvestimento(${r.id})" title="Detalhes">👁️</button>
              <button class="btn btn-ghost btn-sm btn-icon" onclick="editInvestimento(${r.id})" title="Editar">✏️</button>
              <button class="btn btn-danger btn-sm btn-icon" onclick="deleteInvestimento(${r.id})" title="Excluir">🗑️</button>
            </div></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderInvPagination(){
  document.getElementById('invPagination').innerHTML=`<button onclick="changeInvPage(-1)" ${invPage===0?'disabled':''}>← Anterior</button><span class="page-info">Página ${invPage+1} de ${invTotalPages||1}</span><button onclick="changeInvPage(1)" ${invPage>=invTotalPages-1?'disabled':''}>Próxima →</button>`;
}
function changeInvPage(d){invPage=Math.max(0,Math.min(invTotalPages-1,invPage+d));loadInvestimentos();}

function openNewInvestimento(){
  document.getElementById('invModalTitle').textContent='Novo Investimento';
  document.getElementById('invId').value='';
  ['invNome','invInstituicao','invValorInicial','invValorAtual','invTaxa'].forEach(id=>document.getElementById(id).value='');
  ['invDataInicio','invDataVencimento'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('invDataInicio').value=new Date().toISOString().split('T')[0];
  document.getElementById('invTipo').value='TESOURO_DIRETO';
  document.getElementById('invStatus').value='ATIVO';
  openModal('modalInvestimento');
}

async function editInvestimento(id){
  try{
    const r=await apiFetch('/api/investimentos/'+id);
    document.getElementById('invModalTitle').textContent='Editar Investimento';
    document.getElementById('invId').value=r.id;
    document.getElementById('invNome').value=r.nome||'';
    document.getElementById('invTipo').value=r.tipo||'OUTROS';
    document.getElementById('invInstituicao').value=r.instituicao||'';
    document.getElementById('invValorInicial').value=r.valorInicial||'';
    document.getElementById('invValorAtual').value=r.valorAtual||'';
    document.getElementById('invDataInicio').value=r.dataInicio||'';
    document.getElementById('invDataVencimento').value=r.dataVencimento||'';
    document.getElementById('invStatus').value=r.status||'ATIVO';
    document.getElementById('invTaxa').value=r.taxaRendimentoAnual||''; // ← novo
    openModal('modalInvestimento');
  }catch(e){toast('Erro: '+e.message,'error');}
}

async function saveInvestimento(){
  const id=document.getElementById('invId').value;
  const body={
    nome:document.getElementById('invNome').value,
    tipo:document.getElementById('invTipo').value,
    instituicao:document.getElementById('invInstituicao').value||null,
    valorInicial:parseFloat(document.getElementById('invValorInicial').value)||null,
    valorAtual:parseFloat(document.getElementById('invValorAtual').value)||parseFloat(document.getElementById('invValorInicial').value)||null,
    dataInicio:document.getElementById('invDataInicio').value||null,
    dataVencimento:document.getElementById('invDataVencimento').value||null,
    status:document.getElementById('invStatus').value,
    taxaRendimentoAnual:parseFloat(document.getElementById('invTaxa').value)||null, // ← novo
  };
  if(!body.nome||!body.valorInicial||!body.instituicao||!body.dataInicio){toast('Preencha nome, instituição, data início e valor inicial.','error');return;}
  try{
    if(id){await apiFetch('/api/investimentos/'+id,{method:'PATCH',body:JSON.stringify(body)});toast('Investimento atualizado!','success');}
    else{await apiFetch('/api/investimentos',{method:'POST',body:JSON.stringify(body)});toast('Investimento criado!','success');}
    closeModal('modalInvestimento');loadInvestimentos();
  }catch(e){toast('Erro: '+formatApiError(e),'error');}
}

async function deleteInvestimento(id){
  if(!confirm('Excluir este investimento?'))return;
  try{await apiFetch('/api/investimentos/'+id,{method:'DELETE'});toast('Investimento excluído!','success');loadInvestimentos();}
  catch(e){toast('Erro: '+e.message,'error');}
}

async function viewInvestimento(id){
  try{
    const r=await apiFetch('/api/investimentos/'+id);
    const vi=parseFloat(r.valorInicial)||0, va=parseFloat(r.valorAtual)||0;
    const lucro=va-vi, rentab=vi>0?((lucro/vi)*100):0;

    // Calcula rendimento diário estimado se tiver taxa
    const rendDiario = r.taxaRendimentoAnual
      ? va * (Math.pow(1 + parseFloat(r.taxaRendimentoAnual)/100, 1/252) - 1)
      : null;

    document.getElementById('invDetalheBody').innerHTML=`
      <div class="detail-row"><span class="detail-label">ID</span><span class="detail-value" style="color:var(--text3)">#${r.id}</span></div>
      <div class="detail-row"><span class="detail-label">Nome</span><span class="detail-value">${r.nome}</span></div>
      <div class="detail-row"><span class="detail-label">Tipo</span><span class="detail-value">${invTipoIcon[r.tipo]||''} ${invTipoLabel[r.tipo]||r.tipo}</span></div>
      <div class="detail-row"><span class="detail-label">Instituição</span><span class="detail-value">${r.instituicao||'—'}</span></div>
      <div class="detail-row"><span class="detail-label">Valor Inicial</span><span class="detail-value">${formatBRL(r.valorInicial)}</span></div>
      <div class="detail-row"><span class="detail-label">Valor Atual</span><span class="detail-value" style="font-size:18px;font-weight:800;color:${va>=vi?'var(--green)':'var(--red)'}">${formatBRL(r.valorAtual)}</span></div>
      <div class="detail-row"><span class="detail-label">Lucro / Prejuízo</span><span class="detail-value" style="font-weight:700;color:${lucro>=0?'var(--green)':'var(--red)'}">${formatBRL(lucro)} (${rentab>=0?'+':''}${rentab.toFixed(2)}%)</span></div>

      ${r.taxaRendimentoAnual ? `
        <div class="detail-row">
          <span class="detail-label">Taxa Anual</span>
          <span class="detail-value" style="color:var(--green);font-weight:700">📈 ${r.taxaRendimentoAnual}% ao ano</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Rendimento Diário Est.</span>
          <span class="detail-value" style="color:var(--green)">≈ ${formatBRL(rendDiario)} / dia útil</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Projeção 12 meses</span>
          <span class="detail-value" style="color:var(--green);font-weight:700">≈ ${formatBRL(va * parseFloat(r.taxaRendimentoAnual) / 100)}</span>
        </div>
      ` : ''}

      ${r.ultimoRendimentoCalculado ? `
        <div class="detail-row">
          <span class="detail-label">Último Rendimento</span>
          <span class="detail-value" style="color:var(--text3)">🤖 ${r.ultimoRendimentoCalculado?.replace('T',' ').substring(0,16)}</span>
        </div>
      ` : ''}

      <div class="detail-row"><span class="detail-label">Data Início</span><span class="detail-value">${formatDate(r.dataInicio)}</span></div>
      <div class="detail-row"><span class="detail-label">Vencimento</span><span class="detail-value">${formatDate(r.dataVencimento)}</span></div>
      <div class="detail-row"><span class="detail-label">Status</span><span class="badge ${invStatusBadge[r.status]||'badge-gray'}">${r.status}</span></div>

      <div style="margin-top:18px">
        <div class="stat-label" style="margin-bottom:10px">💵 Aportes</div>
        <div id="aportesList"><div class="loading"><div class="spinner"></div></div></div>
        <div style="display:flex;gap:8px;margin-top:12px;align-items:flex-end">
          <div class="form-group" style="flex:1;margin:0"><label>Valor (R$)</label><input type="number" id="aporteValor" step="0.01" placeholder="0,00"></div>
          <div class="form-group" style="flex:1;margin:0"><label>Data</label><input type="date" id="aporteData" value="${new Date().toISOString().split('T')[0]}"></div>
          <button class="btn btn-primary btn-sm" id="btnRegistrarAporte" onclick="registrarAporteHandler(${r.id})">+ Aporte</button>
        </div>
      </div>

      <div class="detail-row" style="border:none"><span class="detail-label">Criado em</span><span class="detail-value" style="color:var(--text3)">${r.criadoEm?.replace('T',' ').substring(0,16)||'—'}</span></div>

      <div style="margin-top:18px">
        <div class="stat-label" style="margin-bottom:10px">Alterar Status</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${['ATIVO','ENCERRADO','VENCIDO','RESGATADO'].map(s=>`<button class="btn btn-ghost btn-sm" onclick="changeInvStatus(${r.id},'${s}')" style="${r.status===s?'border-color:var(--orange);color:var(--orange)':''}">${s}</button>`).join('')}
        </div>
      </div>
    `;
    document.getElementById('invDetalheFooter').innerHTML=`<button class="btn btn-ghost" onclick="closeModal('modalInvDetalhe')">Fechar</button><button class="btn btn-primary" onclick="closeModal('modalInvDetalhe');editInvestimento(${r.id})">✏️ Editar</button>`;

    openModal('modalInvDetalhe');
    loadAportesInModal(r.id);
  }catch(e){toast('Erro: '+e.message,'error');}
}

// ─── APORTES ───
async function loadAportesInModal(investimentoId){
  const container = document.getElementById('aportesList');
  if(!container) return;
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try{
    const aportes = await apiFetch(`/api/investimentos/${investimentoId}/aportes`);
    renderAportesList(aportes, investimentoId);
  }catch(e){
    container.innerHTML = `<div style="color:var(--text3);font-size:13px;padding:8px 0">⚠️ ${formatApiError(e)}</div>`;
  }
}

function renderAportesList(aportes, investimentoId){
  const container = document.getElementById('aportesList');
  if(!aportes?.length){
    container.innerHTML = `<div style="color:var(--text3);font-size:13px;padding:8px 0">Nenhum aporte registrado ainda.</div>`;
    return;
  }

  // Calcula total dos aportes
  const total = aportes.reduce((s,a) => s + parseFloat(a.valor||0), 0);

  container.innerHTML = `
    <div style="margin-bottom:10px;padding:10px 12px;background:var(--surface2);border-radius:var(--radius-sm);display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:12px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.5px">${aportes.length} aporte${aportes.length>1?'s':''}</span>
      <span style="font-weight:700;color:var(--green)">${formatBRL(total)} total</span>
    </div>
    ${aportes.map(a => `
      <div class="detail-row">
        <span style="display:flex;flex-direction:column">
          <span style="font-weight:700;color:var(--green)">${formatBRL(a.valor)}</span>
          <span style="font-size:11px;color:var(--text3)">${formatDate(a.data)}</span>
        </span>
        <button class="btn btn-danger btn-sm btn-icon" onclick="deletarAporteHandler(${a.id}, ${investimentoId})" title="Excluir aporte">🗑️</button>
      </div>
    `).join('')}
  `;
}

async function registrarAporteHandler(investimentoId){
  const valor = parseFloat(document.getElementById('aporteValor').value);
  const data = document.getElementById('aporteData').value;
  if(!valor || valor<=0 || !data){ toast('Preencha valor e data do aporte.','error'); return; }

  const btn = document.getElementById('btnRegistrarAporte');
  btn.disabled = true; btn.textContent = 'Salvando...';
  try{
    await apiFetch(`/api/investimentos/${investimentoId}/aportes`, {
      method: 'POST',
      body: JSON.stringify({ valor, data })
    });
    toast('Aporte registrado!','success');
    viewInvestimento(investimentoId);
    loadInvestimentos();
  }catch(e){
    toast('Erro: '+formatApiError(e),'error');
  }finally{
    btn.disabled = false; btn.textContent = '+ Aporte';
  }
}

async function deletarAporteHandler(aporteId, investimentoId){
  if(!confirm('Excluir este aporte?')) return;
  try{
    await apiFetch('/api/investimentos/aportes/'+aporteId, {method:'DELETE'});
    toast('Aporte excluído!','success');
    viewInvestimento(investimentoId);
    loadInvestimentos();
  }catch(e){
    toast('Erro: '+formatApiError(e),'error');
  }
}

async function changeInvStatus(id, status){
  try{
    await apiFetch(`/api/investimentos/status-investimento/${id}?statusInvestimento=${status}`,{method:'PATCH'});
    toast('Status atualizado!','success');
    closeModal('modalInvDetalhe');
    loadInvestimentos();
  }catch(e){toast('Erro: '+e.message,'error');}
}

// ─── RELATÓRIOS ───
async function loadRelatorios(){
  try{
    const data=await apiFetch('/api/despesas/relatorios/gastos-por-mes'); destroyChart('relatorio'); if(!data?.length)return;
    charts['relatorio']=new Chart(document.getElementById('chartRelatorio').getContext('2d'),{type:'line',data:{labels:data.map(d=>`${monthNames[d.mes-1]}/${d.ano}`),datasets:[{label:'Gastos (R$)',data:data.map(d=>d.total),borderColor:C[0],backgroundColor:'rgba(255,107,0,.1)',borderWidth:2,pointBackgroundColor:C[0],pointBorderColor:'#141418',pointBorderWidth:2,pointRadius:5,fill:true,tension:.4}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{grid:{color:'rgba(42,42,53,.5)'},ticks:{callback:v=>'R$ '+v.toLocaleString('pt-BR')}},x:{grid:{display:false}}}}});
  }catch(e){toast('Erro: '+e.message,'error');}
}

// ─── TOP 5 ───
async function loadTop5(){
  const mes=+document.getElementById('top5Mes').value, ano=+document.getElementById('top5Ano').value;
  try{
    const[top5g,top5c]=await Promise.all([apiFetch(`/api/despesas/top-5-gastos?mes=${mes}&ano=${ano}`),apiFetch(`/api/despesas/top-5-categorias?mes=${mes}&ano=${ano}`)]);
    destroyChart('top5gp');destroyChart('top5cp');
    if(top5g?.length){charts['top5gp']=new Chart(document.getElementById('chartTop5GastosPage').getContext('2d'),{type:'bar',data:{labels:top5g.map(r=>r.descricao?.length>22?r.descricao.substring(0,22)+'…':r.descricao),datasets:[{data:top5g.map(r=>r.total),backgroundColor:C,borderRadius:6}]},options:{indexAxis:'y',responsive:true,plugins:{legend:{display:false}},scales:{x:{grid:{color:'rgba(42,42,53,.5)'},ticks:{callback:v=>'R$'+v.toLocaleString('pt-BR')}},y:{grid:{display:false}}}}});document.getElementById('top5GastosList').innerHTML=`<div class="stat-label" style="margin-bottom:14px">🏆 Maiores Gastos</div>${top5g.map((r,i)=>`<div class="detail-row"><span style="color:var(--text2)">${['🥇','🥈','🥉','4️⃣','5️⃣'][i]} ${r.descricao}</span><span style="color:var(--red);font-weight:700">${formatBRL(r.total)}</span></div>`).join('')}`;}
    if(top5c?.length){charts['top5cp']=new Chart(document.getElementById('chartTop5CatPage').getContext('2d'),{type:'doughnut',data:{labels:top5c.map(r=>categoryLabel[r.categoria]||r.categoria),datasets:[{data:top5c.map(r=>r.total),backgroundColor:C,borderColor:'#141418',borderWidth:3}]},options:{responsive:true,cutout:'55%',plugins:{legend:{position:'bottom',labels:{boxWidth:10,padding:12}}}}});document.getElementById('top5CatList').innerHTML=`<div class="stat-label" style="margin-bottom:14px">🗂️ Por Categoria</div>${top5c.map((r,i)=>`<div class="detail-row"><span style="color:var(--text2)">${['🥇','🥈','🥉','4️⃣','5️⃣'][i]} ${catIcon[r.categoria]||''} ${categoryLabel[r.categoria]||r.categoria}</span><span style="color:var(--orange2);font-weight:700">${formatBRL(r.total)}</span></div>`).join('')}`;}
  }catch(e){toast('Erro: '+e.message,'error');}
}

// ─── CATEGORIAS ───
async function loadCategorias(){
  const mes=+document.getElementById('catMes').value, ano=+document.getElementById('catAno').value;
  try{
    const data=await apiFetch(`/api/despesas/resumo/por-categoria?mes=${mes}&ano=${ano}`); destroyChart('catp');
    if(!data?.length){document.getElementById('catList').innerHTML='<div class="empty"><div class="eico">📊</div><p>Sem dados para este período.</p></div>';return;}
    charts['catp']=new Chart(document.getElementById('chartCatPage').getContext('2d'),{type:'bar',data:{labels:data.map(c=>`${catIcon[c.category]||''} ${categoryLabel[c.category]||c.category}`),datasets:[{data:data.map(c=>c.total),backgroundColor:C,borderRadius:8}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{grid:{color:'rgba(42,42,53,.5)'},ticks:{callback:v=>'R$'+v.toLocaleString('pt-BR')}},x:{grid:{display:false}}}}});
    const total=data.reduce((s,c)=>s+(+c.total),0);
    document.getElementById('catList').innerHTML=`<div class="stat-label" style="margin-bottom:16px">Distribuição</div>${data.map((c,i)=>{const pct=total?Math.round((c.total/total)*100):0;return`<div style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13.5px"><span style="color:var(--text2)">${catIcon[c.category]||''} ${categoryLabel[c.category]||c.category}</span><span style="font-weight:700">${formatBRL(c.total)} <span style="color:var(--text3);font-size:11px">${pct}%</span></span></div><div class="progress-bar" style="height:7px"><div class="progress-fill" style="width:${pct}%;background:${C[i%C.length]}"></div></div></div>`;}).join('')}`;
  }catch(e){toast('Erro: '+e.message,'error');}
}

// ─── COMPARATIVO ───
async function loadComparativo(){
  const mesA=+document.getElementById('cmpMesA').value, anoA=+document.getElementById('cmpAnoA').value, mesB=+document.getElementById('cmpMesB').value, anoB=+document.getElementById('cmpAnoB').value;
  const el=document.getElementById('comparativoResult'); el.innerHTML='<div class="loading"><div class="spinner"></div></div>';
  try{
    const d=await apiFetch(`/api/despesas/resumo/comparativo?mesA=${mesA}&anoA=${anoA}&mesB=${mesB}&anoB=${anoB}`);
    const lA=`${monthNames[d.mesA-1]}/${d.anoA}`, lB=`${monthNames[d.mesB-1]}/${d.anoB}`;
    const varIcon=v=>v==null?'—':v>0?'▲':v<0?'▼':'●';
    const varColor=v=>v==null?'var(--text3)':v>0?'var(--red)':v<0?'var(--green)':'var(--text2)';
    const varColorRec=v=>v==null?'var(--text3)':v>0?'var(--green)':v<0?'var(--red)':'var(--text2)';
    const fmtPct=v=>v==null?'sem base':`${v>0?'+':''}${v}%`;
    const fmtDiff=v=>v==null?'—':`${v>0?'+':''}${formatBRL(v)}`;
    el.innerHTML=`
      <div class="grid-2" style="margin-bottom:20px">
        <div class="card" style="border-top:2px solid var(--orange)"><div class="stat-label" style="margin-bottom:14px;color:var(--orange)">Período A — ${lA}</div><div class="detail-row"><span class="detail-label">Receitas</span><span style="color:var(--green);font-weight:700">${formatBRL(d.totalReceitasA)}</span></div><div class="detail-row"><span class="detail-label">Despesas</span><span style="color:var(--red);font-weight:700">${formatBRL(d.totalDespesasA)}</span></div><div class="detail-row" style="border:none"><span class="detail-label">Saldo</span><span style="font-size:20px;font-weight:800;color:${d.saldoA>=0?'var(--green)':'var(--red)'}">${formatBRL(d.saldoA)}</span></div></div>
        <div class="card" style="border-top:2px solid var(--orange2)"><div class="stat-label" style="margin-bottom:14px;color:var(--orange2)">Período B — ${lB}</div><div class="detail-row"><span class="detail-label">Receitas</span><span style="color:var(--green);font-weight:700">${formatBRL(d.totalReceitasB)}</span></div><div class="detail-row"><span class="detail-label">Despesas</span><span style="color:var(--red);font-weight:700">${formatBRL(d.totalDespesasB)}</span></div><div class="detail-row" style="border:none"><span class="detail-label">Saldo</span><span style="font-size:20px;font-weight:800;color:${d.saldoB>=0?'var(--green)':'var(--red)'}">${formatBRL(d.saldoB)}</span></div></div>
      </div>
      <div class="grid-3" style="margin-bottom:20px">
        <div class="delta-card"><div class="stat-label" style="margin-bottom:8px">Δ Despesas (B − A)</div><div style="font-size:22px;font-weight:800;color:${varColor(d.diferencaDespesas)}">${fmtDiff(d.diferencaDespesas)}</div><div style="font-size:12px;margin-top:6px;color:${varColor(d.variacaoDespesasPercent)}">${varIcon(d.variacaoDespesasPercent)} ${fmtPct(d.variacaoDespesasPercent)} vs ${lA}</div></div>
        <div class="delta-card"><div class="stat-label" style="margin-bottom:8px">Δ Receitas (B − A)</div><div style="font-size:22px;font-weight:800;color:${varColorRec(d.diferencaReceitas)}">${fmtDiff(d.diferencaReceitas)}</div><div style="font-size:12px;margin-top:6px;color:${varColorRec(d.variacaoReceitasPercent)}">${varIcon(d.variacaoReceitasPercent)} ${fmtPct(d.variacaoReceitasPercent)} vs ${lA}</div></div>
        <div class="delta-card"><div class="stat-label" style="margin-bottom:8px">Δ Saldo (B − A)</div><div style="font-size:22px;font-weight:800;color:${varColorRec(d.diferencaSaldo)}">${fmtDiff(d.diferencaSaldo)}</div><div style="font-size:12px;margin-top:6px;color:var(--text3)">Variação líquida</div></div>
      </div>
      <div class="chart-card"><div class="chart-card-header"><div class="chart-card-title">Comparativo Visual — ${lA} vs ${lB}</div></div><canvas id="chartComparativo" height="200"></canvas></div>
    `;
    destroyChart('comparativo');
    charts['comparativo']=new Chart(document.getElementById('chartComparativo').getContext('2d'),{type:'bar',data:{labels:['Receitas','Despesas','Saldo'],datasets:[{label:lA,data:[d.totalReceitasA,d.totalDespesasA,d.saldoA],backgroundColor:'rgba(255,107,0,.75)',borderRadius:7},{label:lB,data:[d.totalReceitasB,d.totalDespesasB,d.saldoB],backgroundColor:'rgba(255,140,56,.55)',borderRadius:7}]},options:{responsive:true,plugins:{legend:{position:'top',labels:{boxWidth:12,padding:16}},tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${formatBRL(ctx.raw)}`}}},scales:{y:{grid:{color:'rgba(42,42,53,.5)'},ticks:{callback:v=>'R$ '+v.toLocaleString('pt-BR')}},x:{grid:{display:false}}}}});
  }catch(e){el.innerHTML=`<div class="empty"><div class="eico">⚠️</div><p>${e.message}</p></div>`;toast('Erro ao comparar: '+e.message,'error');}
}

// ─── MODAL ───
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
document.querySelectorAll('.modal-overlay').forEach(m=>{m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open');});});

// ─── INIT ───
document.addEventListener('DOMContentLoaded',()=>{
  populateMonthYear('dashMes','dashAno',loadDashboard);
  populateMonthYear('top5Mes','top5Ano',loadTop5);
  populateMonthYear('catMes','catAno',loadCategorias);
  populateMonthYear('cmpMesA','cmpAnoA',null);
  populateMonthYear('cmpMesB','cmpAnoB',null);
  const now=new Date();
  document.getElementById('cmpMesB').value=now.getMonth()===0?12:now.getMonth();
  document.getElementById('cmpAnoB').value=now.getMonth()===0?now.getFullYear()-1:now.getFullYear();
  if(loadSession()){onLoginSuccess();}
});

window.addEventListener("load", () => {
    const popup = document.getElementById("popupTeste");

    popup.classList.add("show");

    setTimeout(() => {
        popup.classList.remove("show");
    }, 5000); // some após 3 segundos
});


let taxaAnualCalculada = 0;

function abrirAjudaCDI(){
    document.getElementById("modalAjudaCDI").classList.add("open");
}

function fecharAjudaCDI(){
    document.getElementById("modalAjudaCDI").classList.remove("open");
}

function calcularCDI(){

    const cdi = parseFloat(document.getElementById("calcCDI").value);
    const percentual = parseFloat(document.getElementById("calcPercentual").value);

    if(isNaN(cdi) || isNaN(percentual)){
        alert("Informe o CDI e o percentual.");
        return;
    }

    taxaAnualCalculada = cdi * (percentual / 100);

    const taxaMensal =
        (Math.pow(1 + taxaAnualCalculada/100, 1/12) - 1) * 100;

    document.getElementById("resultadoCDI").style.display="block";

    document.getElementById("resultadoAnual").innerHTML =
        taxaAnualCalculada.toFixed(2).replace(".", ",") + "% ao ano";

    document.getElementById("resultadoMensal").innerHTML =
        taxaMensal.toFixed(2).replace(".", ",") + "% ao mês";
}

function usarValorCDI(){

    document.getElementById("invTaxa").value =
        taxaAnualCalculada.toFixed(2);

    fecharAjudaCDI();
}
