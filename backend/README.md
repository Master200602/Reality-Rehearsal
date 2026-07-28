# Reality Rehearsal Backend

This is the Express.js backend for the Reality Rehearsal AI-powered interview simulator.

## Setup

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Create a \`.env\` file in the root of the backend directory based on \`.env.example\`:
\`\`\`bash
cp .env.example .env
\`\`\`

3. Add your Gemini API key to the \`.env\` file. If you don't add one, the API endpoints will return mock data for testing purposes.

## Running the server

Development mode (with nodemon):
\`\`\`bash
npm run dev
\`\`\`

Production mode:
\`\`\`bash
npm start
\`\`\`

The server will run on \`http://localhost:5000\` by default.
