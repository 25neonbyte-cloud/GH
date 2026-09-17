import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ErrorBoundary from './ErrorBoundary';

const items = [
  ['/','Dashboard','dashboard'],['/leitos','Leitos','leitos'],['/internacoes','Internações','internacoes'],['/pacientes','Pacientes','pacientes'],
  ['/prontuario','Prontuário','prontuario'],['/profissionais','Profissionais','profissionais'],['/escala','Escala','escala'],['/usuarios','Usuários','usuarios'],
  ['/dados','Importar / Exportar','sync'],['/backups','Backups','backup'],
];

export default function Layout() {
  const { user, logout, can } = useAuth();
  const location = useLocation();
  const visible = items.filter(([,,m]) => m === 'dashboard' ? can('dashboard','read') : ['usuarios','sync','backup'].includes(m) ? user?.role === 'ADMIN' : can(m,'read'));
  const linkClass = ({isActive}) => `block px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`;

  return <div className="min-h-screen bg-slate-50">
    <header className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between sticky top-0 z-20">
      <div><b>Hospital PRJT</b><span className="text-slate-400 text-sm ml-3 hidden sm:inline">MVP Operacional</span></div>
      <div className="flex gap-3 items-center text-sm"><span className="hidden sm:inline">{user?.nome}</span><button className="btn bg-slate-700 py-2" onClick={logout}>Sair</button></div>
    </header>

    <nav className="md:hidden bg-white border-b p-2 flex gap-1 overflow-x-auto sticky top-[56px] z-10">
      {visible.map(([to,label]) => <NavLink key={to} to={to} end={to === '/'} className={linkClass}>{label}</NavLink>)}
      <a href="/tv" target="_blank" rel="noreferrer" className="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 whitespace-nowrap">TV ↗</a>
    </nav>

    <div className="flex">
      <aside className="w-60 min-h-[calc(100vh-56px)] bg-white border-r border-slate-200 p-3 hidden md:block sticky top-[56px] self-start">
        <div className="text-xs uppercase tracking-wide text-slate-400 px-3 py-2">Operação</div>
        {visible.map(([to,label]) => <NavLink key={to} to={to} end={to === '/'} className={({isActive}) => `${linkClass({isActive})} mb-1`}>{label}</NavLink>)}
        <a href="/tv" target="_blank" rel="noreferrer" className="block px-3 py-2 rounded-lg mt-4 text-sm font-semibold text-slate-600 hover:bg-slate-100">Modo TV ↗</a>
      </aside>
      <main className="flex-1 p-4 md:p-6 overflow-x-auto min-w-0">
        <ErrorBoundary resetKey={location.pathname}><Outlet/></ErrorBoundary>
      </main>
    </div>
  </div>;
}
