import React from "react";
import Box from "@mui/material/Box";

interface PauloFreireAvatarProps {
	size?: number;
	animated?: boolean;
}

/**
 * Avatar vectorial estilizado de Paulo Freire (lentes redondos, barba blanca y calidez pedagógica).
 */
export default function PauloFreireAvatar({
	size = 48,
	animated = false,
}: PauloFreireAvatarProps) {
	return (
		<Box
			sx={{
				width: size,
				height: size,
				borderRadius: "50%",
				overflow: "hidden",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
				boxShadow: "0 2px 8px rgba(30, 58, 138, 0.25)",
				transition: animated ? "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)" : "none",
				"&:hover": animated
					? {
							transform: "scale(1.08) rotate(3deg)",
						}
					: {},
			}}
		>
			<svg
				width={size}
				height={size}
				viewBox="0 0 100 100"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				style={{ display: "block" }}
			>
				{/* Fondo circular interior suave */}
				<circle cx="50" cy="50" r="48" fill="#1e3a8a" />
				<circle cx="50" cy="50" r="46" fill="#2563eb" opacity="0.35" />

				{/* Torso / Saco marrón pedagógico */}
				<path
					d="M18 95 C 22 75, 34 70, 50 70 C 66 70, 78 75, 82 95 Z"
					fill="#475569"
				/>
				{/* Camisa y cuello */}
				<path d="M42 70 L50 82 L58 70 Z" fill="#f8fafc" />
				<path d="M47 80 L50 95 L53 80 Z" fill="#cbd5e1" />

				{/* Cuello */}
				<rect x="44" y="60" width="12" height="14" rx="3" fill="#fed7aa" />

				{/* Cabeza / Rostro */}
				<ellipse cx="50" cy="46" rx="21" ry="24" fill="#fed7aa" />

				{/* Pelo canoso lateral y patillas */}
				<path
					d="M27 46 C 26 36, 32 25, 42 22 C 34 26, 30 36, 31 46 Z"
					fill="#e2e8f0"
				/>
				<path
					d="M73 46 C 74 36, 68 25, 58 22 C 66 26, 70 36, 69 46 Z"
					fill="#e2e8f0"
				/>
				{/* Cabello superior despejado / entradas características */}
				<path
					d="M36 25 C 44 20, 56 20, 64 25 C 59 22, 41 22, 36 25 Z"
					fill="#cbd5e1"
					opacity="0.8"
				/>

				{/* Ojos con mirada atenta y cálida */}
				<circle cx="41" cy="43" r="2.2" fill="#1e293b" />
				<circle cx="59" cy="43" r="2.2" fill="#1e293b" />
				{/* Cejas canosas pobladas */}
				<path
					d="M36 38 C 39 36, 44 37, 46 39"
					stroke="#e2e8f0"
					strokeWidth="2.4"
					strokeLinecap="round"
				/>
				<path
					d="M54 39 C 56 37, 61 36, 64 38"
					stroke="#e2e8f0"
					strokeWidth="2.4"
					strokeLinecap="round"
				/>

				{/* Lentes redondos icónicos de Paulo Freire */}
				<circle
					cx="41"
					cy="44"
					r="9"
					fill="none"
					stroke="#334155"
					strokeWidth="2.5"
				/>
				<circle
					cx="59"
					cy="44"
					r="9"
					fill="none"
					stroke="#334155"
					strokeWidth="2.5"
				/>
				{/* Puente de los lentes */}
				<path
					d="M50 43 L50 45"
					stroke="#334155"
					strokeWidth="2.5"
					strokeLinecap="round"
				/>
				{/* Patillas de los lentes */}
				<path d="M32 43 L27 41" stroke="#334155" strokeWidth="2" strokeLinecap="round" />
				<path d="M68 43 L73 41" stroke="#334155" strokeWidth="2" strokeLinecap="round" />
				{/* Reflejo de los lentes */}
				<path
					d="M36 40 C 37 38, 42 38, 44 40"
					stroke="#ffffff"
					strokeWidth="1.2"
					strokeLinecap="round"
					opacity="0.8"
				/>
				<path
					d="M54 40 C 55 38, 60 38, 62 40"
					stroke="#ffffff"
					strokeWidth="1.2"
					strokeLinecap="round"
					opacity="0.8"
				/>

				{/* Nariz afable */}
				<path
					d="M50 44 L48 51 C 49 53, 51 53, 52 51"
					stroke="#ea580c"
					strokeWidth="1.6"
					strokeLinecap="round"
					fill="none"
				/>

				{/* Barba y bigote blanco completo y frondoso */}
				<path
					d="M32 49 C 30 62, 36 78, 50 78 C 64 78, 70 62, 68 49 C 64 54, 58 56, 50 56 C 42 56, 36 54, 32 49 Z"
					fill="#f1f5f9"
				/>
				{/* Detalle bigote */}
				<path
					d="M40 55 C 44 54, 48 56, 50 58 C 52 56, 56 54, 60 55 C 57 58, 53 59, 50 59 C 47 59, 43 58, 40 55 Z"
					fill="#e2e8f0"
				/>
				{/* Sonrisa debajo del bigote */}
				<path
					d="M46 62 C 48 64, 52 64, 54 62"
					stroke="#cbd5e1"
					strokeWidth="1.5"
					strokeLinecap="round"
				/>
			</svg>
		</Box>
	);
}
