# 🚀 AutoDocs: Autonomous Codebase Documenter

**AI-powered GitHub Repository Documentation Generator**

AutoDocs is a full-stack application that automatically analyzes public GitHub repositories and generates professional, AI-assisted documentation. By leveraging Large Language Models (LLMs), the application transforms an existing codebase into structured technical documentation, including an AI-generated README, folder-level summaries, and file-level explanations—all packaged into a downloadable ZIP archive.

---

## 🌐 Live Deployment

**Frontend:**
https://autodocs-frontend-eight.vercel.app

**Backend API:**
https://autodocs-backend-s78k.onrender.com/health

---

# 📖 Overview

Understanding an unfamiliar codebase is one of the most time-consuming tasks for developers. AutoDocs automates this process by cloning a GitHub repository into a temporary workspace, intelligently selecting the most important files, generating documentation using Groq-hosted LLMs, and presenting the results through a modern web interface.

The application is designed around a clean separation between frontend presentation, backend orchestration, repository analysis, AI generation, and temporary resource management.

---

# ✨ Core Features

### 🔹 GitHub Repository Cloning

* Accepts any valid public GitHub repository URL.
* Clones repositories into isolated temporary directories.
* Automatically cleans up cloned repositories after processing.

---

### 🔹 Intelligent Repository Analysis

AutoDocs performs structural analysis before invoking the LLM.

It automatically:

* Detects important source files
* Identifies configuration files
* Prioritizes entry points
* Classifies documentation files
* Ignores unnecessary generated assets

This significantly reduces token usage while preserving documentation quality.

---

### 🔹 Multi-Tier AI Documentation

AutoDocs generates documentation at multiple abstraction levels.

#### 📄 AI README

A project-level overview containing:

* Project purpose
* Architecture overview
* Technology stack
* Installation instructions
* Usage guide

---

#### 📂 Folder Summaries

Every important folder receives an AI-generated summary explaining:

* Folder responsibility
* Relationships with other modules
* High-level workflow

---

#### 📃 File Explanations

Key files are individually documented with:

* Purpose
* Responsibilities
* Major classes/functions
* Internal workflow
* Dependencies

---

### 🔹 Downloadable ZIP Archive

Once generation completes, AutoDocs automatically packages all generated documentation into a downloadable ZIP archive.

Current archive includes:

* README.md
* Scan Summary
* Folder Structure

The packaging service is intentionally modular and designed to support richer documentation bundles in future iterations.

---

### 🔹 Temporary Workspace Management

Repositories are cloned into isolated temporary directories instead of permanent storage.

This approach:

* Prevents disk accumulation
* Improves security
* Keeps deployments stateless
* Fits cloud-native environments

---

### 🔹 Automatic Background Cleanup

The backend runs an asynchronous cleanup loop every **30 minutes**.

Expired jobs are automatically removed by:

* Deleting temporary cloned repositories
* Clearing expired in-memory job entries
* Removing cached ZIP buffers
* Reclaiming server memory

This enables long-running deployments without resource leakage.

---

# 🏗 Architecture

```
                React + Vite Frontend
                         │
                         ▼
                FastAPI REST Backend
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
 Repository Clone   Repository Scan   AI Generation
        │                │                │
        └────────────────┼────────────────┘
                         ▼
                Documentation Builder
                         │
                         ▼
                 ZIP Packaging Service
                         │
                         ▼
                 Download to User
```

---

# 🛠 Technology Stack

## Frontend

| Technology   | Purpose                                                    |
| ------------ | ---------------------------------------------------------- |
| React 19     | Component-based UI architecture                            |
| Vite         | Lightning-fast development and optimized production builds |
| Tailwind CSS | Utility-first responsive styling                           |
| Axios        | API communication                                          |
| React Router | Client-side routing                                        |
| Vercel       | Static frontend hosting with global CDN                    |

### Why this stack?

React and Vite provide a lightweight, high-performance frontend capable of handling long-running AI operations while maintaining a responsive user experience. Tailwind CSS enables rapid UI development with consistent design patterns, and Vercel offers seamless deployment and edge delivery for static assets.

---

## Backend

