import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ErrorBoundary from './ErrorBoundary';

const items=[
  ['/','▦','Dashboard','dashboard'],
  ['/leitos','▤','Leitos','leitos'],
  ['/internacoes','⇄','Internações','internacoes'],
  ['/pacientes','◉','Pacientes','pacientes'],
  ['/profissionais','♙','Profissionais','profissionais'],
  ['/escala','▦','Escala','escala'],
  ['/usuarios','⚙','Usuários','usuarios'],
  ['/dados','⇅','Importar / Exportar','sync'],
  ['/backups','↺','Backups','backup'],
];

export default function Layout(){
  const {user,logout,can}=useAuth();
  const location=useLocation();
  const [collapsed,setCollapsed]=useState(false);
  const [mobileOpen,setMobileOpen]=useState(false);

  const visible=items.filter(([,,,m])=>{
    if(m==='usuarios'||m==='backup') return user?.role==='ADMIN';
    return can(m,'read');
  });

  const activeClass=({isActive})=>`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap ${isActive?'bg-blue-50 text-blue-700':'text-slate-600 hover:bg-slate-100'}`;

  const nav=<>
    <div className={`text-xs uppercase tracking-wide text-slate-400 px-3 py-2 ${collapsed?'lg:hidden':''}`}>Operação</div>
    {visible.map(([to,icon,label])=><NavLink key={to} to={to} end={to==='/'} onClick={()=>setMobileOpen(false)} className={activeClass} title={label}><span className="w-5 text-center text-base">{icon}</span>{!collapsed&&<span>{label}</span>}</NavLink>)}
    <a href="/tv" target="_blank" rel="noreferrer" className="flex items-center gap-3 px-3 py-2 rounded-lg mt-3 text-sm font-semibold text-slate-600 hover:bg-slate-100" title="Modo TV"><span className="w-5 text-center">▣</span>{!collapsed&&<span>Modo TV ↗</span>}</a>
  </>;

  return <div className="min-h-screen bg-slate-50">
    <header className="h-14 bg-slate-900 text-white px-3 md:px-5 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button className="w-9 h-9 rounded-lg hover:bg-slate-800 text-xl" onClick={()=>{if(window.innerWidth<768)setMobileOpen(v=>!v);else setCollapsed(v=>!v)}} aria-label="Abrir ou recolher menu" title="Menu">☰</button>
        <div><b>Hospital PRJT</b><span className="text-slate-400 text-sm ml-3 hidden sm:inline">MVP Operacional</span></div>
      </div>
      <div className="flex gap-3 items-center text-sm"><span className="hidden sm:inline">{user?.nome}</span><button className="btn bg-slate-700 py-2" onClick={logout}>Sair</button></div>
    </header>

    {mobileOpen&&<div className="fixed inset-0 z-20 md:hidden"><button className="absolute inset-0 bg-slate-950/40" onClick={()=>setMobileOpen(false)} aria-label="Fechar menu"/><aside className="absolute top-14 left-0 bottom-0 w-72 bg-white border-r p-3 overflow-y-auto">{nav}</aside></div>}

    <div className="flex">
      <aside className={`${collapsed?'w-16':'w-60'} min-h-[calc(100vh-56px)] bg-white border-r border-slate-200 p-2 hidden md:block sticky top-14 self-start transition-all`}>{nav}</aside>
      <main className="flex-1 p-4 md:p-6 overflow-x-auto min-w-0">
        <ErrorBoundary resetKey={location.pathname}><Outlet/></ErrorBoundary>
      </main>
    </div>
  </div>;
}
