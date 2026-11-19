import React, { useEffect, useMemo, useState } from 'react';
import { LayoutDashboard, Wallet, Users, ShieldCheck, BellRing, ChartNoAxesCombined, Settings, Menu, X, Plus, Search, ArrowUpRight, ArrowDownRight, CalendarClock, Download, Send, Check, RefreshCw, ReceiptText, HandCoins, ChevronRight, AlertTriangle } from 'lucide-react';
import './styles.css';
import { makeAlerts } from './notificationRules.js';
import { NotificationCenter, NotificationPreferences } from './Notifications.jsx';
import DevicePushPanel from './DevicePushPanel.jsx';
import PushOperatorAuth from './PushOperatorAuth.jsx';
import { listenForegroundPush } from './devicePush.js';
import { onAuthStateChanged, getAuth } from 'firebase/auth';
import { firebaseApp } from './firebaseConfig.js';
import { notifyDemoAction, syncDemoDueSchedule, flushNotificationsAfterLogin } from './pushServerClient.js';

const K = 'gestion-seguros-demo-v1';
const nowDate = () => new Date().toISOString().slice(0,10);
const dayOffset = (n) => { const x = new Date(); x.setDate(x.getDate()+n); return x.toISOString().slice(0,10); };
const monthsFrom = (s,n) => { const d = new Date(s+'T12:00:00'); const day=d.getDate(); d.setDate(1); d.setMonth(d.getMonth()+n); d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate())); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); };
const fmt = (n) => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(Number(n)||0);
const dateAR = (s) => s ? new Date(s+'T12:00:00').toLocaleDateString('es-AR') : '—';
const uid = () => globalThis.crypto?.randomUUID?.() || String(Date.now())+Math.random().toString(36).slice(2);
const norm = (s) => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const diff = (s) => Math.round((new Date(s+'T12:00:00') - new Date(nowDate()+'T12:00:00'))/86400000);
const mock = () => {
  const clients = [
    {id:'c1',name:'María González',dni:'28123456',phone:'5493446123456',email:'maria@ejemplo.com',plate:'AB123CD',notes:'Ejemplo ficticio',active:true},
    {id:'c2',name:'Juan Fernández',dni:'30567890',phone:'5493446234567',email:'juan@ejemplo.com',plate:'AC456EF',notes:'',active:true},
    {id:'c3',name:'Lucía Martínez',dni:'33123456',phone:'5493446345678',email:'lucia@ejemplo.com',plate:'AE789GH',notes:'',active:true}
  ];
  const policies=[
    {id:'p1',clientId:'c1',number:'AUT-2026-00182',company:'Sancor Seguros',branch:'Automotor',asset:'Toyota Corolla',plate:'AB123CD',start:dayOffset(-30),end:dayOffset(335),firstDue:dayOffset(-15),count:12,amount:48200,mode:'office'},
    {id:'p2',clientId:'c2',number:'AUT-2026-00864',company:'Federación Patronal',branch:'Automotor',asset:'Volkswagen Amarok',plate:'AC456EF',start:dayOffset(-10),end:dayOffset(355),firstDue:dayOffset(2),count:12,amount:69500,mode:'direct'},
    {id:'p3',clientId:'c3',number:'HOG-2026-00415',company:'La Segunda',branch:'Hogar',asset:'Vivienda',plate:'',start:dayOffset(-4),end:dayOffset(361),firstDue:dayOffset(5),count:6,amount:25900,mode:'office'}
  ];
  return {clients,policies,installments:policies.flatMap(p=>Array.from({length:p.count},(_,i)=>({id:uid(),policyId:p.id,number:i+1,due:monthsFrom(p.firstDue,i),amount:p.amount,status:'pending',paidAt:'',remittedAt:''}))),movements:[],closings:[],contacts:[],settings:{agency:'Mi agencia de seguros',reminderDays:3}};
};
function load(){try{const raw=localStorage.getItem(K);return raw?JSON.parse(raw):mock()}catch{return mock()}}
const nav=[['home','Inicio',LayoutDashboard],['cash','Caja diaria',Wallet],['clients','Clientes',Users],['policies','Pólizas y cuotas',ShieldCheck],['due','Vencimientos',BellRing],['alerts','Notificaciones',BellRing],['reports','Reportes',ChartNoAxesCombined],['settings','Configuración',Settings]];
const modeName={office:'Oficina · rinde a compañía',direct:'Pago directo a aseguradora'};
function exportCSV(name,rows){const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');const b=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function Modal({title,onClose,children}){return <div className="veil" onMouseDown={(e)=>{if(e.target===e.currentTarget)onClose()}}><div className="modal"><header className="modal-head"><h2>{title}</h2><button type="button" className="iconbtn" aria-label="Cerrar" onClick={onClose}><X size={20}/></button></header>{children}</div></div>}
function Empty({text}){return <div className="empty"><Search size={26}/><p>{text||'No se encontraron registros con esos filtros.'}</p></div>}
function Tag({children,tone='neutral'}){return <span className={'tag '+tone}>{children}</span>}
function Action({children,onClick,secondary=false,disabled=false}){return <button disabled={disabled} className={'btn '+(secondary?'btn-outline':'')} type="button" onClick={onClick}>{children}</button>}
const opts = (list) => list.map(x=><option key={x.id} value={x.id}>{x.name}</option>);
function NumberCard({label,value,icon:Icon,hint}){return <article className="numbercard"><div className="numbertop"><span>{label}</span><Icon size={19}/></div><strong>{value}</strong><small>{hint}</small></article>}
export default function App(){
  const [data,setData]=useState(load);
  const [pushUid,setPushUid]=useState('');
  const [tab,setTab]=useState(() => new URLSearchParams(window.location.search).get('section') === 'alerts' ? 'alerts' : 'home');
  const [navOpen,setNavOpen]=useState(false);
  const [modal,setModal]=useState('');
  const [search,setSearch]=useState('');
  const [month,setMonth]=useState(nowDate().slice(0,7));
  const [cashPeriod,setCashPeriod]=useState('month');
  const [cashType,setCashType]=useState('all');
  const [cashMethod,setCashMethod]=useState('all');
  const [duePeriod,setDuePeriod]=useState('7');
  const [form,setForm]=useState({});
  const [pay,setPay]=useState(null);
  const [cashCount,setCashCount]=useState('');
  const [message,setMessage]=useState('');
  useEffect(()=>{localStorage.setItem(K,JSON.stringify(data))},[data]);
  useEffect(() => onAuthStateChanged(getAuth(firebaseApp), user => {
    const authorized = user && !user.isAnonymous && user.email;
    setPushUid(authorized ? user.uid : '');
    if (authorized) flushNotificationsAfterLogin();
  }), []);
  useEffect(() => {
    if (!pushUid) return undefined;
    const task = setTimeout(() => {
      syncDemoDueSchedule(data).catch(error => {
        console.warn('Gestión Seguros: no se pudo sincronizar la agenda de ejemplo:', error?.message || error);
      });
    }, 1400);
    return () => clearTimeout(task);
  }, [pushUid, data.installments, data.policies, data.settings.reminderDays]);
  useEffect(()=>{if(!message)return;const id=setTimeout(()=>setMessage(''),7000);return()=>clearTimeout(id)},[message]);
  // La recepción de FCM debe permanecer activa en toda la aplicación, no solo
  // mientras Configuración esté abierta. En primer plano se informa por toast.
  // Las notificaciones nativas en segundo plano pertenecen al service worker.
  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};
    listenForegroundPush(payload => {
      const title = String(payload?.notification?.title || payload?.data?.title || 'Nueva notificación').slice(0, 90);
      const body = String(payload?.notification?.body || payload?.data?.body || 'Abrí Notificaciones para consultar el detalle.').slice(0, 150);
      setMessage(title + ' · ' + body);
    }).then(off => {
      if (cancelled) off();
      else unsubscribe = off;
    }).catch(err => {
      console.warn('[Gestión Seguros] No se pudo iniciar el receptor FCM en primer plano:', err?.code || err?.message);
    });
    return () => { cancelled = true; unsubscribe(); };
  }, []);
  const update=(key,value)=>setForm(prev=>({...prev,[key]:value}));
  const clientById=(id)=>data.clients.find(c=>c.id===id);
  const policyById=(id)=>data.policies.find(p=>p.id===id);
  const movementTotal=(type,method,arr=data.movements)=>arr.filter(m=>(!type||m.type===type)&&(!method||m.method===method)).reduce((acc,m)=>acc+Number(m.amount),0);
  const cashBal=movementTotal('income','cash')-movementTotal('expense','cash');
  const bankBal=movementTotal('income','transfer')-movementTotal('expense','transfer');
  const perMonth=data.movements.filter(m=>m.date?.startsWith(month));
  const income=movementTotal('income',null,perMonth);
  const expense=movementTotal('expense',null,perMonth);
  const pending=data.installments.filter(i=>i.status==='pending');
  const approaching=pending.filter(i=>diff(i.due)<=7).sort((a,b)=>a.due.localeCompare(b.due));
  const officeUnremitted=data.installments.filter(i=>i.status==='paid'&&!i.remittedAt&&policyById(i.policyId)?.mode==='office');
  const toRemit=officeUnremitted.reduce((s,i)=>s+Number(i.amount),0);
  const filteredCash=useMemo(()=>data.movements.filter(m=>{
    if(cashPeriod==='today'&&m.date!==nowDate())return false;
    if(cashPeriod==='month'&&!m.date.startsWith(month))return false;
    if(cashType!=='all'&&m.type!==cashType)return false;
    if(cashMethod!=='all'&&m.method!==cashMethod)return false;
    const client=data.clients.find(c=>c.id===m.clientId);
    const pol=data.policies.find(p=>p.id===m.policyId);
    return norm([m.description,m.category,m.receiptNo,m.reference,client?.name,client?.dni,client?.plate,pol?.number,pol?.plate].join(' ')).includes(norm(search));
  }).sort((a,b)=>b.date.localeCompare(a.date)),[data,search,cashPeriod,month,cashType,cashMethod]);
  const filteredClients=data.clients.filter(c=>norm([c.name,c.dni,c.phone,c.plate,...data.policies.filter(p=>p.clientId===c.id).map(p=>p.plate)].join(' ')).includes(norm(search)));
  const filteredPolicies=data.policies.filter(p=>norm([p.number,p.company,p.branch,p.plate,p.asset,clientById(p.clientId)?.name,clientById(p.clientId)?.dni].join(' ')).includes(norm(search)));
  const filteredDues=pending.filter(i=>{
    const days=diff(i.due);
    if(duePeriod==='late'&&days>=0)return false;
    if(duePeriod==='today'&&days!==0)return false;
    if(duePeriod==='7'&&(days<0||days>7))return false;
    if(duePeriod==='30'&&(days<0||days>30))return false;
    const p=policyById(i.policyId),c=clientById(p?.clientId);
    return norm([c?.name,c?.dni,c?.plate,p?.plate,p?.number].join(' ')).includes(norm(search));
  }).sort((a,b)=>a.due.localeCompare(b.due));
  const open=(name,init={})=>{setForm(init);setModal(name)};
  const close=()=>{setModal('');setPay(null)};
  const notify=(v)=>setMessage(v);
  function submitClient(e){
    e.preventDefault();if(!String(form.name||'').trim()){notify('Ingresá el nombre del cliente.');return}
    const c={id:form.id||uid(),name:form.name.trim(),dni:String(form.dni||'').replace(/\D/g,''),phone:form.phone||'',email:form.email||'',plate:String(form.plate||'').toUpperCase().replace(/[^A-Z0-9]/g,''),notes:form.notes||'',active:true};
    setData(d=>({...d,clients:form.id?d.clients.map(x=>x.id===form.id?c:x):[c,...d.clients]}));if(!form.id)notifyDemoAction('client_created',c.id);close();notify('Cliente guardado.');
  }
  function submitPolicy(e){
    e.preventDefault();
    if(!form.clientId||!form.number||!form.company||!form.firstDue||Number(form.amount)<=0){notify('Completá los datos obligatorios.');return}
    if(data.policies.some(p=>p.number.toLowerCase()===form.number.trim().toLowerCase())){notify('Ya existe esa póliza.');return}
    const count=Math.max(1,Math.min(60,Number(form.count)||1));
    const policy={id:uid(),clientId:form.clientId,number:form.number.trim(),company:form.company.trim(),branch:form.branch||'Automotor',asset:form.asset||'',plate:String(form.plate||'').toUpperCase().replace(/[^A-Z0-9]/g,''),start:form.start||nowDate(),end:form.end||'',firstDue:form.firstDue,count,amount:Number(form.amount),mode:form.mode||'office'};
    const installments=Array.from({length:count},(_,idx)=>({id:uid(),policyId:policy.id,number:idx+1,due:monthsFrom(policy.firstDue,idx),amount:policy.amount,status:'pending',paidAt:'',remittedAt:''}));
    setData(d=>({...d,policies:[policy,...d.policies],installments:[...installments,...d.installments]}));notifyDemoAction('policy_created',policy.id);close();notify('Póliza y plan de cuotas creados.');
  }
  function submitMovement(e){
    e.preventDefault();if(Number(form.amount)<=0){notify('El importe debe ser mayor que cero.');return}
    const m={id:uid(),date:form.date||nowDate(),type:form.type||'income',method:form.method||'cash',category:form.category||'Otros',amount:Number(form.amount),description:form.description||'',clientId:form.clientId||'',policyId:form.policyId||'',receiptType:form.receiptType||'',receiptNo:form.receiptNo||'',receiptFile:form.receiptFile||'',reference:form.reference||'',createdAt:new Date().toISOString(),status:form.method==='transfer'?'informado':'confirmado'};
    setData(d=>({...d,movements:[m,...d.movements]}));notifyDemoAction(m.type==='income'?'cash_income':'cash_expense',m.id);close();notify('Movimiento registrado en caja.');
  }
  function submitPayment(e){
    e.preventDefault();const i=pay?.installment;if(!i||i.status!=='pending')return;
    const p=policyById(i.policyId),office=p?.mode==='office',reported=!office&&form.paymentStatus==='reported';
    const item={...i,status:reported?'reported':'paid',paidAt:nowDate(),paymentMethod:form.method||'transfer',reference:form.reference||''};
    const movement=office?{id:uid(),date:form.date||nowDate(),type:'income',method:form.method||'cash',category:'Cobranza de póliza',amount:Number(i.amount),description:'Cuota '+i.number+' · '+p.number,clientId:p.clientId,policyId:p.id,installmentId:i.id,receiptType:form.receiptType||'Recibo',receiptNo:form.receiptNo||'',reference:form.reference||'',createdAt:new Date().toISOString(),status:form.method==='transfer'?'informado':'confirmado'}:null;
    setData(d=>({...d,installments:d.installments.map(x=>x.id===i.id?item:x),movements:movement?[movement,...d.movements]:d.movements}));notifyDemoAction(reported?'payment_reported':'payment_paid',i.id);close();notify(office?'Cobranza registrada en caja y pendiente de rendir.':reported?'Pago informado, pendiente de confirmar.':'Pago directo confirmado sin mover caja.');
  }
  function confirmReported(i){setData(d=>({...d,installments:d.installments.map(x=>x.id===i.id?{...x,status:'paid',paidAt:nowDate()}:x)}));notifyDemoAction('payment_confirmed',i.id);notify('Pago directo confirmado.')}
  function remit(i){const p=policyById(i.policyId);if(!p||i.remittedAt)return;const m={id:uid(),date:nowDate(),type:'expense',method:i.paymentMethod||'cash',category:'Rendición a aseguradora',amount:Number(i.amount),description:'Rendición cuota '+i.number+' · '+p.number,clientId:p.clientId,policyId:p.id,installmentId:i.id,receiptNo:'',receiptType:'',reference:'',createdAt:new Date().toISOString(),status:'confirmado'};setData(d=>({...d,installments:d.installments.map(x=>x.id===i.id?{...x,remittedAt:nowDate()}:x),movements:[m,...d.movements]}));notifyDemoAction('payment_remitted',m.id);notify('Rendición asentada en caja.')}
  function contact(i){const p=policyById(i.policyId),c=clientById(p?.clientId);if(!c?.phone){notify('Este cliente no tiene WhatsApp registrado.');return}let phone=String(c.phone).replace(/\D/g,'');if(/^\d{10}$/.test(phone))phone='549'+phone;if(/^54\d{10}$/.test(phone))phone='549'+phone.slice(2);if(!/^\d{11,15}$/.test(phone)){notify('Revisá el número de WhatsApp del cliente.');return}const text='Hola '+c.name.split(' ')[0]+', te escribimos de '+data.settings.agency+' para recordarte que la cuota '+i.number+' de tu póliza '+p.number+' vence el '+dateAR(i.due)+'. Cualquier consulta estamos a disposición. ¡Gracias!';const url='https://wa.me/'+phone+'?text='+encodeURIComponent(text);window.open(url,'_blank','noopener,noreferrer');setData(d=>({...d,contacts:[{id:uid(),installmentId:i.id,clientId:c.id,date:new Date().toISOString(),status:'chat abierto; envío sin verificar'},...d.contacts]}));notify('WhatsApp preparado. Confirmá el envío desde el chat.')}
  function submitClosing(e){e.preventDefault();if(data.closings.some(c=>c.date===nowDate())){notify('El cierre de hoy ya existe.');return}const closing={id:uid(),date:nowDate(),theoretical:cashBal,counted:Number(cashCount),difference:Number(cashCount)-cashBal,createdAt:new Date().toISOString()};setData(d=>({...d,closings:[closing,...d.closings]}));notifyDemoAction('cash_closed',closing.id);close();setCashCount('');notify('Cierre diario registrado.')}
  const selectSection=(id)=>{setTab(id);setSearch('');setNavOpen(false)};
  const alerts = useMemo(() => makeAlerts(data), [data]);
  const unreadAlerts = alerts.filter(alert => !(data.seenAlerts || []).includes(alert.id));
  const viewAlert = (alert) => {
    if (alert.action === 'due') {
      selectSection('due');
      setDuePeriod('all');
      setSearch(policyById(alert.policyId)?.number || '');
    } else if (alert.action === 'policies') {
      selectSection('policies');
      setSearch(policyById(alert.policyId)?.number || '');
    } else {
      selectSection('cash');
      setCashPeriod('all');
    }
    setData(d => ({...d, seenAlerts: [...new Set([...(d.seenAlerts || []), alert.id])]}));
  };
  const dueRows=data.installments.filter(i=>i.status==='pending').sort((a,b)=>a.due.localeCompare(b.due)).slice(0,5);
  return <div className="shell">
    <aside className={'sidebar '+(navOpen?'visible':'')}>
      <div className="brand"><div className="brandmark"><ShieldCheck size={23}/></div><div><b>GESTIÓN<span>SEGUROS</span></b><small>Panel de administración</small></div></div>
      <p className="navlabel">MENÚ PRINCIPAL</p>
      <nav>{nav.map(([key,label,Icon])=><button key={key} className={'navlink '+(tab===key?'selected':'')} onClick={()=>selectSection(key)}><Icon size={19}/><span>{label}</span>{tab===key&&<ChevronRight className="navchevron" size={16}/>}</button>)}</nav>
      <div className="sidebarfoot"><Tag tone="warning">MODO DEMO</Tag><small>Los datos se guardan solo en este navegador. No cargar información real.</small></div>
    </aside>
    {navOpen&&<div className="mobile-shade" onClick={()=>setNavOpen(false)}/>}
    <main className="main">
      <header className="topbar"><div className="top-left"><button className="iconbtn menu-toggle" onClick={()=>setNavOpen(true)}><Menu size={22}/></button><div><small>Panel de gestión</small><h1>{nav.find(x=>x[0]===tab)?.[1]}</h1></div></div><div className="top-right"><button type="button" className="iconbtn notification-top-button" title="Ver notificaciones" aria-label="Ver notificaciones" onClick={()=>selectSection("alerts")}><BellRing size={19}/>{unreadAlerts.length>0&&<span className="notification-count">{unreadAlerts.length>99?"99+":unreadAlerts.length}</span>}</button><span className="today">{new Date().toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'})}</span><div className="avatar">GS</div></div></header>
      {message&&<div role="status" className="toast"><Check size={17}/>{message}<button aria-label="Cerrar" onClick={()=>setMessage('')}><X size={15}/></button></div>}
      <section className="content">
        {tab==='home'&&<>
          <div className="hero"><div><Tag>VERSIÓN 0.3 · DEMO</Tag><h2>Buen día, ¡bienvenida!</h2><p>Controlá tus cobranzas, seguí los vencimientos y administrá tu cartera desde un solo lugar.</p><div className="heroactions"><Action onClick={()=>open('movement',{type:'income',method:'cash',date:nowDate()})}><Plus size={17}/> Nuevo movimiento</Action><Action secondary onClick={()=>open('client')}><Users size={17}/> Nuevo cliente</Action></div></div><div className="heroicon"><ShieldCheck size={90}/></div></div>
          <div className="stats"><NumberCard label="Saldo de efectivo" value={fmt(cashBal)} icon={Wallet} hint="Saldo según caja registrada"/><NumberCard label="Transferencias netas" value={fmt(bankBal)} icon={HandCoins} hint="Movimientos informados"/><NumberCard label="Cuotas próximas / vencidas" value={approaching.length} icon={CalendarClock} hint="Vencidas y próximos 7 días"/><NumberCard label="Primas por rendir" value={fmt(toRemit)} icon={ReceiptText} hint={officeUnremitted.length+' cuota(s) de oficina'}/></div>
          <div className="columns"><article className="panel"><div className="panelhead"><h3>Próximos vencimientos</h3><Action secondary onClick={()=>selectSection('due')}>Ver todos <ChevronRight size={15}/></Action></div><div className="list">{dueRows.length?dueRows.map(i=>{const p=policyById(i.policyId),c=clientById(p?.clientId);return <div className="listrow" key={i.id}><div className="roundicon"><CalendarClock size={17}/></div><div className="rowflex"><b>{c?.name}</b><small>{p?.company} · Cuota {i.number} · {dateAR(i.due)}</small></div><Tag tone={diff(i.due)<0?'danger':diff(i.due)<=3?'warning':'neutral'}>{diff(i.due)<0?'Vencida':diff(i.due)===0?'Hoy':diff(i.due)+' días'}</Tag></div>}):<Empty/>}</div></article><article className="panel"><div className="panelhead"><h3>Movimientos recientes</h3><Action secondary onClick={()=>selectSection('cash')}>Ver caja <ChevronRight size={15}/></Action></div><div className="list">{data.movements.slice(0,5).length?data.movements.slice(0,5).map(m=><div className="listrow" key={m.id}><div className={'roundicon '+(m.type==='income'?'green':'red')}>{m.type==='income'?<ArrowDownRight size={17}/>:<ArrowUpRight size={17}/>}</div><div className="rowflex"><b>{m.category}</b><small>{dateAR(m.date)} · {m.method==='cash'?'Efectivo':'Transferencia'}</small></div><strong className={m.type==='income'?'positive':'negative'}>{m.type==='income'?'+':'−'}{fmt(m.amount)}</strong></div>):<Empty text="Todavía no hay movimientos. Cargá el primero desde Caja diaria."/>}</div></article></div>
        </>}
        {tab==='cash'&&<>
          <div className="sectionbar"><div><h2>Control diario de caja</h2><p>Efectivo y transferencias, con comprobantes y trazabilidad.</p></div><div className="buttons"><Action secondary onClick={()=>{setCashCount(String(cashBal));open('closing')}}><Check size={17}/> Cierre diario</Action><Action onClick={()=>open('movement',{type:'income',method:'cash',date:nowDate()})}><Plus size={17}/> Nuevo movimiento</Action></div></div>
          <div className="stats three"><NumberCard label="Saldo efectivo" value={fmt(cashBal)} icon={Wallet} hint="Ingresos menos egresos en efectivo"/><NumberCard label="Transferencias netas" value={fmt(bankBal)} icon={HandCoins} hint="Ingresos menos egresos por transferencia"/><NumberCard label="Total disponible registrado" value={fmt(cashBal+bankBal)} icon={ChartNoAxesCombined} hint="No equivale a ganancia de la agencia"/></div>
          <article className="panel"><div className="panelhead"><h3>Historial de movimientos</h3><Action secondary onClick={()=>exportCSV('caja-'+month+'.csv',[['Fecha','Tipo','Medio','Categoría','Importe','Cliente','Comprobante','Referencia'],...filteredCash.map(m=>[m.date,m.type,m.method,m.category,m.amount,clientById(m.clientId)?.name||'',m.receiptNo,m.reference])])}><Download size={17}/> CSV</Action></div><div className="filters"><div className="seg">{[['today','Hoy'],['month','Mes'],['all','Histórico']].map(([v,l])=><button key={v} onClick={()=>setCashPeriod(v)} className={cashPeriod===v?'on':''}>{l}</button>)}</div>{cashPeriod==='month'&&<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/>}<select value={cashType} onChange={e=>setCashType(e.target.value)}><option value="all">Todos los movimientos</option><option value="income">Ingresos</option><option value="expense">Egresos</option></select><select value={cashMethod} onChange={e=>setCashMethod(e.target.value)}><option value="all">Todos los medios</option><option value="cash">Efectivo</option><option value="transfer">Transferencias</option></select><div className="searchbox"><Search size={17}/><input placeholder="Cliente, DNI, patente, recibo..." value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
          <div className="tablewrap"><table><thead><tr><th>Fecha</th><th>Detalle</th><th>Medio</th><th>Comprobante</th><th>Importe</th></tr></thead><tbody>{filteredCash.map(m=><tr key={m.id}><td>{dateAR(m.date)}</td><td><b>{m.category}</b><small>{m.description} {clientById(m.clientId)?.name||''}</small></td><td><Tag>{m.method==='cash'?'Efectivo':'Transferencia'}</Tag></td><td>{m.receiptNo||'—'}<small>{m.reference||''}</small></td><td className={m.type==='income'?'positive':'negative'}><b>{m.type==='income'?'+':'−'}{fmt(m.amount)}</b></td></tr>)}</tbody></table>{!filteredCash.length&&<Empty/>}</div></article>
          <article className="panel compact"><div className="panelhead"><h3>Cierres realizados</h3><Tag>{data.closings.length} registrados</Tag></div>{data.closings.length?<div className="tablewrap"><table><thead><tr><th>Fecha</th><th>Teórico</th><th>Contado</th><th>Diferencia</th></tr></thead><tbody>{data.closings.map(c=><tr key={c.id}><td>{dateAR(c.date)}</td><td>{fmt(c.theoretical)}</td><td>{fmt(c.counted)}</td><td className={c.difference?'negative':'positive'}>{fmt(c.difference)}</td></tr>)}</tbody></table></div>:<p className="muted">Todavía no hay cierres diarios.</p>}</article>
        </>}
        {tab==='clients'&&<><div className="sectionbar"><div><h2>Cartera de clientes</h2><p>Datos personales, vehículos, pólizas y movimientos.</p></div><Action onClick={()=>open('client')}><Plus size={17}/> Nuevo cliente</Action></div><article className="panel"><div className="filters"><div className="searchbox wide"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar nombre, apellido, DNI, teléfono o patente"/></div><Tag>{filteredClients.length} clientes</Tag></div><div className="tablewrap"><table><thead><tr><th>Cliente</th><th>DNI</th><th>WhatsApp</th><th>Patente</th><th>Pólizas</th><th></th></tr></thead><tbody>{filteredClients.map(c=><tr key={c.id}><td><b>{c.name}</b><small>{c.email}</small></td><td>{c.dni||'—'}</td><td>{c.phone||'—'}</td><td><Tag>{c.plate||'—'}</Tag></td><td>{data.policies.filter(p=>p.clientId===c.id).length}</td><td><button className="textbutton" onClick={()=>open('client',c)}>Editar</button></td></tr>)}</tbody></table>{!filteredClients.length&&<Empty/>}</div></article></>}
        {tab==='policies'&&<><div className="sectionbar"><div><h2>Pólizas y cuotas</h2><p>Administrá ambos tipos de cobranza sin mezclar la caja.</p></div><Action onClick={()=>open('policy',{start:nowDate(),firstDue:nowDate(),mode:'office',count:12,branch:'Automotor'})}><Plus size={17}/> Nueva póliza</Action></div><div className="notebox"><ShieldCheck size={20}/><span><b>Dos modalidades:</b> la cobranza en oficina suma a caja y queda pendiente de rendir. Los pagos directos a la compañía no alteran caja.</span></div><article className="panel"><div className="filters"><div className="searchbox wide"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por póliza, cliente, DNI, patente o aseguradora"/></div></div>{filteredPolicies.length?<div className="policylist">{filteredPolicies.map(p=><div className="policycard" key={p.id}><div className="policytitle"><div className="roundicon"><ShieldCheck size={20}/></div><div className="rowflex"><b>{p.company}</b><small>{p.number} · {p.branch} · {p.asset} {p.plate}</small></div><Tag tone={p.mode==='office'?'warning':'info'}>{p.mode==='office'?'Cobro oficina':'Pago directo'}</Tag></div><div className="policyinfo"><span><small>Cliente</small><b>{clientById(p.clientId)?.name}</b></span><span><small>Vigencia</small><b>{dateAR(p.start)} — {dateAR(p.end)}</b></span><span><small>Cuota</small><b>{fmt(p.amount)}</b></span></div><div className="installments">{data.installments.filter(i=>i.policyId===p.id).map(i=><div key={i.id} className="installment"><div><b>Cuota {i.number}</b><small>{dateAR(i.due)} · {fmt(i.amount)}</small></div><div className="installment-actions"><Tag tone={i.status==='paid'?'success':i.status==='reported'?'warning':diff(i.due)<0?'danger':'neutral'}>{i.status==='paid'?'Pagada':i.status==='reported'?'Informada':diff(i.due)<0?'Vencida':'Pendiente'}</Tag>{i.status==='pending'&&<button className="smallbtn" onClick={()=>{setPay({installment:i});open('payment',{method:'cash',date:nowDate(),paymentStatus:'paid'})}}>Registrar pago</button>}{i.status==='reported'&&<button className="smallbtn" onClick={()=>confirmReported(i)}>Confirmar</button>}{i.status==='paid'&&p.mode==='office'&&!i.remittedAt&&<button className="smallbtn" onClick={()=>remit(i)}>Rendir</button>}{i.remittedAt&&<Tag tone="success">Rendida</Tag>}</div></div>)}</div></div>)}</div>:<Empty/>}</article></>}
        {tab==='due'&&<><div className="sectionbar"><div><h2>Agenda de vencimientos</h2><p>Notificaciones internas y mensaje de WhatsApp preparado con un clic.</p></div><Tag tone="warning">{filteredDues.length} pendientes</Tag></div><div className="notebox"><BellRing size={20}/><span>Los vencimientos de demostración se sincronizan por fechas al iniciar sesión como operadora. La función programada de Netlify envía los recordatorios a los dispositivos autorizados.</span></div><article className="panel"><div className="filters"><div className="seg">{[['late','Vencidas'],['today','Hoy'],['7','7 días'],['30','30 días'],['all','Todas']].map(([v,l])=><button className={duePeriod===v?'on':''} key={v} onClick={()=>setDuePeriod(v)}>{l}</button>)}</div><div className="searchbox wide"><Search size={17}/><input value={search} placeholder="Cliente, patente o póliza" onChange={e=>setSearch(e.target.value)}/></div></div><div className="duelist">{filteredDues.map(i=>{const p=policyById(i.policyId),c=clientById(p?.clientId),last=data.contacts.find(x=>x.installmentId===i.id);return <div className="duerow" key={i.id}><div className="duecalendar"><b>{i.due.slice(8)}</b><small>{new Date(i.due+'T12:00:00').toLocaleDateString('es-AR',{month:'short'})}</small></div><div className="rowflex"><b>{c?.name}</b><small>{p?.company} · Cuota {i.number} · {p?.number}</small>{last&&<small>WhatsApp preparado: {new Date(last.date).toLocaleString('es-AR')} (envío sin verificar)</small>}</div><div className="dueamount"><b>{fmt(i.amount)}</b><Tag tone={diff(i.due)<0?'danger':diff(i.due)<=3?'warning':'neutral'}>{diff(i.due)<0?'Vencida':diff(i.due)===0?'Hoy':diff(i.due)+' días'}</Tag></div><button className="btn" onClick={()=>contact(i)}><Send size={16}/> Enviar WhatsApp</button></div>})}{!filteredDues.length&&<Empty/>}</div></article></>}
        {tab==='alerts'&&<NotificationCenter
          alerts={alerts}
          seen={data.seenAlerts || []}
          onSeen={(id)=>setData(d=>({...d,seenAlerts:[...new Set([...(d.seenAlerts || []),id])]}))}
          onMarkAll={()=>setData(d=>({...d,seenAlerts:[...new Set([...(d.seenAlerts || []),...alerts.map(a=>a.id)])]}))}
          onNavigate={viewAlert}
          onContact={(id)=>{const installment=data.installments.find(i=>i.id===id);if(installment)contact(installment)}}
          onSettings={()=>selectSection('settings')}
        />}
        {tab==='reports'&&<><div className="sectionbar"><div><h2>Reportes de gestión</h2><p>Cobranzas y gastos discriminados por período y medio.</p></div><label className="monthlabel">Período <input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label></div><div className="stats three"><NumberCard label="Ingresos registrados" value={fmt(income)} icon={ArrowDownRight} hint="Incluye cobro de primas y comisiones"/><NumberCard label="Egresos registrados" value={fmt(expense)} icon={ArrowUpRight} hint="Incluye rendiciones y gastos"/><NumberCard label="Variación neta del mes" value={fmt(income-expense)} icon={ChartNoAxesCombined} hint="No constituye resultado contable"/></div><article className="panel"><div className="panelhead"><h3>Detalle por categoría</h3><Action secondary onClick={()=>exportCSV('reporte-'+month+'.csv',[['Fecha','Tipo','Categoría','Medio','Importe'],...perMonth.map(m=>[m.date,m.type,m.category,m.method,m.amount])])}><Download size={16}/> Exportar CSV</Action></div><div className="tablewrap"><table><thead><tr><th>Categoría</th><th>Ingresos</th><th>Egresos</th><th>Movimientos</th></tr></thead><tbody>{[...new Set(perMonth.map(m=>m.category))].map(k=>{const ms=perMonth.filter(m=>m.category===k);return <tr key={k}><td><b>{k}</b></td><td className="positive">{fmt(movementTotal('income',null,ms))}</td><td className="negative">{fmt(movementTotal('expense',null,ms))}</td><td>{ms.length}</td></tr>})}</tbody></table>{!perMonth.length&&<Empty text="No hay movimientos en el período seleccionado."/>}</div></article></>}
        {tab==='settings'&&<><div className="sectionbar"><div><h2>Configuración</h2><p>Identidad de la agencia y preferencias de recordatorios.</p></div></div><article className="panel settingspanel"><h3>Datos generales</h3><label>Nombre de la agencia<input value={data.settings.agency} onChange={e=>setData(d=>({...d,settings:{...d.settings,agency:e.target.value}}))}/></label><label>Anticipación del recordatorio (días)<input type="number" min="0" max="30" value={data.settings.reminderDays} onChange={e=>setData(d=>({...d,settings:{...d.settings,reminderDays:Number(e.target.value)||0}}))}/></label><div className="notebox"><AlertTriangle size={19}/><span>Esta versión conserva los datos de clientes en este navegador. Las push reales utilizan cuenta autorizada, Firebase y Netlify; no cargues información real hasta migrar toda la cartera con seguridad.</span></div><Action secondary onClick={()=>{if(window.confirm('Esto eliminará todos los datos de esta demo del navegador. ¿Continuar?')){setData(mock());notify('Datos de ejemplo restaurados.')}}}><RefreshCw size={16}/> Reiniciar datos de demostración</Action></article><NotificationPreferences values={data.settings.notifications || {}} onToggle={(key,enabled)=>setData(d=>({...d,settings:{...d.settings,notifications:{...(d.settings.notifications || {}),[key]:enabled}}}))}/><PushOperatorAuth/><DevicePushPanel demoData={data}/></>}
      </section>
    </main>
    {modal==='client'&&<Modal title={form.id?'Editar cliente':'Nuevo cliente'} onClose={close}><form onSubmit={submitClient} className="formgrid"><label className="span2">Nombre y apellido *<input required value={form.name||''} onChange={e=>update('name',e.target.value)}/></label><label>DNI / CUIT<input value={form.dni||''} onChange={e=>update('dni',e.target.value)}/></label><label>WhatsApp<input value={form.phone||''} placeholder="5493446..." onChange={e=>update('phone',e.target.value)}/></label><label>Correo<input type="email" value={form.email||''} onChange={e=>update('email',e.target.value)}/></label><label>Patente<input value={form.plate||''} onChange={e=>update('plate',e.target.value)}/></label><label className="span2">Notas<textarea rows="2" value={form.notes||''} onChange={e=>update('notes',e.target.value)}/></label><div className="formactions span2"><Action secondary onClick={close}>Cancelar</Action><button className="btn" type="submit">Guardar cliente</button></div></form></Modal>}
    {modal==='policy'&&<Modal title="Nueva póliza" onClose={close}><form onSubmit={submitPolicy} className="formgrid"><label>Cliente *<select required value={form.clientId||''} onChange={e=>update('clientId',e.target.value)}><option value="">Seleccionar cliente</option>{opts(data.clients)}</select></label><label>Número de póliza *<input required value={form.number||''} onChange={e=>update('number',e.target.value)}/></label><label>Aseguradora *<input required value={form.company||''} onChange={e=>update('company',e.target.value)}/></label><label>Ramo<select value={form.branch||'Automotor'} onChange={e=>update('branch',e.target.value)}>{['Automotor','Hogar','Vida','Comercio','Accidentes personales','Otro'].map(x=><option key={x}>{x}</option>)}</select></label><label>Bien asegurado<input value={form.asset||''} onChange={e=>update('asset',e.target.value)}/></label><label>Patente<input value={form.plate||''} onChange={e=>update('plate',e.target.value)}/></label><label>Vigencia desde<input type="date" value={form.start||''} onChange={e=>update('start',e.target.value)}/></label><label>Vigencia hasta<input type="date" value={form.end||''} onChange={e=>update('end',e.target.value)}/></label><label>Primera cuota vence *<input type="date" required value={form.firstDue||''} onChange={e=>update('firstDue',e.target.value)}/></label><label>Cantidad de cuotas<input type="number" min="1" max="60" value={form.count||12} onChange={e=>update('count',e.target.value)}/></label><label>Importe de cada cuota *<input type="number" min="1" required value={form.amount||''} onChange={e=>update('amount',e.target.value)}/></label><label>Modalidad<select value={form.mode||'office'} onChange={e=>update('mode',e.target.value)}><option value="office">Cobro en oficina · rinde</option><option value="direct">Pago directo a aseguradora</option></select></label><div className="formactions span2"><Action secondary onClick={close}>Cancelar</Action><button type="submit" className="btn">Crear póliza y cuotas</button></div></form></Modal>}
    {modal==='movement'&&<Modal title="Registrar movimiento de caja" onClose={close}><form onSubmit={submitMovement} className="formgrid"><label>Fecha<input type="date" value={form.date||nowDate()} onChange={e=>update('date',e.target.value)}/></label><label>Operación<select value={form.type||'income'} onChange={e=>update('type',e.target.value)}><option value="income">Ingreso</option><option value="expense">Egreso</option></select></label><label>Importe *<input required type="number" min="1" value={form.amount||''} onChange={e=>update('amount',e.target.value)}/></label><label>Medio de pago<select value={form.method||'cash'} onChange={e=>update('method',e.target.value)}><option value="cash">Efectivo</option><option value="transfer">Transferencia</option></select></label><label>Categoría<select value={form.category||'Otros'} onChange={e=>update('category',e.target.value)}>{['Otros','Comisión','Gastos de oficina','Honorarios','Servicios','Impuestos','Rendición a aseguradora','Ajuste de caja'].map(x=><option key={x}>{x}</option>)}</select></label><label>Cliente (opcional)<select value={form.clientId||''} onChange={e=>update('clientId',e.target.value)}><option value="">Sin asociar</option>{opts(data.clients)}</select></label><label>Tipo de comprobante<input placeholder="Factura / Recibo / Ticket" value={form.receiptType||''} onChange={e=>update('receiptType',e.target.value)}/></label><label>Nº comprobante<input value={form.receiptNo||''} onChange={e=>update('receiptNo',e.target.value)}/></label><label className="span2">Referencia de transferencia<input value={form.reference||''} onChange={e=>update('reference',e.target.value)}/></label><label className="span2">Descripción<textarea rows="2" value={form.description||''} onChange={e=>update('description',e.target.value)}/></label><p className="note span2">El archivo adjunto del comprobante estará disponible cuando conectemos Firebase Storage. Para cobrar una cuota de póliza, usá el botón «Registrar pago» de esa cuota.</p><div className="formactions span2"><Action secondary onClick={close}>Cancelar</Action><button type="submit" className="btn">Registrar movimiento</button></div></form></Modal>}
    {modal==='payment'&&pay&&<Modal title={'Registrar cuota '+pay.installment.number} onClose={close}><form className="formgrid" onSubmit={submitPayment}><p className="span2 note">{policyById(pay.installment.policyId)?.company} · {fmt(pay.installment.amount)} · {modeName[policyById(pay.installment.policyId)?.mode]}</p>{policyById(pay.installment.policyId)?.mode==='direct'&&<label className="span2">Estado del pago<select value={form.paymentStatus||'paid'} onChange={e=>update('paymentStatus',e.target.value)}><option value="paid">Confirmado en aseguradora</option><option value="reported">Informado por cliente (pendiente de verificar)</option></select></label>}<label>Medio informado<select value={form.method||'cash'} onChange={e=>update('method',e.target.value)}><option value="cash">Efectivo</option><option value="transfer">Transferencia / débito</option></select></label><label>Fecha<input type="date" value={form.date||nowDate()} onChange={e=>update('date',e.target.value)}/></label><label>Comprobante<input value={form.receiptNo||''} onChange={e=>update('receiptNo',e.target.value)} placeholder="Número de recibo"/></label><label>Referencia<input value={form.reference||''} onChange={e=>update('reference',e.target.value)} placeholder="Número de operación"/></label><div className="formactions span2"><Action secondary onClick={close}>Cancelar</Action><button type="submit" className="btn">Confirmar registro</button></div></form></Modal>}
    {modal==='closing'&&<Modal title="Cierre de caja — efectivo" onClose={close}><form className="formgrid" onSubmit={submitClosing}><p className="note span2">Fecha: {dateAR(nowDate())}. El sistema registra el saldo teórico según los movimientos de efectivo cargados.</p><div className="span2 closebalance">Saldo teórico <strong>{fmt(cashBal)}</strong></div><label className="span2">Efectivo contado<input autoFocus required type="number" value={cashCount} onChange={e=>setCashCount(e.target.value)}/></label><div className="span2 closebalance">Diferencia <strong>{fmt((Number(cashCount)||0)-cashBal)}</strong></div><div className="formactions span2"><Action secondary onClick={close}>Cancelar</Action><button type="submit" className="btn">Guardar cierre</button></div></form></Modal>}
  </div>;
}
