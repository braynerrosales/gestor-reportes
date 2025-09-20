📊 Gestor de Reportes QA

Aplicación web para la gestión de reportes de QA. Permite consultar, editar, eliminar y agregar reportes, además de exportarlos a Excel. Incluye soporte para modo claro/oscuro con animación radial 🌞🌙.

🚀 Funcionalidades

📑 Carga y visualización de reportes desde un dataset JSON.

🔍 Filtros por Proyecto y Solicitud.

✏️ Edición en línea del campo Resultado.

🟢 Campo de Estado con valores: Pendiente, Reportado, Resuelto.

➕ Agregar nuevos reportes.

❌ Eliminar reportes existentes.

📤 Exportar los reportes a Excel (.xlsx).

🌓 Modo claro/oscuro con animación radial.

💻 Diseño responsivo y moderno con Bootstrap.

📂 Estructura del proyecto

GESTOR-REPORTES/
├── public/
│ ├── index.html # Interfaz principal
│ ├── styles.css # Estilos claros/oscuro
│ ├── script.js # Lógica frontend
│ └── xlsx.full.min.js # Librería para exportar a Excel
├── data.json # Dataset estático de reportes
├── server.js # Servidor backend con Node.js + Express
├── package.json # Dependencias y scripts
└── README.md # Este archivo

⚙️ Requisitos previos

Node.js (v16 o superior)

npm

📥 Instalación y ejecución local

Clona este repositorio:
git clone https://github.com/TU-USUARIO/gestor-reportes.git

cd gestor-reportes

Instala dependencias:
npm install

Inicia el servidor:
npm run dev # con nodemon (desarrollo)
npm start # producción

Abre en el navegador:
http://localhost:3000

🌍 Despliegue en la nube

Puedes desplegar este proyecto en plataformas como:

Render (https://render.com
)

Railway (https://railway.app
)

Heroku (https://www.heroku.com
)

Comandos de despliegue (Render/Railway):

Build Command: npm install

Start Command: npm start

✨ Tecnologías utilizadas

Frontend: HTML5, CSS3, JavaScript, Bootstrap 5

Backend: Node.js, Express

Extras: SheetJS/xlsx para exportar a Excel

👨‍💻 Autor

Desarrollado por Brayner ✨
