/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  BarChart3, 
  ExternalLink,
  Menu,
  X,
  Building2,
  TrendingUp,
  Settings,
  BookOpen,
  Map as MapIcon,
  ChevronRight,
  ShieldCheck,
  User,
  LogOut
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  ArcElement,
  Filler
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

/** Utility for tailwind class merging */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Premium Institutional Palette
const COLORS = {
  guinda: '#691C32',
  guindaDark: '#4a1423',
  verde: '#006341',
  dorado: '#C5A572',
  bg: '#FDFDFD',
  surface: '#FFFFFF',
  textDark: '#1A1A1A',
  textMuted: '#666666',
  border: '#EFEFEF',
};

interface DashboardData {
  summary: {
    total: number;
    entregadas: number;
    en_proceso: number;
    sin_iniciar: number;
  };
  by_dg: Record<string, {
    total: number;
    entregadas: number;
    en_proceso: number;
    sin_iniciar: number;
  }>;
  raw: any[];
}

const MOCK_DATA: DashboardData = {
  summary: { total: 342, entregadas: 158, en_proceso: 124, sin_iniciar: 60 },
  by_dg: {
    "DGCOP": { total: 85, entregadas: 40, en_proceso: 30, sin_iniciar: 15 },
    "DGSU": { total: 72, entregadas: 35, en_proceso: 25, sin_iniciar: 12 },
    "DGOIV": { total: 65, entregadas: 30, en_proceso: 25, sin_iniciar: 10 },
    "DGOT": { total: 60, entregadas: 28, en_proceso: 22, sin_iniciar: 10 },
    "DGPSS": { total: 60, entregadas: 25, en_proceso: 22, sin_iniciar: 13 }
  },
  raw: []
};

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [activeSection, setActiveSection] = useState<'resumen' | 'dg' | 'sig'>('resumen');
  
  // Drill-down states
  const [selectedDG, setSelectedDG] = useState<string | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [selectedObra, setSelectedObra] = useState<any | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/dashboard/obras');
        if (!response.ok) throw new Error('Offline');
        const json = await response.json();
        setData(json);
        setIsDemoMode(false);
      } catch (err) {
        setData(MOCK_DATA);
        setIsDemoMode(true);
      } finally {
        setTimeout(() => setLoading(false), 800);
      }
    };
    fetchData();
  }, []);

  // Helper to group raw data for drill-down
  const groupedData = useMemo(() => {
    if (!data?.raw) return {};
    const groups: any = {};
    data.raw.forEach(obra => {
      const dg = obra.dg || "SIN ASIGNAR";
      const programa = obra.programa || "PROGRAMA GENERAL"; // Assuming 'programa' exists or fallback
      if (!groups[dg]) groups[dg] = {};
      if (!groups[dg][programa]) groups[dg][programa] = [];
      groups[dg][programa].push(obra);
    });
    return groups;
  }, [data]);

  const barChartData = useMemo(() => {
    if (!data) return null;
    const labels = Object.keys(data.by_dg);
    return {
      labels,
      datasets: [{
        label: 'Obras Sin Iniciar',
        data: labels.map(label => data.by_dg[label].sin_iniciar),
        backgroundColor: COLORS.guinda,
        borderRadius: 8,
        barThickness: 32,
      }],
    };
  }, [data]);

  const lineChartData = useMemo(() => {
    if (!data) return null;
    const labels = Object.keys(data.by_dg);
    return {
      labels,
      datasets: [{
        label: 'Obras Entregadas',
        data: labels.map(label => data.by_dg[label].entregadas),
        borderColor: COLORS.verde,
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 400);
          gradient.addColorStop(0, COLORS.verde + '44');
          gradient.addColorStop(1, COLORS.verde + '00');
          return gradient;
        },
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: COLORS.verde,
        borderWidth: 3,
      }],
    };
  }, [data]);

  const pieChartData = useMemo(() => {
    if (!data) return null;
    const labels = Object.keys(data.by_dg);
    return {
      labels,
      datasets: [{
        data: labels.map(label => data.by_dg[label].total),
        backgroundColor: [COLORS.guinda, COLORS.verde, COLORS.dorado, '#333333', '#666666'],
        borderWidth: 4,
        borderColor: '#ffffff',
        hoverOffset: 20
      }],
    };
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-8"
        >
          <img 
            src="https://plataformasobse.info/web/pages/SICOPS/PROYECTO/assets/img/logo_sobse.png" 
            alt="SOBSE" 
            className="h-24 object-contain"
            referrerPolicy="no-referrer"
          />
          <div className="flex flex-col items-center gap-2">
            <div className="w-48 h-1 bg-neutral-100 rounded-full overflow-hidden">
              <motion.div 
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                className="w-full h-full bg-[#691C32]"
              />
            </div>
            <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#691C32] mt-4">Iniciando SICOPS</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#FDFDFD] overflow-hidden font-sans text-[#1A1A1A]">
      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-white border-r border-[#EFEFEF] transition-all duration-500 ease-in-out flex flex-col z-50 shadow-2xl shadow-black/5",
          sidebarOpen ? "w-[280px]" : "w-24"
        )}
      >
        <div className="p-8 flex flex-col items-center gap-6 border-b border-[#F5F5F5]">
          <motion.img 
            layout
            src="https://plataformasobse.info/web/pages/SICOPS/PROYECTO/assets/img/logo_sobse.png" 
            alt="Logo" 
            className={cn("transition-all duration-500", sidebarOpen ? "h-16" : "h-10")}
            referrerPolicy="no-referrer"
          />
          {sidebarOpen && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="text-center"
            >
              <h1 className="font-black text-2xl tracking-tighter text-[#691C32]">SICOPS</h1>
              <div className="h-0.5 w-12 bg-[#C5A572] mx-auto mt-1 rounded-full" />
            </motion.div>
          )}
        </div>

        <nav className="flex-1 py-8 px-4 space-y-2">
          <NavItem 
            icon={<LayoutDashboard />} 
            label="Resumen" 
            active={activeSection === 'resumen'} 
            onClick={() => setActiveSection('resumen')}
            sidebarOpen={sidebarOpen} 
          />
          <NavItem 
            icon={<Building2 />} 
            label="Direcciones Generales" 
            active={activeSection === 'dg'} 
            onClick={() => setActiveSection('dg')}
            sidebarOpen={sidebarOpen} 
          />
          <NavItem 
            icon={<MapIcon />} 
            label="SIG-SOBSE" 
            active={activeSection === 'sig'} 
            onClick={() => setActiveSection('sig')}
            sidebarOpen={sidebarOpen} 
          />
        </nav>

        <div className="p-6 space-y-4">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center p-3 rounded-xl hover:bg-neutral-50 text-neutral-300 transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-24 bg-white/80 backdrop-blur-md border-b border-[#EFEFEF] flex items-center justify-between px-12 shrink-0 z-40">
          <div className="flex items-center gap-6">
            <div>
              <h2 className="text-2xl font-black text-[#1A1A1A] tracking-tight">
                {activeSection === 'resumen' && "Resumen Ejecutivo"}
                {activeSection === 'dg' && "Direcciones Generales"}
                {activeSection === 'sig' && "SIG-SOBSE - Visualizador Web"}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Monitoreo en Tiempo Real</p>
              </div>
            </div>
            {isDemoMode && (
              <span className="px-3 py-1 bg-[#C5A572]/10 text-[#C5A572] text-[9px] font-black rounded-full uppercase tracking-widest border border-[#C5A572]/20">
                Entorno de Simulación
              </span>
            )}
          </div>

          <div className="flex items-center gap-8">
            {/* User icon removed */}
          </div>
        </header>

        {/* Dashboard Body */}
        <div className="flex-1 overflow-y-auto bg-[#FDFDFD]">
          <AnimatePresence mode="wait">
            {activeSection === 'resumen' && (
              <motion.div 
                key="resumen"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="p-12 space-y-12"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                  <StatCard title="TOTAL DE OBRAS" value={data?.summary.total || 0} type="total" delay={0.1} />
                  <StatCard title="OBRAS ENTREGADAS" value={data?.summary.entregadas || 0} type="entregada" delay={0.2} />
                  <StatCard title="OBRAS EN PROCESO" value={data?.summary.en_proceso || 0} type="proceso" delay={0.3} />
                  <StatCard title="OBRAS SIN INICIAR" value={data?.summary.sin_iniciar || 0} type="sin-iniciar" delay={0.4} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                  <div className="lg:col-span-2 space-y-10">
                    <ChartCard title="Obras sin iniciar por DG" subtitle="Distribución Operativa">
                      {barChartData && <Bar data={barChartData} options={CHART_OPTIONS} />}
                    </ChartCard>
                    <ChartCard title="Obras terminadas por DG" subtitle="Histórico de Entregas">
                      {lineChartData && <Line data={lineChartData} options={CHART_OPTIONS} />}
                    </ChartCard>
                  </div>
                  <div className="lg:col-span-1">
                    <ChartCard title="No. de obras por DG" className="h-full">
                      <div className="h-80 flex items-center justify-center relative">
                        {pieChartData && <Pie data={pieChartData} options={PIE_OPTIONS} />}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-4xl font-black text-[#691C32]">{data?.summary.total}</span>
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Total</span>
                        </div>
                      </div>
                    </ChartCard>
                  </div>
                </div>
              </motion.div>
            )}

            {activeSection === 'dg' && (
              <motion.div 
                key="dg"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="p-12"
              >
                {!selectedDG ? (
                  <div className="space-y-8">
                    <div className="flex flex-col gap-2">
                      <h3 className="text-3xl font-black tracking-tight">Direcciones Generales</h3>
                      <p className="text-neutral-400 text-sm font-medium">Seleccione una dirección para explorar sus programas operativos.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                      {data && Object.entries(data.by_dg).map(([name, stats], idx) => (
                        <motion.div
                          key={name}
                          whileHover={{ y: -5 }}
                          onClick={() => setSelectedDG(name)}
                          className="bg-white p-6 rounded-[2rem] border border-[#EFEFEF] shadow-xl shadow-black/5 cursor-pointer group"
                        >
                          <div className="flex justify-between items-start mb-6">
                            <h4 className="text-sm font-black text-[#691C32] leading-tight group-hover:underline">{name}</h4>
                            <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[8px] font-black rounded uppercase tracking-widest border border-red-100">ROJO</span>
                          </div>
                          <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                              <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest mb-1">Obras Activas</p>
                              <p className="text-lg font-black">{(stats as any).en_proceso}</p>
                            </div>
                            <div>
                              <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest mb-1">Frentes</p>
                              <p className="text-lg font-black">{(stats as any).total}</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between items-end">
                              <p className="text-[9px] font-bold text-neutral-500">Avance Promedio</p>
                              <p className="text-xs font-black text-[#691C32]">0%</p>
                            </div>
                            <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                              <div className="h-full bg-[#C5A572] w-0" />
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ) : !selectedProgram ? (
                  <div className="space-y-8">
                    <button onClick={() => setSelectedDG(null)} className="flex items-center gap-2 text-xs font-bold text-[#691C32] hover:underline">
                      <ChevronRight className="w-4 h-4 rotate-180" /> Volver a Direcciones
                    </button>
                    <h3 className="text-3xl font-black tracking-tight">{selectedDG}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {Object.keys(groupedData[selectedDG] || {}).map(program => (
                        <div 
                          key={program}
                          onClick={() => setSelectedProgram(program)}
                          className="bg-white p-8 rounded-[2rem] border border-[#EFEFEF] shadow-lg cursor-pointer hover:border-[#C5A572] transition-all"
                        >
                          <h4 className="text-xl font-black mb-4">{program}</h4>
                          <p className="text-sm text-neutral-400 font-bold uppercase tracking-widest">
                            {groupedData[selectedDG][program].length} Obras Registradas
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <button onClick={() => setSelectedProgram(null)} className="flex items-center gap-2 text-xs font-bold text-[#691C32] hover:underline">
                      <ChevronRight className="w-4 h-4 rotate-180" /> Volver a Programas
                    </button>
                    <h3 className="text-3xl font-black tracking-tight">{selectedProgram}</h3>
                    <div className="bg-white rounded-[2rem] border border-[#EFEFEF] shadow-2xl overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-neutral-50 border-b border-[#EFEFEF]">
                          <tr>
                            <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Nombre de la Obra</th>
                            <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Avance</th>
                            <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F5F5F5]">
                          {groupedData[selectedDG][selectedProgram].map((obra: any, idx: number) => (
                            <tr key={idx} className="hover:bg-neutral-50 transition-all">
                              <td className="px-8 py-6 font-bold text-sm">{obra.nombre}</td>
                              <td className="px-8 py-6">
                                <div className="flex items-center gap-3">
                                  <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden max-w-[100px]">
                                    <div className="h-full bg-[#006341]" style={{ width: `${obra.avance}%` }} />
                                  </div>
                                  <span className="text-xs font-black">{obra.avance}%</span>
                                </div>
                              </td>
                              <td className="px-8 py-6">
                                <button 
                                  onClick={() => setSelectedObra(obra)}
                                  className="px-4 py-2 bg-[#691C32] text-white text-[10px] font-black rounded-lg uppercase tracking-widest"
                                >
                                  Ver Detalle
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeSection === 'sig' && (
              <motion.div 
                key="sig"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full w-full flex flex-col"
              >
                <iframe 
                  src="https://plataformasobse.info/web/sandbox/PRUEBAS/Visualizador_Web2/index.html"
                  className="w-full h-full border-none"
                  title="SIG-SOBSE Visualizador"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Axolote - Hidden for now */}
          {/* 
          <motion.img 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            src="https://plataformasobse.info/web/pages/SICOPS/PROYECTO/assets/img/axolote.png" 
            alt="Axolote" 
            className="fixed bottom-0 right-12 h-32 pointer-events-none z-50 drop-shadow-2xl"
            referrerPolicy="no-referrer"
          />
          */}
      </main>

      {/* Obra Detail Modal */}
      <AnimatePresence>
        {selectedObra && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-12">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedObra(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 50 }}
              className="relative bg-white w-full max-w-4xl max-h-[80vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-10 border-b border-[#F5F5F5] flex justify-between items-center bg-neutral-50">
                <div>
                  <p className="text-[#C5A572] font-black text-[10px] uppercase tracking-widest mb-2">Detalle de Obra Pública</p>
                  <h4 className="text-2xl font-black tracking-tight">{selectedObra.nombre}</h4>
                </div>
                <button onClick={() => setSelectedObra(null)} className="p-4 rounded-full hover:bg-white transition-all shadow-sm">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {Object.entries(selectedObra).map(([key, value]) => (
                    <div key={key} className="p-6 bg-neutral-50 rounded-2xl border border-[#EFEFEF]">
                      <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-2">{key.replace(/_/g, ' ')}</p>
                      <p className="text-sm font-bold text-[#1A1A1A]">{String(value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { 
    y: { beginAtZero: true, grid: { color: '#F5F5F5' }, ticks: { font: { size: 10, weight: 'bold' as const } } }, 
    x: { grid: { display: false }, ticks: { font: { size: 10, weight: 'bold' as const } } } 
  }
};

const PIE_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '70%',
  plugins: { 
    legend: { 
      position: 'bottom' as const, 
      labels: { boxWidth: 10, font: { size: 11, weight: 'bold' as const }, padding: 20 } 
    } 
  }
};

function NavItem({ icon, label, active = false, sidebarOpen, onClick }: { icon: React.ReactNode, label: string, active?: boolean, sidebarOpen: boolean, onClick: () => void }) {
  return (
    <motion.button 
      onClick={onClick}
      whileHover={{ x: 4 }}
      className={cn(
        "w-full flex items-center gap-4 px-6 py-4 transition-all group relative rounded-2xl",
        active 
          ? "bg-[#691C32] text-white shadow-xl shadow-[#691C32]/20" 
          : "text-neutral-400 hover:bg-neutral-50 hover:text-[#691C32]"
      )}
    >
      {sidebarOpen && <span className="text-lg font-black tracking-tight">{label}</span>}
      {active && sidebarOpen && (
        <motion.div 
          layoutId="activeNav"
          className="absolute right-4 w-1.5 h-1.5 rounded-full bg-[#C5A572]"
        />
      )}
    </motion.button>
  );
}

function StatCard({ title, value, type, delay }: { title: string, value: number | string, type: 'total' | 'entregada' | 'proceso' | 'sin-iniciar', delay: number }) {
  const themes = {
    total: { border: 'border-t-[#691C32]', bg: 'bg-[#691C32]/5', text: 'text-[#691C32]' },
    entregada: { border: 'border-t-[#006341]', bg: 'bg-[#006341]/5', text: 'text-[#006341]' },
    proceso: { border: 'border-t-[#C5A572]', bg: 'bg-[#C5A572]/5', text: 'text-[#C5A572]' },
    'sin-iniciar': { border: 'border-t-neutral-300', bg: 'bg-neutral-50', text: 'text-neutral-400' },
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -8 }}
      className={cn("bg-white p-8 rounded-[2rem] shadow-2xl shadow-black/5 border-t-4 transition-all", themes[type].border)}
    >
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-4">{title}</div>
      <div className={cn("text-5xl font-black tracking-tighter", themes[type].text)}>{value}</div>
    </motion.div>
  );
}

function ChartCard({ title, subtitle, children, className }: { title: string, subtitle?: string, children: React.ReactNode, className?: string }) {
  return (
    <motion.div 
      whileHover={{ shadow: "0 25px 50px -12px rgba(0,0,0,0.08)" }}
      className={cn("bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-black/5 border border-[#EFEFEF] flex flex-col transition-all", className)}
    >
      <div className="flex justify-between items-start mb-10">
        <div>
          <h3 className="text-lg font-black text-[#1A1A1A] tracking-tight">{title}</h3>
          {subtitle && <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-1">{subtitle}</p>}
        </div>
        <div className="w-10 h-10 rounded-2xl bg-neutral-50 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-neutral-200" />
        </div>
      </div>
      <div className="flex-1 min-h-[280px]">
        {children}
      </div>
    </motion.div>
  );
}
