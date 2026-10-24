<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Sifted

Sifted is a screening platform for undergraduates applying to graduate programs: professors build assessments (from their own questions, a shared question bank, or AI-generated questions), assign them to students, and review the graded results.

This contains everything you need to run the app locally.

View your app in AI Studio: https://ai.studio/apps/46e38ab8-3fb3-4373-9cd0-20eba0866007

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
   (Optional — without a key the app uses its built-in grading and template questions. Set `GEMINI_MODEL` to override the model name.)
3. Run the app:
   `npm run dev`

App data is stored in `database.json` in the project folder (created on first run). An admin can restore the sample data from the Admin portal.
