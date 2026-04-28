# EduTrack From-Scratch Deployment

Fast path for a clean production deploy:
- Frontend: `edutrack-web`
- Backend: `edutrack-api`
- Database: MongoDB Atlas

## 1) Create MongoDB Atlas
1. Create a free Atlas cluster.
2. Create a database user.
3. Allow network access for the deployment while testing.
4. Copy the SRV connection string.

If the MongoDB password contains special characters such as `@`, URL-encode them in the URI. For example, `@` becomes `%40`.

## 2) Deploy the repo on Render
1. Push this repo to GitHub.
2. In Render, create a new Blueprint.
3. Select this repository.
4. Render reads `render.yaml` and creates both services.

## 3) Configure backend env vars
Set these on `edutrack-api`:
- `MONGO_URI`: your Atlas URI
- `FRONTEND_ORIGIN`: the frontend URL Render gives you, for example `https://edutrack-web.onrender.com`
- `FRONTEND_ORIGINS`: optional comma-separated extra origins
- `JWT_SECRET`: keep the generated value or use your own strong secret
- `REQUIRE_MONGO_IN_PROD=true`
- `AUTO_SEED_ON_EMPTY_DB=true`

## 4) Configure frontend env vars
Set this on `edutrack-web`:
- `VITE_API_BASE_URL`: your backend URL, for example `https://edutrack-api.onrender.com`

## 5) Deploy and verify
1. Trigger the initial deploy.
2. Open the frontend URL.
3. Check backend health at `/api/health`.
4. Create or log in to a user, then refresh the page.
5. If the data survives refresh, MongoDB persistence is working.

## 6) Local safety
The repo now ignores `.env` files by default so local secrets are not committed by accident.
