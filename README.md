## Healthcare Symptom Checker (Educational Only)

Full‑stack demo that lets a user type free‑text symptoms and get **LLM‑generated possible conditions and next steps**, with strong safety disclaimers. Built with **React + Tailwind CSS** (frontend), **Node.js + Express** (backend), and **MongoDB** (for optional query history).

### 1. High‑level architecture

- **client**: React + Vite + Tailwind single‑page app with a symptom form and results panel.
- **server**: Express API that:
  - validates input,
  - calls Google Gemini LLM,
  - adds mandatory educational disclaimers,
  - optionally saves query history to MongoDB.
- **MongoDB**: stores `SymptomQuery` documents (symptoms, metadata, and LLM response).

### 2. Safety model (important for evaluation)

- The LLM is instructed as a **“cautious healthcare educator”** – it:
  - does **not** give diagnoses,
  - provides **possible explanations / categories only**,
  - always includes a **clear educational disclaimer**,
  - highlights **red‑flag / emergency signs** and what to do.
- The backend enforces:
  - minimum length for symptom description,
  - consistent disclaimer field in API responses.

### 3. Backend (server)

#### 3.1. Setup

```bash
cd server
npm install
cp .env.example .env   # on Windows: copy .env.example .env
```

Edit `.env`:

```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/health-symptom-checker
GEMINI_API_KEY=your_gemini_api_key_here
```

You can comment out or leave `MONGODB_URI` empty if you don’t want history persistence; the server will still run (it will just log a warning).

#### 3.2. Run the backend

```bash
cd server
npm run dev
```

The API will be available at `http://localhost:4000`:

- `GET /health` → health check
- `POST /api/check-symptoms` → main endpoint

**Request body (JSON):**

```json
{
  "symptomsText": "Throbbing headache on one side for 2 days, light sensitivity, mild nausea.",
  "age": 28,
  "sex": "female"
}
```

**Response (JSON, shape):**

```json
{
  "disclaimer": "This tool is for educational purposes only ...",
  "rawText": "LLM-generated content with possible conditions, red flags, and next steps..."
}
```

The raw text is formatted as plain Markdown‑like text for easy display.

### 4. Frontend (client)

#### 4.1. Setup

```bash
cd client
npm install
cp .env.example .env   # on Windows: copy .env.example .env
```

`.env`:

```env
VITE_API_BASE_URL=http://localhost:4000
```

#### 4.2. Run the frontend

```bash
cd client
npm run dev
```

Open the printed Vite URL in the browser (usually `http://localhost:5173`).

### 5. Frontend UX

- **Symptom text area**: user describes symptoms in natural language.
- **Optional fields**: age, sex toggle buttons.
- **Primary button**: “Check symptoms”, disabled while the LLM is thinking.
- **Inline disclaimer + red‑flag banner** always visible.
- **Result card**:
  - shows backend disclaimer at the top,
  - displays LLM text with possible conditions, red flags, and step‑by‑step next actions.

### 6. Data model (MongoDB)

Collection: `symptomqueries` (via `SymptomQuery` model)

Fields:

- `symptomsText: string`
- `age: number` (optional)
- `sex: string` (optional)
- `llmResponse: object` (contains disclaimer + rawText)
- `createdAt`, `updatedAt` (timestamps)

### 7. LLM prompt design

The backend sends a system + user prompt that enforces:

- non‑diagnostic, educational tone,
- list of **3–6 possible conditions / categories**,
- clear **red‑flag section**,
- simple **next steps**: self‑care, when/where to seek in‑person care, what information to take to a doctor.

You can adjust this in `server/src/index.js` if you want to experiment with different prompting strategies.


