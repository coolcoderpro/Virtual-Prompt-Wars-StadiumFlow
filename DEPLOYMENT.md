# Deploying to Google Cloud Run

This guide will help you deploy your Next.js application to Google Cloud Run. I have already prepared the `Dockerfile` and updated `next.config.ts` for you.

## Prerequisites

1.  **Google Cloud SDK**: Ensure `gcloud` is installed and authenticated.
2.  **Project ID**: Replace `[PROJECT_ID]` with your actual Google Cloud Project ID.

## Deployment Steps

### 1. Build and Push with Cloud Build

Run this command in your project root to build the image and push it to Google Container Registry:

```bash
gcloud builds submit --tag gcr.io/[PROJECT_ID]/stadiumflow
```

*Note: Replace `[PROJECT_ID]` with your Google Cloud Project ID.*

### 2. Deploy to Cloud Run

Once the image is built, deploy it to Cloud Run:

```bash
gcloud run deploy stadiumflow \
  --image gcr.io/[PROJECT_ID]/stadiumflow \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "NEXT_PUBLIC_MAPS_KEY=[YOUR_MAPS_KEY],NEXT_PUBLIC_FIREBASE_API_KEY=[YOUR_FIREBASE_API_KEY],NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=virtualpromptwars.firebaseapp.com,NEXT_PUBLIC_FIREBASE_PROJECT_ID=virtualpromptwars,NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=virtualpromptwars.firebasestorage.app,NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=783087915415,NEXT_PUBLIC_FIREBASE_APP_ID=1:783087915415:web:385a6a164256b5a4e874d2,ADMIN_PASSCODE=hackathon123,GROQ_API_KEY=[YOUR_GROQ_API_KEY],GROQ_MODEL=llama-3.3-70b-versatile"
```

> [!IMPORTANT]
> **Firebase Service Account**: Since you are using a `service-account.json` file, you should either:
> 1.  Upload the JSON to Google Cloud Secret Manager and mount it as a file in Cloud Run.
> 2.  Alternatively, update your code to read the service account details from an environment variable (as a JSON string) and set it in the `--set-env-vars` flag.

### 3. Build-time Environment Variables

Next.js bakes `NEXT_PUBLIC_` variables into the JavaScript bundle at **build time**. To ensure these are available during the `npm run build` step inside the Docker container, you should create a `.env` file in the project root containing these values BEFORE running the build command.

## Summary of Changes Made
- Updated [next.config.ts](file:///c:/Users/majid/Documents/antigravity-hackthano/next.config.ts) to use `output: 'standalone'`.
- Created [.dockerignore](file:///c:/Users/majid/Documents/antigravity-hackthano/.dockerignore) to optimize build context.
- Created [Dockerfile](file:///c:/Users/majid/Documents/antigravity-hackthano/Dockerfile) for production-ready containerization.
