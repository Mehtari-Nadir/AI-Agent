# AI Agent Bun - HR Chatbot

An intelligent HR chatbot built with LangChain, LangGraph, and Bun runtime. This AI agent can answer HR-related queries by searching through employee data stored in MongoDB Atlas with vector search capabilities.

## Features

- 🤖 **AI-powered HR assistant** using Google Gemini 2.0 Flash
- 🔍 **Vector search** with Cohere embeddings for intelligent employee data retrieval
- 💾 **Persistent conversation memory** using MongoDB
- 🌐 **REST API** with Express.js for easy integration
- ⚡ **Fast runtime** powered by Bun

## Prerequisites

Before running this project, make sure you have:

- [Bun](https://bun.sh) installed (v1.2.18 or later)
- [MongoDB Atlas](https://www.mongodb.com/atlas) account and cluster
- [Google AI API](https://ai.google.dev/) key for Gemini
- [Cohere API](https://cohere.ai/) key for embeddings

## Setup

### 1. Install Dependencies

```bash
bun install
```

### 2. Environment Configuration

Create a `.env` file in the root directory with the following variables:

```env
# MongoDB Atlas connection string
MONGODB_ATLAS_URI=mongodb+srv://username:password@cluster.mongodb.net/

# Google AI API key for Gemini
GOOGLE_API_KEY=your_google_ai_api_key

# Cohere API key for embeddings
COHERE_API_KEY=your_cohere_api_key

# Server port (optional, defaults to 3000)
PORT=3000
```

### 3. Database Setup

Before running the agent, you need to seed the database with employee data:

```bash
bun run seed
```

This will:
- Generate synthetic employee data using AI
- Create vector embeddings for each employee
- Store the data in MongoDB Atlas with vector search index

### 4. MongoDB Atlas Vector Search Index

Create a vector search index in your MongoDB Atlas cluster:

1. Go to your MongoDB Atlas dashboard
2. Navigate to your cluster → Browse Collections
3. Select the `hr_database` database and `employees` collection
4. Go to Search Indexes tab
5. Create a new Search Index with the following configuration:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1024,
      "similarity": "cosine"
    }
  ]
}
```

Name the index: `vector_index`

## Running the Application

### Start the Server

```bash
bun run start
```

Or for development with auto-reload:

```bash
bun run dev
```

The server will start on `http://localhost:3000` (or your specified PORT).

### API Endpoints

#### Start a new conversation
```bash
POST /chat
Content-Type: application/json

{
  "message": "Tell me about John Doe's performance reviews"
}
```

#### Continue an existing conversation
```bash
POST /chat/:threadId
Content-Type: application/json

{
  "message": "What are his current skills?"
}
```

## Usage Examples

### Using cURL

**Start a new conversation:**
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Who are the software engineers in the company?"}'
```

**Continue the conversation:**
```bash
curl -X POST http://localhost:3000/chat/1734567890123 \
  -H "Content-Type: application/json" \
  -d '{"message": "What are their skill sets?"}'
```

### Example Queries

- "Show me all employees in the Engineering department"
- "Who reports to Sarah Johnson?"
- "Find employees with Python skills"
- "What are the recent performance reviews for remote workers?"
- "List employees working from the New York office"

## Project Structure

```
src/
├── index.ts              # Express server and API endpoints
├── schema.ts             # Employee data schema definitions
├── seed-database.ts      # Database seeding script
├── agents/
│   └── agent.ts         # LangGraph agent implementation
└── prompts/
    ├── prompt-1.txt     # System prompts
    └── prompt-2.txt
```

## How It Works

1. **Vector Search**: Employee data is embedded using Cohere's `embed-english-v3.0` model
2. **AI Agent**: Google Gemini 2.0 Flash processes queries and uses tools to search the database
3. **Memory**: Conversation history is persisted in MongoDB using LangGraph checkpointing
4. **Tool Integration**: The agent uses a custom `employee_lookup` tool to query the vector store

## Development

### Available Scripts

- `bun run start` - Start the production server
- `bun run dev` - Start the development server with auto-reload
- `bun run seed` - Seed the database with synthetic employee data
- `bun run build` - Build the application for production
- `bun run type-check` - Run TypeScript type checking

This project was created using `bun init` in bun v1.2.18. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details
