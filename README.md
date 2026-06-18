# Swap-coin API

API REST para la plataforma Swap-coin. Permite la gestión de usuarios, billeteras (wallets), metas financieras, consulta de tasas de cambio y un chat interactivo.

Proyecto construido con Node.js, Express y PostgreSQL.

## URL Base

Link del proyecto desplegado:
[https://coin-swap-backend-production.up.railway.app]

Todas las rutas de la aplicación están bajo `/api`.

## Tecnologías

- **Backend:** Node.js con Express
- **Base de datos:** PostgreSQL
- **ORM/Cliente DB:** pg (node-postgres)
- **Autenticación:** JWT (JSON Web Tokens)
- **Integraciones Externas:** AWS SES, Gemini API, Exchange-Rate API
- **Seguridad:** express-rate-limit, bcrypt
- **Testing:** Vitest y Supertest
- **Documentación:** OpenAPI 3.0 con Swagger UI

---

## Ejecutar Localmente

Para correr el proyecto en tu entorno local:

1. **Clona el repositorio**
```bash
git clone https://github.com/swapcoinn-droid/Coin-Swap-Backend.git
cd Coin-Swap-Backend
```
2. **Instala las dependencias:**
```bash
npm install
```
3. **Configura las variables de entorno** (ver sección abajo).

4. **Configurar la base de datos:**

```bash
# Conectar a PostgreSQL
psql -U postgres

# Crear la base de datos
CREATE DATABASE swap_coin_db;

# Ejecutar el script de setup
psql -U postgres -d swap_coin_db -f db/setup.sql
```

**!** Para ejecutar los tests:

```bash
npm test
```

5. **Inicia el servidor:**
   ```bash
   npm run dev
   ```

La API estará disponible en: `http://localhost:3000`

---

## Environment Variables (Variables de Entorno)

Utiliza el archivo `.env.example` de patrón y renómbralo a `.env`. Completa las siguientes variables con tus datos:

```env
# Servidor
PORT=3000
NODE_ENV=development
DATABASE_URL=tu_url_de_railway

# Base de Datos (PostgreSQL)
DB_USER=postgres
DB_HOST=localhost
DB_NAME=swap_coin_db
DB_PASSWORD=tu_contraseña_aqui
DB_PORT=5432

# Autenticación (JWT)
JWT_SECRET=tu_jwt_secret_aqui

# Exchange-Rate API
EXCHANGE_API_KEY=tu_token_aqui

# Gemini API
GEMINI_API_KEY=tu_api_key_aqui

# AWS SES
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=tu_llave_de_acceso_aqui
AWS_SECRET_ACCESS_KEY=tu_llave_secreta_aqui
SES_FROM_EMAIL=noreply@tudominio.com
```

---
## Deployar en Railway

1. **Crear un nuevo proyecto en Railway, seleccionar database y PostgreSQL.**

2. **Cargar base de datos manualmente utilizando los archivos `setup.sql` y luego `seed.sql` o en bash utilizar:**

```bash
postgresql://postgres:POSTGRES_PASSWORD@public_networking.proxy.rlwy.net:12345/railway

# Modificar el 'POSTGRES_PASSWORD' por su variable
# Modificar 'public_networking.proxy.rlwy.net:12345' por su URL en Setting > Networking > Public Networking
```

**!** Luego cargar los datos de `setup.sql` y luego `seed.sql`

3. **Agregar nuevo servicio del GitHub Repository del Proyecto a utilizar.**

4. **Railway detecta Node.js automaticamente y ejecuta `npm install` y `npm start`.**

5. **En Variables del repositorio actualizar:**

    - `DATABASE_URL` = (DATABASE_URL de la variable de base de datos de Railway)
    - `NODE_ENV` = `production`
    - `JWT_SECRET` = (utiliza un código de 64 caracteres alfanuméricos, sin espacios)
    - `EXCHANGE_API_KEY` = (Consigue tu API key en [Exchange-Rate API](https://www.exchangerate-api.com/docs/free))
    - `GEMINI_API_KEY` = (Consigue tu API key en [Gemini API](https://ai.google.dev/gemini-api))
    - `AWS_REGION` = (Ingresa la región de tu cuenta de AWS SES)
    - `AWS_ACCESS_KEY_ID` =
    - `AWS_SECRET_ACCESS_KEY` = (Consigue tu API key en [AWS](https://aws.amazon.com/ses/))
    - `SES_FROM_EMAIL` = (Ingresa el correo electrónico de tu cuenta de AWS SES)

6. **Desplegar y esperar el build.**

**!** Para generar una URL pública, en el GitHub Repository abrir Settings > Networking > Generate Domain

**URLs:**
- **Internal URL**: comunicacion interna entre servicios (no publica).
- **Public URL**: URL publica para navegador o Postman.
---

## Catálogo de Endpoints

### Auth
- `POST /api/auth/register` - Registrar un nuevo usuario
- `POST /api/auth/login` - Iniciar sesión

### Wallet
- `GET /api/wallet/` - Obtener el balance y datos de la billetera
- `POST /api/wallet/deposit` - Depositar fondos en la billetera
- `POST /api/wallet/withdraw` - Retirar fondos de la billetera
- `POST /api/wallet/exchange` - Intercambiar fondos entre distintas monedas
- `GET /api/wallet/transactions` - Obtener historial de transacciones

### Rates
- `GET /api/rates/` - Obtener las tasas de cambio actuales (USD, COP, EUR)

### Goals
- `GET /api/goals/` - Obtener la lista de metas de ahorro del usuario
- `POST /api/goals/` - Crear una nueva meta de ahorro
- `POST /api/goals/:id/contribute` - Aportar fondos a una meta específica
- `POST /api/goals/:id/withdraw` - Retirar fondos de una meta específica
- `PATCH /api/goals/:id` - Actualizar información de una meta
- `DELETE /api/goals/:id` - Eliminar una meta de ahorro

### Chat
- `POST /api/chat/` - Interacción con la inteligencia artificial (Gemini) para asistencia y consultas

---

## Documentación Completa

La documentación interactiva completa de la API está disponible en:

[https://coin-swap-backend-production.up.railway.app/api-docs]

Ahí puedes:
- Ver todos los endpoints con detalles completos
- Probar endpoints directamente desde el navegador
- Ver esquemas de datos y ejemplos
- Entender parámetros requeridos y de autenticación

---

## Ejemplos de Uso

### 1. Auth: Registro e Inicio de Sesión

**Registro:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "María García",
    "email": "maria@example.com",
    "password": "mi_password_seguro"
  }'
```

**Respuesta:**
```json
{
  "id": 7,
  "name": "María García",
  "email": "maria@example.com",
  "created_at": "2025-06-01T14:23:00Z"
}
```

**Iniciar Sesión (Login):**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "maria@example.com",
    "password": "mi_password_seguro"
  }'
```

**Respuesta (Login):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "María García",
    "email": "maria@example.com"
  }
}
```

### 2. Wallet: Consultar Balance, Depositar e Intercambiar

**Consultar Balance:**
```bash
curl -X GET http://localhost:3000/api/wallet \
  -H "Authorization: Bearer tu_token_jwt_aqui"
```

**Respuesta:**
```json
{
  "walletId": 3,
  "balances": [
    {
      "currency": "COP",
      "name": "Peso colombiano",
      "symbol": "$",
      "amount": 250000.00,
      "estimatedCOP": 250000.00
    }
  ],
  "totalEstimatedCOP": 315400.00
}
```

**Depositar Fondos:**
```bash
curl -X POST http://localhost:3000/api/wallet/deposit \
  -H "Authorization: Bearer tu_token_jwt_aqui" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50000,
    "currency": "COP"
  }'
```

**Respuesta:**
```json
{
  "currency": "COP",
  "deposited": 50000,
  "newBalance": 300000
}
```

**Intercambiar Monedas:**
```bash
curl -X POST http://localhost:3000/api/wallet/exchange \
  -H "Authorization: Bearer tu_token_jwt_aqui" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "USD",
    "to": "COP",
    "amount": 100
  }'
```

**Respuesta:**
```json
{
  "from": {
    "currency": "USD",
    "debited": 100
  },
  "to": {
    "currency": "COP",
    "credited": 415050
  },
  "appliedRate": 4150.50
}
```

### 3. Rates: Consultar Tasas de Cambio

```bash
curl -X GET http://localhost:3000/api/rates
```

**Respuesta:**
```json
{
  "base": "USD",
  "rates": {
    "USD": 1,
    "COP": 4150.50,
    "EUR": 0.92
  },
  "updatedAt": "2025-06-01T15:00:00Z"
}
```

### 4. Goals: Crear y Aportar a Metas

**Crear una Meta:**
```bash
curl -X POST http://localhost:3000/api/goals \
  -H "Authorization: Bearer tu_token_jwt_aqui" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Viaje a Europa",
    "targetAmount": 3000,
    "currency": "USD",
    "targetDate": "2026-07-01"
  }'
```

**Respuesta:**
```json
{
  "id": 5,
  "name": "Viaje a Europa",
  "targetAmount": 3000,
  "currentAmount": 0,
  "progress": 0,
  "status": "active",
  "completed": false
}
```

**Aportar a una Meta:**
```bash
curl -X POST http://localhost:3000/api/goals/5/contribute \
  -H "Authorization: Bearer tu_token_jwt_aqui" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 250
  }'
```

**Respuesta:**
```json
{
  "id": 5,
  "name": "Viaje a Europa",
  "targetAmount": 3000,
  "currentAmount": 250,
  "progress": 8.33,
  "status": "active",
  "completed": false
}
```

### 5. Chat: Interactuar con SwapBot (Gemini)

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer tu_token_jwt_aqui" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "¿Cómo deposito fondos?",
    "history": []
  }'
```

**Respuesta:**
```json
{
  "reply": "¡Hola, aventurero! Puedes depositar desde /wallet/deposit.",
  "history": [
    {"role": "user", "text": "¿Cómo deposito fondos?"},
    {"role": "model", "text": "¡Hola, aventurero! Puedes depositar desde /wallet/deposit."}
  ]
}
```

---

## Solución de problemas comúnes

- **Error de conexión a la base de datos:** Verifica que PostgreSQL esté corriendo en tu máquina y que las credenciales en el archivo `.env` (`DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`) sean las correctas.
- **La API devuelve error 401 Unauthorized:** Asegúrate de estar enviando el token JWT correcto en la cabecera `Authorization: Bearer <token>`.
- **Los correos no se envían:** Verifica que tus credenciales de AWS (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) tengan los permisos necesarios para SES y que los correos origen/destino estén verificados en el sandbox de AWS (si aplica).
- **El servidor no arranca por el puerto ocupado:** Cambia la variable `PORT` en tu archivo `.env` por otro puerto disponible (ej: 3001) o cierra el proceso que está utilizando el puerto 3000.
