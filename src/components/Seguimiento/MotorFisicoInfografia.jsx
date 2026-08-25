import React from "react";
import styles from "./MotorFisicoInfografia.module.css";

/**
 * Infografía de una sola vista — explica en lenguaje llano cómo
 * funciona el motor de avance físico de SICOPS: cómo convierte el
 * programa de obra quincenal en una curva semanal, y cómo detecta solo
 * cuándo una obra se atrasa. Mismo formato que MotorFinancieroInfografia.
 *
 * Las cifras del bloque "Qué resultados obtiene" son ILUSTRATIVAS, no
 * datos de una obra en vivo — esta pieza explica el mecanismo.
 */
export default function MotorFisicoInfografia() {
  return (
    <div className={styles.page}>
      <main className={styles.hoja}>

        {/* PORTADA */}
        <div className={styles.portada}>
          <span className={styles.eyebrow}>Seguimiento físico de obra</span>
          <h1 className={styles.titulo}>Motor de Avance Físico</h1>
          <p className={styles.sub}>Cómo SICOPS convierte el programa de obra en una curva semanal, y detecta solo cuándo una obra se atrasa.</p>
        </div>

        {/* QUÉ ES */}
        <div className={styles.quees}>
          <div className={styles.glifo} aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#691C32" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 20h18M4.5 20V9M9.5 20v-6.5M14.5 20v-10M19.5 20V5.5" />
            </svg>
          </div>
          <div>
            <h3>Qué es</h3>
            <p>El Motor de Avance Físico toma el <strong>programa de obra</strong> que entrega la empresa (por quincena) y lo convierte en una <strong>curva semana a semana</strong>, comparándola contra lo que reportan Supervisión Externa e Interna. <strong>Nadie hace el prorrateo a mano.</strong></p>
          </div>
        </div>

        {/* CÓMO FUNCIONA */}
        <section className={styles.section}>
          <div className={styles.rotulo}><span className={styles.punto}></span><h2>Cómo funciona</h2><span className={styles.linea}></span></div>
          <div className={styles.ruta}>

            <div className={styles.paso}>
              <div className={styles.num}>1</div>
              <div className={styles["tarjeta-paso"]}>
                <span className={styles.ico} aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#691C32" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4.5" width="18" height="17" rx="3" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
                  </svg>
                </span>
                <h4>Se arma el calendario del contrato</h4>
                <p>Fecha de inicio + días naturales, dividido en semanas naturales.</p>
              </div>
            </div>

            <div className={styles.paso}>
              <div className={styles.num}>2</div>
              <div className={styles["tarjeta-paso"]}>
                <span className={styles.ico} aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#BC955C" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5V6a2 2 0 0 1 2-2h9l5 5v10.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><path d="M15 4v5h5M8 13.5h8M8 17h5" />
                  </svg>
                </span>
                <h4>Se captura el programa por quincena</h4>
                <p>Periodo y % acumulado, tal como lo entrega la empresa.</p>
              </div>
            </div>

            <div className={styles.paso}>
              <div className={styles.num}>3</div>
              <div className={styles["tarjeta-paso"]}>
                <span className={styles.ico} aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#691C32" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 6h16M4 6v13M20 6v13M4 19h16" /><path d="M9 6v13M14 6v13" strokeDasharray="2.5 2.5" />
                  </svg>
                </span>
                <h4>El sistema reparte cada quincena en semanas</h4>
                <p>Convierte el % en una tasa diaria y la distribuye entre las semanas que toca.</p>
              </div>
            </div>

            <div className={styles.paso}>
              <div className={styles.num}>4</div>
              <div className={styles["tarjeta-paso"]}>
                <span className={styles.ico} aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#BC955C" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="8.5" cy="7" r="3.2" /><path d="M2.5 20.5a6 6 0 0 1 12 0" /><path d="M16.5 4.2a3 3 0 0 1 0 5.6M18 13.6a5.5 5.5 0 0 1 3 5.9" />
                  </svg>
                </span>
                <h4>Externa e Interna reportan su % real cada semana</h4>
                <p>Externa reporta lo ejecutado; Interna avala o corrige.</p>
              </div>
            </div>

            <div className={styles.paso}>
              <div className={styles.num}>5</div>
              <div className={styles["tarjeta-paso"]}>
                <span className={styles.ico} aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#691C32" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12h13M16 12l-3.5-3.5M16 12l-3.5 3.5" /><path d="M19.5 6v12" strokeDasharray="2.5 2.5" />
                  </svg>
                </span>
                <h4>Si no cierra en 100% a tiempo, se extiende sola</h4>
                <p>El sistema abre la semana siguiente en automático para seguir el registro.</p>
              </div>
            </div>

          </div>
        </section>

        {/* RESULTADOS */}
        <section className={styles.section}>
          <div className={styles.rotulo}><span className={styles.punto}></span><h2>Qué resultados obtiene</h2><span className={styles.linea}></span></div>

          <div className={styles.kpis}>
            <div className={styles.kpi}>
              <div className={styles.rot}>Avance real, calculado semana a semana</div>
              <div className={`${styles.cifra} ${styles.verde}`}>63%</div>
              <div className={styles.pie}>27 de 42 semanas capturadas</div>
              <div className={styles.barra}><i style={{ width: "63%" }}></i></div>
            </div>

            <div className={styles.kpi}>
              <div className={styles.rot}>Semanas restantes para cerrar el contrato</div>
              <div className={`${styles.cifra} ${styles.oro}`}>15</div>
              <div className={styles.pie}>de 42 semanas totales</div>
              <div className={styles.barra}><i style={{ width: "36%", background: "#BC955C" }}></i></div>
            </div>

            <div className={`${styles.kpi} ${styles["kpi--graf"]}`}>
              <div className={styles.rot}>Curva de avance — programado contra real</div>
              <svg viewBox="0 0 460 186" width="100%" height="auto" role="img" aria-label="Curva de avance físico: línea programada, línea de Supervisión Externa y línea de Supervisión Interna." style={{ marginTop: 14 }}>
                <g stroke="#F0E9DC" strokeWidth={1}>
                  <line x1="40" y1="20" x2="440" y2="20" />
                  <line x1="40" y1="55" x2="440" y2="55" />
                  <line x1="40" y1="90" x2="440" y2="90" />
                  <line x1="40" y1="125" x2="440" y2="125" />
                </g>
                <line x1="40" y1="160" x2="440" y2="160" stroke="#E7DFD1" strokeWidth={1.4} />
                <g fontFamily="Inter" fontSize="9" fill="#9C917F" fontWeight="600" textAnchor="end">
                  <text x="33" y="23">100%</text>
                  <text x="33" y="93">50%</text>
                  <text x="33" y="163">0%</text>
                </g>
                <polyline points="40,157 76,144 113,129 149,114 186,99 222,84 258,69 295,55 331,41 367,29 404,20 440,15"
                  fill="none" stroke="#d97706" strokeWidth={2} strokeDasharray="6 4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M40,157 76,150 113,138 149,124 186,111 222,98 258,86 295,73 331,61 367,50 404,40 440,32"
                  fill="none" stroke="#16a34a" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                <path d="M40,157 76,148 113,134 149,119 186,105 222,91 258,78 295,65 331,53 367,42 404,32 440,24"
                  fill="none" stroke="#2563eb" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="440" cy="15" r="3.6" fill="#d97706" stroke="#fff" strokeWidth={2} />
                <circle cx="440" cy="32" r="3.6" fill="#16a34a" stroke="#fff" strokeWidth={2} />
                <circle cx="440" cy="24" r="3.6" fill="#2563eb" stroke="#fff" strokeWidth={2} />
                <g fontFamily="Inter" fontSize="9.5" fill="#736A5D" fontWeight="600" textAnchor="middle">
                  <text x="76" y="176">S7</text><text x="176" y="176">S19</text>
                  <text x="286" y="176">S31</text><text x="404" y="176">S42</text>
                </g>
              </svg>
              <div className={styles.leyenda}>
                <span><i className={styles.mecha} style={{ background: "#d97706" }}></i>Programado</span>
                <span><i className={styles.mecha} style={{ background: "#16a34a" }}></i>Sup. Externa</span>
                <span><i className={styles.mecha} style={{ background: "#2563eb" }}></i>Sup. Interna</span>
              </div>
              <p className={styles["nota-graf"]}>Externa reporta lo ejecutado; Interna avala o corrige — ambas curvas se comparan contra la misma línea programada.</p>
            </div>
          </div>

          <div className={styles.fuente}>
            <span aria-hidden="true">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5.5" rx="7.5" ry="3" /><path d="M4.5 5.5v13c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-13" /><path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" />
              </svg>
            </span>
            <div className={styles.txt}>
              <h4>Un solo origen de datos para la pantalla y para los reportes</h4>
              <p>Lo que ve el usuario en pantalla y lo que sale impreso se calculan con las mismas reglas. Cero doble captura.</p>
            </div>
            <div className={styles.salidas}>
              <span className={styles["chip-salida"]}>PANTALLA</span>
              <span className={styles["chip-salida"]}>PDF</span>
              <span className={styles["chip-salida"]}>EXCEL</span>
            </div>
          </div>
        </section>

        {/* CÓMO HACE LOS CÁLCULOS */}
        <section className={styles.section}>
          <div className={styles.rotulo}><span className={styles.punto}></span><h2>Cómo hace los cálculos</h2><span className={styles.linea}></span></div>
          <div className={styles.cinta}>

            <div className={styles.renglon}>
              <div className={styles.celda}>
                <div className={styles.et}>% acum. de esta quincena</div>
                <div className={styles.de}>Lo que entrega la empresa</div>
              </div>
              <div className={styles.op} aria-hidden="true">−</div>
              <div className={styles.celda}>
                <div className={styles.et}>% acum. de la quincena anterior</div>
                <div className={styles.de}>0% en la primera</div>
              </div>
              <div className={styles.op} aria-hidden="true">=</div>
              <div className={`${styles.celda} ${styles.res}`}>
                <div className={styles.et}>Incremento de la quincena</div>
                <div className={styles.de}>Lo que avanza en ese tramo</div>
              </div>
              <div className={styles.op} aria-hidden="true">÷</div>
              <div className={styles.celda}>
                <div className={styles.et}>Días de la quincena</div>
                <div className={styles.de}>Normalmente 15</div>
              </div>
              <div className={styles.op} aria-hidden="true">=</div>
              <div className={`${styles.celda} ${styles.oro}`}>
                <div className={styles.et}>Tasa diaria</div>
                <div className={styles.de}>% que avanza cada día</div>
              </div>
            </div>

            <div className={styles.renglon}>
              <div className={styles.celda}>
                <div className={styles.et}>Días de la semana en cada quincena</div>
                <div className={styles.de}>Una semana puede tocar dos quincenas</div>
              </div>
              <div className={styles.op} aria-hidden="true">×</div>
              <div className={styles.celda}>
                <div className={styles.et}>Tasa diaria de esa quincena</div>
                <div className={styles.de}>Calculada arriba</div>
              </div>
              <div className={styles.op} aria-hidden="true">=</div>
              <div className={`${styles.celda} ${styles.res}`}>
                <div className={styles.et}>% programado de la semana</div>
                <div className={styles.de}>Se acumula semana a semana hasta 100%</div>
              </div>
            </div>

            <div className={styles.reglas}>
              <div className={styles.regla}>
                <span aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#006341" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" />
                  </svg>
                </span>
                <div>
                  <h5>Solo semanas ya iniciadas</h5>
                  <p>No se puede adelantar captura de una semana cuya fecha todavía no llega.</p>
                </div>
              </div>
              <div className={styles.regla}>
                <span aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#006341" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 19h18" /><path d="M3.5 16h5v-4h5V8h5V4.5" />
                  </svg>
                </span>
                <div>
                  <h5>Extensión automática por desfase</h5>
                  <p>Si al llegar al plazo contractual el avance real no llega a 100%, se habilita una semana más (programado fijo en 100%) para seguir hasta cerrar.</p>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* POTENCIAL */}
        <section className={styles.section} style={{ paddingBottom: 0 }}>
          <div className={styles.rotulo}><span className={styles.punto}></span><h2>El gran potencial</h2><span className={styles.linea}></span></div>
          <div className={styles.potencial}>

            <div className={styles.pot}>
              <span className={styles.ico} aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#691C32" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5V6a2 2 0 0 1 2-2h9l5 5v10.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><path d="M15 4v5h5M8 13.5h8M8 17h5" />
                </svg>
              </span>
              <h4>Convierte quincenas en semanas sola</h4>
              <p>Nadie hace el prorrateo a mano, sea cual sea la duración del contrato.</p>
            </div>

            <div className={styles.pot}>
              <span className={styles.ico} aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#BC955C" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12h13M16 12l-3.5-3.5M16 12l-3.5 3.5" /><path d="M19.5 6v12" strokeDasharray="2.5 2.5" />
                </svg>
              </span>
              <h4>Detecta los atrasos, no los esconde</h4>
              <p>Si una obra no cierra a tiempo, el calendario se extiende automáticamente en vez de ocultarlo.</p>
            </div>

            <div className={styles.pot}>
              <span className={styles.ico} aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#691C32" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="M2.5 20.5a6.5 6.5 0 0 1 13 0" /><path d="M17 6.2a3 3 0 0 1 0 5.6M18.5 14.6a6 6 0 0 1 3 5.9" />
                </svg>
              </span>
              <h4>Doble verificación sin fricción</h4>
              <p>Sup. Externa reporta y Sup. Interna avala o corrige, las dos en la misma pantalla.</p>
            </div>

            <div className={styles.pot}>
              <span className={styles.ico} aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#BC955C" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.5 12a8.5 8.5 0 0 1-14.6 5.9M3.5 12a8.5 8.5 0 0 1 14.6-5.9" /><path d="M18.3 2.6v3.9h-3.9M5.7 21.4v-3.9h3.9" />
                </svg>
              </span>
              <h4>Las correcciones se reflejan al instante</h4>
              <p>Un ajuste se actualiza de inmediato en pantalla, PDF y Excel, sin reconciliar nada a mano.</p>
            </div>

          </div>
        </section>

        {/* CIERRE */}
        <div className={styles.cierre}>
          <div className={styles.lema}>
            <svg width="38" height="42" viewBox="0 0 24 26" fill="none" aria-hidden="true">
              <path d="M12 1.5 22 5v9.5c0 5.6-4.3 9.4-10 11-5.7-1.6-10-5.4-10-11V5l10-3.5Z" stroke="#DDC9A3" strokeWidth={1.5} fill="rgba(221,201,163,.12)" />
              <path d="m7.5 12.8 3.1 3.1 6-6.2" stroke="#DDC9A3" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div>
              <h3>Una sola fuente de verdad</h3>
              <p>El avance real, siempre visible y comparable contra lo programado — en pantalla, PDF y Excel, con las mismas reglas.</p>
            </div>
          </div>
          <div className={styles.sinlista}>
            <span>Sin atrasos escondidos</span>
            <span>Sin captura doble</span>
            <span>Sin hojas de cálculo</span>
          </div>
        </div>

      </main>
    </div>
  );
}
