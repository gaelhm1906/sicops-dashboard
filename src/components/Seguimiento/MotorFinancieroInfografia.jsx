import React from "react";
import styles from "./MotorFinancieroInfografia.module.css";

/**
 * Infografía de una sola vista — explica en lenguaje llano (sin jerga
 * de código) cómo funciona el motor financiero de SICOPS: de dónde
 * salen los datos, cómo se calculan, y qué obtiene la Secretaría con
 * esto. Pensada para leerse en un minuto y para poder imprimirse como
 * una sola hoja (trae su propio @media print).
 *
 * Las cifras del bloque "Qué resultados obtiene" son ILUSTRATIVAS, no
 * datos de una obra en vivo — esta pieza explica el mecanismo, no
 * reporta un caso real. Si más adelante se quiere una versión con
 * datos reales de una obra específica, es un componente aparte.
 */
export default function MotorFinancieroInfografia() {
  return (
    <div className={styles.page}>
      <main className={styles.hoja}>

        {/* PORTADA */}
        <div className={styles.portada}>
          <span className={styles.eyebrow}>Seguimiento financiero de contratos</span>
          <h1 className={styles.titulo}>Motor Financiero</h1>
          <p className={styles.sub}>Cómo SICOPS calcula y da seguimiento al avance financiero de cada contrato, en tiempo real y sin hojas de cálculo.</p>
        </div>

        {/* QUÉ ES */}
        <div className={styles.quees}>
          <div className={styles.glifo} aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#691C32" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="2.5" width="16" height="19" rx="3" /><path d="M8 7h8M8 12h2.5M13.5 12H16M8 16.5h2.5M13.5 16.5H16" />
            </svg>
          </div>
          <div>
            <h3>Qué es</h3>
            <p>El Motor Financiero toma la <strong>carátula del contrato</strong> y las <strong>estimaciones que se van entregando</strong>, y calcula por sí solo el IVA, las deducciones, el porcentaje acumulado y el saldo pendiente. <strong>Nadie hace cuentas a mano.</strong></p>
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
                    <path d="M14 2.5H7a2.5 2.5 0 0 0-2.5 2.5v14A2.5 2.5 0 0 0 7 21.5h10a2.5 2.5 0 0 0 2.5-2.5V8L14 2.5Z" /><path d="M14 2.5V8h5.5M8.5 13h7M8.5 17h4.5" />
                  </svg>
                </span>
                <h4>Se captura el contrato una sola vez</h4>
                <p>Carátula: importe, fechas, contratista, deducciones.</p>
              </div>
            </div>

            <div className={styles.paso}>
              <div className={styles.num}>2</div>
              <div className={styles["tarjeta-paso"]}>
                <span className={styles.ico} aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#BC955C" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13.5a4 4 0 0 0 6 .4l2.5-2.5a4 4 0 0 0-5.6-5.6L11.5 7" /><path d="M14 10.5a4 4 0 0 0-6-.4L5.5 12.6a4 4 0 0 0 5.6 5.6L12.5 17" />
                  </svg>
                </span>
                <h4>Se vincula a la obra</h4>
                <p>Un mismo contrato puede atender una o varias obras.</p>
              </div>
            </div>

            <div className={styles.paso}>
              <div className={styles.num}>3</div>
              <div className={styles["tarjeta-paso"]}>
                <span className={styles.ico} aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#691C32" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4.5" width="18" height="17" rx="3" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4M7.5 14h3M7.5 17.5h9M14 14h2.5" />
                  </svg>
                </span>
                <h4>Se registran las estimaciones conforme llegan</h4>
                <p>Periodo, fecha de entrega, monto y deducciones.</p>
              </div>
            </div>

            <div className={styles.paso}>
              <div className={styles.num}>4</div>
              <div className={styles["tarjeta-paso"]}>
                <span className={styles.ico} aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#BC955C" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3.2" />
                    <path d="M12 2.5v2.6M12 18.9v2.6M21.5 12h-2.6M5.1 12H2.5M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8M18.7 18.7l-1.8-1.8M7.1 7.1 5.3 5.3" />
                  </svg>
                </span>
                <h4>El sistema calcula todo solo</h4>
                <p>IVA 16%, monto líquido, % acumulado y la semana que le toca.</p>
              </div>
            </div>

            <div className={styles.paso}>
              <div className={styles.num}>5</div>
              <div className={styles["tarjeta-paso"]}>
                <span className={styles.ico} aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#691C32" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 20h18M4.5 20V9M9.5 20v-6.5M14.5 20v-10M19.5 20V5.5" />
                  </svg>
                </span>
                <h4>La curva y los reportes se actualizan solos</h4>
                <p>Programado contra real, y el informe listo en PDF o Excel.</p>
              </div>
            </div>

          </div>
        </section>

        {/* RESULTADOS */}
        <section className={styles.section}>
          <div className={styles.rotulo}><span className={styles.punto}></span><h2>Qué resultados obtiene</h2><span className={styles.linea}></span></div>

          <div className={styles.kpis}>
            <div className={styles.kpi}>
              <div className={styles.rot}>Porcentaje ejercido del contrato, en tiempo real</div>
              <div className={`${styles.cifra} ${styles.verde}`}>0.4%</div>
              <div className={styles.pie}>11 estimado de 2,703 contratado</div>
              <div className={styles.barra}><i style={{ width: "6%" }}></i></div>
            </div>

            <div className={styles.kpi}>
              <div className={styles.rot}>Saldo pendiente por estimar, calculado automáticamente</div>
              <div className={`${styles.cifra} ${styles.oro}`}>2,681</div>
              <div className={styles.pie}>del importe total del contrato</div>
              <div className={styles.barra}><i style={{ width: "94%", background: "#BC955C" }}></i></div>
            </div>

            <div className={`${styles.kpi} ${styles["kpi--graf"]}`}>
              <div className={styles.rot}>Curva financiera semana a semana, sin huecos</div>
              <svg viewBox="0 0 460 186" width="100%" height="auto" role="img" aria-label="Curva de avance financiero: línea programada contra línea ejercida, escalonada y continua." style={{ marginTop: 14 }}>
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
                <polyline points="40,157 76,152 113,143 149,132 186,119 222,105 258,90 295,75 331,59 367,45 404,33 440,23"
                  fill="none" stroke="#9C917F" strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M40,160 H113 V149 H222 V129 H295 V111 H404 V87 H440"
                  fill="none" stroke="#691C32" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
                <g fill="#691C32">
                  <circle cx="113" cy="149" r="3.6" /><circle cx="222" cy="129" r="3.6" />
                  <circle cx="295" cy="111" r="3.6" /><circle cx="404" cy="87" r="3.6" />
                </g>
                <g fontFamily="Inter" fontSize="9.5" fill="#736A5D" fontWeight="600" textAnchor="middle">
                  <text x="76" y="176">Abr</text><text x="176" y="176">May</text>
                  <text x="286" y="176">Jun</text><text x="404" y="176">Jul</text>
                </g>
              </svg>
              <div className={styles.leyenda}>
                <span><i className={styles.mecha} style={{ background: "#9C917F" }}></i>Programado</span>
                <span><i className={styles.mecha} style={{ background: "#691C32" }}></i>Ejercido</span>
              </div>
              <p className={styles["nota-graf"]}>Cada punto es una estimación pagada. Entre una y otra, la curva se sostiene en el último porcentaje conocido: nunca cae a cero.</p>
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
                <div className={styles.et}>Monto sin IVA</div>
                <div className={styles.de}>Lo que trae la estimación</div>
              </div>
              <div className={styles.op} aria-hidden="true">+</div>
              <div className={`${styles.celda} ${styles.oro}`}>
                <div className={styles.et}>IVA 16%</div>
                <div className={styles.de}>Tasa fija del sistema</div>
              </div>
              <div className={styles.op} aria-hidden="true">=</div>
              <div className={`${styles.celda} ${styles.res}`}>
                <div className={styles.et}>Monto con IVA</div>
                <div className={styles.de}>Importe bruto de la estimación</div>
              </div>
              <div className={styles.op} aria-hidden="true">−</div>
              <div className={styles.celda}>
                <div className={styles.et}>Deducciones</div>
                <div className={styles.de}>Total que trae la estimación</div>
              </div>
              <div className={styles.op} aria-hidden="true">=</div>
              <div className={`${styles.celda} ${styles.res}`}>
                <div className={styles.et}>Monto líquido</div>
                <div className={styles.de}>Lo que realmente se paga</div>
              </div>
            </div>

            <div className={styles.renglon}>
              <div className={`${styles.celda} ${styles.res}`}>
                <div className={styles.et}>Suma de estimaciones</div>
                <div className={styles.de}>Todo lo estimado hasta hoy</div>
              </div>
              <div className={styles.op} aria-hidden="true">÷</div>
              <div className={styles.celda}>
                <div className={styles.et}>Importe total del contrato</div>
                <div className={styles.de}>Dato de la carátula</div>
              </div>
              <div className={styles.op} aria-hidden="true">=</div>
              <div className={`${styles.celda} ${styles.oro}`}>
                <div className={styles.et}>% ejercido acumulado</div>
                <div className={styles.de}>Con tope en 100%</div>
              </div>
            </div>

            <div className={styles.reglas}>
              <div className={styles.regla}>
                <span aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#006341" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4.5" width="18" height="17" rx="3" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /><path d="M8.5 15.5l2.2 2.2 4.3-4.3" />
                  </svg>
                </span>
                <div>
                  <h5>Ubicación en semana</h5>
                  <p>Cada estimación cae sola en la semana natural (lunes a domingo) que le corresponde dentro del plazo del contrato.</p>
                </div>
              </div>
              <div className={styles.regla}>
                <span aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#006341" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 19h18" /><path d="M3.5 16h5v-4h5V8h5V4.5" />
                  </svg>
                </span>
                <div>
                  <h5>Curva continua</h5>
                  <p>Las semanas sin estimación conservan el último porcentaje alcanzado, para que la curva refleje el avance real.</p>
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
                  <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="M2.5 20.5a6.5 6.5 0 0 1 13 0" /><path d="M17 6.2a3 3 0 0 1 0 5.6M18.5 14.6a6 6 0 0 1 3 5.9" />
                </svg>
              </span>
              <h4>Elimina el error humano y la duplicidad</h4>
              <p>Se acaban los Excel dispersos por dirección. Una sola fuente de verdad para todos.</p>
            </div>

            <div className={styles.pot}>
              <span className={styles.ico} aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#BC955C" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3.5v17M6 6.5h12M4 20.5h16" /><path d="M6 6.5 3 13h6L6 6.5ZM18 6.5 15 13h6l-3-6.5Z" />
                </svg>
              </span>
              <h4>Funciona igual para todos los contratos</h4>
              <p>Desde uno de 100 mil hasta uno de 140 millones. Mismo método, misma precisión.</p>
            </div>

            <div className={styles.pot}>
              <span className={styles.ico} aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#691C32" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2.8 21 7l-9 4.2L3 7l9-4.2Z" /><path d="m3 12 9 4.2L21 12M3 17l9 4.2L21 17" />
                </svg>
              </span>
              <h4>Listo para crecer al detalle fino</h4>
              <p>En una siguiente etapa se abren deducciones, sanciones y retenciones por concepto.</p>
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
              <p>Todo se calcula con las mismas reglas en pantalla, PDF y Excel. Información confiable, consistente y siempre actualizada.</p>
            </div>
          </div>
          <div className={styles.sinlista}>
            <span>Sin reconciliaciones</span>
            <span>Sin hojas de cálculo</span>
            <span>Sin doble captura</span>
          </div>
        </div>

      </main>
    </div>
  );
}
