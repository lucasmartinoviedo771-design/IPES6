/**
 * Íconos SVG inline ilustrados para las cards de trámites del estudiante.
 * Se usan como componentes React y aceptan size y color como props
 * para integrarse con el tema institucional.
 */

interface IconProps {
  size?: number;
  primary?: string;
  secondary?: string;
}

const P = "#B7694E"; // terracotta
const S = "#7D7F6E"; // verde institucional
const W = "#fff";
const L = "#f3e8e0"; // terracotta claro

export const IconTramites = ({ size = 48, primary = P, secondary = S }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="4" width="28" height="36" rx="3" fill={secondary} opacity=".15"/>
    <rect x="8" y="6" width="28" height="36" rx="3" fill={W} stroke={secondary} strokeWidth="1.5"/>
    <rect x="13" y="13" width="16" height="2.5" rx="1.2" fill={secondary}/>
    <rect x="13" y="19" width="12" height="2.5" rx="1.2" fill={secondary} opacity=".6"/>
    <rect x="13" y="25" width="14" height="2.5" rx="1.2" fill={secondary} opacity=".4"/>
    <circle cx="36" cy="36" r="9" fill={primary}/>
    <path d="M32 36l3 3 5-5" stroke={W} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const IconInscripcionMaterias = ({ size = 48, primary = P, secondary = S }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="36" height="36" rx="4" fill={primary} opacity=".1"/>
    <rect x="8" y="8" width="32" height="32" rx="3" fill={W} stroke={primary} strokeWidth="1.5"/>
    <rect x="13" y="14" width="8" height="8" rx="2" fill={primary} opacity=".2"/>
    <rect x="14" y="15" width="6" height="6" rx="1.5" fill={primary}/>
    <rect x="25" y="15" width="10" height="2" rx="1" fill={secondary}/>
    <rect x="25" y="19" width="7" height="2" rx="1" fill={secondary} opacity=".5"/>
    <rect x="13" y="26" width="8" height="8" rx="2" fill={secondary} opacity=".15"/>
    <rect x="14" y="27" width="6" height="6" rx="1.5" fill={secondary}/>
    <rect x="25" y="27" width="10" height="2" rx="1" fill={secondary}/>
    <rect x="25" y="31" width="7" height="2" rx="1" fill={secondary} opacity=".5"/>
    <path d="M15.5 18l1.5 1.5 2.5-2.5" stroke={W} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const IconHorario = ({ size = 48, primary = P, secondary = S }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="26" r="16" fill={primary} opacity=".12"/>
    <circle cx="24" cy="26" r="14" fill={W} stroke={primary} strokeWidth="1.5"/>
    <circle cx="24" cy="26" r="2" fill={primary}/>
    <path d="M24 26V18" stroke={primary} strokeWidth="2" strokeLinecap="round"/>
    <path d="M24 26l6 4" stroke={secondary} strokeWidth="2" strokeLinecap="round"/>
    <rect x="16" y="8" width="16" height="5" rx="2.5" fill={secondary}/>
    <rect x="20" y="6" width="3" height="4" rx="1.5" fill={secondary}/>
    <rect x="25" y="6" width="3" height="4" rx="1.5" fill={secondary}/>
  </svg>
);

export const IconCambioComision = ({ size = 48, primary = P, secondary = S }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="14" width="18" height="20" rx="3" fill={secondary} opacity=".15"/>
    <rect x="5" y="15" width="18" height="20" rx="3" fill={W} stroke={secondary} strokeWidth="1.5"/>
    <rect x="9" y="20" width="10" height="2" rx="1" fill={secondary}/>
    <rect x="9" y="24" width="7" height="2" rx="1" fill={secondary} opacity=".5"/>
    <rect x="26" y="14" width="18" height="20" rx="3" fill={primary} opacity=".15"/>
    <rect x="27" y="15" width="18" height="20" rx="3" fill={W} stroke={primary} strokeWidth="1.5"/>
    <rect x="31" y="20" width="10" height="2" rx="1" fill={primary}/>
    <rect x="31" y="24" width="7" height="2" rx="1" fill={primary} opacity=".5"/>
    <path d="M19 10l5-4 5 4" stroke={primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M29 38l-5 4-5-4" stroke={secondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="24" y1="6" x2="24" y2="42" stroke="#ccc" strokeWidth="1" strokeDasharray="3 2"/>
  </svg>
);

export const IconMesaExamen = ({ size = 48, primary = P, secondary = S }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 6l4 12h13l-10.5 7.5 4 12L24 30l-10.5 7.5 4-12L7 18h13z" fill={primary} opacity=".15" stroke={primary} strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M24 10l3 8h8.5l-6.8 5 2.6 8L24 26l-7.3 5 2.6-8L12.5 18H21z" fill={primary} opacity=".4"/>
    <circle cx="24" cy="24" r="6" fill={W}/>
    <path d="M21 24l2 2 4-4" stroke={secondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const IconTrayectoria = ({ size = 48, primary = P, secondary = S }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="40" height="40" rx="5" fill={secondary} opacity=".08"/>
    <polyline points="8,36 16,24 22,30 30,16 40,20" stroke={primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <circle cx="8" cy="36" r="2.5" fill={secondary}/>
    <circle cx="16" cy="24" r="2.5" fill={secondary}/>
    <circle cx="22" cy="30" r="2.5" fill={primary}/>
    <circle cx="30" cy="16" r="2.5" fill={primary}/>
    <circle cx="40" cy="20" r="2.5" fill={primary}/>
    <line x1="8" y1="40" x2="42" y2="40" stroke={secondary} strokeWidth="1.5" opacity=".4"/>
    <line x1="8" y1="8" x2="8" y2="40" stroke={secondary} strokeWidth="1.5" opacity=".4"/>
  </svg>
);

export const IconAsistencias = ({ size = 48, primary = P, secondary = S }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="10" width="36" height="32" rx="4" fill={secondary} opacity=".1"/>
    <rect x="7" y="11" width="34" height="30" rx="3.5" fill={W} stroke={secondary} strokeWidth="1.5"/>
    <rect x="13" y="6" width="4" height="8" rx="2" fill={secondary}/>
    <rect x="31" y="6" width="4" height="8" rx="2" fill={secondary}/>
    <rect x="11" y="18" width="26" height="1.5" rx=".75" fill={secondary} opacity=".2"/>
    {[0,1,2,3,4,5,6].map((col) => (
      <circle key={col} cx={14 + col * 4} cy={26} r="2" fill={col < 5 ? primary : secondary} opacity={col < 5 ? 1 : 0.3}/>
    ))}
    {[0,1,2].map((col) => (
      <circle key={col} cx={14 + col * 4} cy={34} r="2" fill={secondary} opacity=".3"/>
    ))}
  </svg>
);

export const IconCertificado = ({ size = 48, primary = P, secondary = S }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="28" height="36" rx="3" fill={W} stroke={secondary} strokeWidth="1.5"/>
    <rect x="10" y="13" width="20" height="2" rx="1" fill={secondary}/>
    <rect x="10" y="18" width="15" height="2" rx="1" fill={secondary} opacity=".5"/>
    <rect x="10" y="23" width="17" height="2" rx="1" fill={secondary} opacity=".4"/>
    <circle cx="36" cy="36" r="10" fill={primary}/>
    <path d="M31 36l3.5 3.5 6-6" stroke={W} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M31 44l5-2 5 2v-6" stroke={primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".4"/>
  </svg>
);

export const IconConstanciaExamen = ({ size = 48, primary = P, secondary = S }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="4" width="32" height="40" rx="4" fill={W} stroke={primary} strokeWidth="1.5"/>
    <rect x="13" y="11" width="22" height="3" rx="1.5" fill={primary}/>
    <rect x="13" y="17" width="16" height="2" rx="1" fill={secondary} opacity=".6"/>
    <rect x="13" y="22" width="18" height="2" rx="1" fill={secondary} opacity=".4"/>
    <rect x="13" y="27" width="14" height="2" rx="1" fill={secondary} opacity=".3"/>
    <rect x="13" y="33" width="22" height="1.5" rx=".75" fill={secondary} opacity=".2"/>
    <circle cx="28" cy="37" r="4" fill={primary}/>
    <path d="M26 37l1.5 1.5 2.5-2.5" stroke={W} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const IconCursoIntro = ({ size = 48, primary = P, secondary = S }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 6L42 16v4H6v-4L24 6z" fill={secondary} opacity=".2" stroke={secondary} strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M24 6L42 16 24 22 6 16z" fill={secondary} opacity=".3"/>
    <rect x="10" y="20" width="28" height="16" rx="2" fill={W} stroke={secondary} strokeWidth="1.5"/>
    <rect x="14" y="24" width="6" height="8" rx="1" fill={primary} opacity=".6"/>
    <rect x="22" y="24" width="6" height="8" rx="1" fill={secondary} opacity=".4"/>
    <rect x="30" y="24" width="6" height="8" rx="1" fill={primary} opacity=".3"/>
    <rect x="6" y="36" width="36" height="3" rx="1.5" fill={secondary}/>
    <rect x="20" y="36" width="8" height="6" rx="1" fill={secondary} opacity=".5"/>
  </svg>
);
