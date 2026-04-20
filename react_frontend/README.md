# React Frontend

Separate React + Vite frontend for Hagbad.

It runs on port `3000` and is meant to work with either backend in this repo:

- `backend/` (FastAPI)
- `sppring_boot_backend/` (Spring Boot)

## What is implemented

- landing page styled to match the static frontend
- register and login pages with the same visual layout
- dashboard page with the same workspace shell and quick links
- my groups page
- explore groups page
- join by invite code from the my groups page
- add group page with live card preview
- group detail dashboard
- profile view and update
- password update
- logout
- shared session storage keys with the static frontend

The React app now reuses the same copied assets from `frontend/` so the main UI style, icons, images, and page shell match the static frontend closely.

## Ubuntu setup

This is the shortest recommended path on Ubuntu or WSL.

### 1. Install `curl` if needed

```bash
sudo apt update
sudo apt install -y curl build-essential
```

### 2. Install `nvm`

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
source ~/.bashrc
command -v nvm
```

If the last command prints `nvm`, you are ready.

### 3. Install Node for this project

```bash
cd /home/dhiblaawe/Projects/hagbad-v2/react_frontend
nvm install
nvm use
node -v
npm -v
```

This project includes `.nvmrc`, so `nvm install` will install the right Node version automatically.

### 4. Create local config

```bash
cp .env.example .env.local
```

Default local config:

```env
VITE_API_BASE_URL=http://localhost:8000
```

That is correct when either backend is running on port `8000`.

### 5. Install project packages

```bash
npm install
```

This step is required.

Without it, `npm run dev` will fail with:

```text
sh: 1: vite: not found
```

That error means Node is installed, but the project dependencies have not been installed yet.

### 6. Start one backend

Only one backend should run on port `8000` at a time.

#### FastAPI backend

```bash
cd /home/dhiblaawe/Projects/hagbad-v2/backend
source venv/bin/activate
uvicorn main:app --reload
```

#### Spring Boot backend

If Maven is not installed yet:

```bash
sudo apt update
sudo apt install -y maven
```

Then run:

```bash
cd /home/dhiblaawe/Projects/hagbad-v2/sppring_boot_backend
mvn spring-boot:run
```

### 7. Run the React frontend

Open a new terminal:

```bash
cd /home/dhiblaawe/Projects/hagbad-v2/react_frontend
nvm use
npm run dev
```

It should start at:

```text
http://localhost:3000
```

## Exact command order

If you want the straight sequence with no extra explanation:

```bash
sudo apt update
sudo apt install -y curl build-essential
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
source ~/.bashrc
cd /home/dhiblaawe/Projects/hagbad-v2/react_frontend
nvm install
nvm use
cp .env.example .env.local
npm install
npm run dev
```

## Common issue

### `vite: not found`

Run:

```bash
cd react_frontend
nvm use
npm install
npm run dev
```

## Build

```bash
cd react_frontend
nvm use
npm run build
```

Production files will be in `react_frontend/dist/`.