| Technology | Purpose                                |
| ---------- | -------------------------------------- |
| FastAPI    | High-performance asynchronous REST API |
| Groq API   | LLM-powered documentation generation   |
| Uvicorn    | ASGI application server                |
| GitPython  | Repository cloning                     |
| Pydantic   | Data validation                        |
| Render     | Cloud deployment                       |

### Why this stack?

FastAPI's asynchronous architecture is ideal for orchestrating repository analysis and AI requests. Groq provides low-latency inference for documentation generation, while Render offers a simple cloud deployment workflow suitable for lightweight AI-powered services.

---

# ⚙ Environment Configuration

## Backend (`backend/.env`)

```env
ENV=development

HOST=0.0.0.0
PORT=8000

FRONTEND_ORIGIN=http://localhost:5173

GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile

MAX_REPO_SIZE_MB=50
MAX_FILES_TO_ANALYSE=15

JOB_TTL_SECONDS=3600
```

---

## Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:8000
```

---

# 🚀 Local Setup

## 1. Clone Repository

```bash
git clone https://github.com/<username>/AutoDocs.git
cd AutoDocs
```

---

## 2. Backend Setup

Navigate to the backend:

```bash
cd backend
```

Create a virtual environment:

```bash
python -m venv venv
```

Activate it.

### Windows

```bash
venv\Scripts\activate
```

### Linux / macOS

```bash
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the FastAPI server:

```bash
uvicorn main:app --reload
```

Backend will be available at:

```
http://localhost:8000
```

---

## 3. Frontend Setup

Navigate to the frontend:

```bash
cd ../frontend
```

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Frontend will be available at:

```
http://localhost:5173
```

---

# 📦 Project Structure

```
AutoDocs
│
├── backend
│   ├── generators
│   ├── models
│   ├── routers
│   ├── services
│   ├── utils
│   ├── config.py
│   └── main.py
│
├── frontend
│   ├── src
│   ├── public
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

---

# 🛡 System Limitations & Guardrails

To ensure reliable operation on free-tier cloud infrastructure and protect against misuse, AutoDocs includes several built-in safeguards.

## Repository Size & File Quotas

Repository analysis is intentionally bounded through configurable limits.

* **Maximum Repository Size (`MAX_REPO_SIZE_MB`)**: Limits the total size of repositories that can be cloned and processed. This prevents excessive storage usage, long clone times, and oversized AI requests.

* **Maximum Files Analysed (`MAX_FILES_TO_ANALYSE`)**: Rather than processing every file, AutoDocs intelligently prioritizes the most relevant files (entry points, configuration files, core modules, documentation, etc.). This keeps token consumption predictable while maintaining documentation quality.

These limits are configurable through environment variables and can be adjusted depending on deployment resources.

---

## Rate Limiting (Groq API)

Large Language Models on the Groq free tier enforce request-per-minute (RPM) and token-per-minute (TPM) quotas.

AutoDocs is designed to work within these constraints by:

* Prioritizing only the most important files for AI analysis.
* Minimizing unnecessary LLM requests through repository pre-processing.
* Performing AI generation in controlled stages rather than sending the entire repository at once.
* Returning graceful error messages when upstream API limits are reached, allowing users to retry instead of experiencing application failures.

This architecture helps maintain service reliability while respecting provider-imposed limits.

---

## Server Cold Starts

The backend is deployed on **Render's free tier**, which automatically suspends inactive services after periods of inactivity.

As a result:

* The **first request** after inactivity may experience a **30–50 second startup delay** while the container wakes up.
* Subsequent requests are processed normally with significantly lower latency while the service remains active.

This behavior is expected for free-tier deployments and does not affect application functionality.

---

# 🔮 Future Improvements

* Complete ZIP packaging with folder and file documentation.
* Repository history and document caching.
* Private GitHub repository support.
* Multi-provider LLM support.
* Authentication and user dashboards.
* Incremental documentation regeneration.
* Documentation versioning.
* Mermaid architecture diagrams.
* Searchable generated documentation.

---

# 👨‍💻 Author

**Gautam Rai**

AutoDocs was developed as a portfolio project showcasing modern full-stack engineering practices, cloud-native deployment, asynchronous backend architecture, AI integration, and automated software documentation generation.
