# Relationship push delivery setup

The function accepts only database-webhook requests carrying the private `x-relationship-push-secret` header. It re-reads the notification, verifies that the actor and recipient are still members of the same couple, checks recipient preferences, and sends generic lock-screen text through Expo Push Service.

## Deploy

1. Link the Supabase CLI to the existing project and apply the migration:

   ```sh
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

2. Set `RELATIONSHIP_PUSH_WEBHOOK_SECRET` and the server-only `SUPABASE_SERVICE_ROLE_KEY` as Supabase Edge Function secrets. Never put either value in Expo app configuration or client environment variables.

   ```sh
   npx supabase secrets set RELATIONSHIP_PUSH_WEBHOOK_SECRET=YOUR_RANDOM_SECRET SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
   ```

3. Deploy the function:

   ```sh
   npx supabase functions deploy send-relationship-push
   ```

4. In Supabase Dashboard, create a Database Webhook for `public.relationship_notifications`, event `INSERT`, targeting:

   ```text
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-relationship-push
   ```

   Add this request header:

   ```text
   x-relationship-push-secret: THE_SAME_RANDOM_SECRET
   ```

   The webhook JSON body must include the inserted row in `record` (the standard Supabase database-webhook payload).

## Expo device setup

1. Create/link the EAS project and put its project ID at `expo.extra.eas.projectId` in `app.json`.
2. Configure Android FCM v1 and iOS APNs credentials for that EAS project. The app must run in a development or production build; Expo Go does not support remote push delivery on Android.
3. Install a development build, open Settings → Notifications, grant permission, and enable push.
4. Verify a message or shared check-in creates a row in `relationship_notifications`, then confirm the paired device receives a generic push. Push delivery is not complete until this is tested on real configured devices.
