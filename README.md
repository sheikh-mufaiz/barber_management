# Barber Management

## Local Setup

Backend:

```bash
cd backend
npm install
npm start
```

Frontend:

```bash
cd frontend
cp .env.example .env.local
npm install
npm start
```

## Required Backend Environment

- `MONGO_URI`: MongoDB connection string.
- `JWT_SECRET`: long random secret used to sign login tokens.

The backend exits on startup if either value is missing.

## Required Frontend Environment

- `REACT_APP_API_URL`: API base URL, for example `http://localhost:5000/api` locally or your hosted backend URL in production.

## Deployment Notes

- Backend now respects `PORT` and includes a Vercel-compatible entrypoint in `backend/api/index.js`.
- Frontend now reads `REACT_APP_API_URL` instead of assuming `localhost`.
- A real hosted deployment still needs a deployment provider plus remote environment variables for `MONGO_URI`, `JWT_SECRET`, and `REACT_APP_API_URL`.

## Tests

```bash
cd backend
npm test
```

```bash
cd frontend
npm test -- --watchAll=false
```
