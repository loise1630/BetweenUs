# Between Us — restored project

This is a clean reconstruction of the deleted BetweenUs project based on the latest saved conversation code and database architecture.

## Important
Your Supabase database is separate from this folder. If the existing Between Us Supabase project/database was NOT deleted, do not reset or recreate the database.

The app expects the existing RPCs:
- get_my_couple
- create_pairing_invite
- redeem_pairing_code
- recover_account_by_code
- get_period_dashboard
- save_period_settings
- create_period_log
- update_period_log
- delete_period_log
- save_period_symptom
- delete_period_symptom

Anonymous sign-ins must remain enabled in Supabase Authentication.

## Setup
1. Copy `.env.example` to `.env`.
2. Put your Supabase URL and publishable/anon key in `.env`.
3. Run `npm install`.
4. Run `npx expo start -c`.

## New main-page behavior
Who's Using -> either Boyfriend or Girlfriend -> `/period`.
The Period/Cycle dashboard is now the shared main home. Feature buttons live underneath it.
