# MERN Stack RAG Chatbot

This project is a full-stack Retrieval-Augmented Generation (RAG) chatbot built using the MERN stack (MongoDB, Express.js, React, Node.js) and integrated with OpenAI's powerful language and embedding models.

The application allows users to ask questions about a specific knowledge base (in this case, insurance policy data), and it provides context-aware answers by retrieving relevant information from a vector database and using a Large Language Model (LLM) to generate a human-like response.

![Chatbot Demo](./demo.gif) <!-- You can create a GIF and add it here -->

+## Table of Contents

+- [Project Overview](#project-overview)
+- [How It Works (RAG Pipeline)](#how-it-works-rag-pipeline)
+- [Tech Stack](#tech-stack)
+- [Prerequisites](#prerequisites)
+- [Setup and Installation](#setup-and-installation)
+  - [1. Backend Setup](#1-backend-setup)
+  - [2. MongoDB Atlas Vector Search Setup](#2-mongodb-atlas-vector-search-setup)
+  - [3. Frontend Setup](#3-frontend-setup)
+- [Running the Application](#running-the-application)
+- [Project Structure](#project-structure)

+## Project Overview

+The goal of this project is to demonstrate a practical implementation of the RAG pattern. Instead of relying solely on the pre-trained knowledge of an LLM, the chatbot first retrieves relevant documents from a specialized database (MongoDB Atlas) and then uses those documents as context to generate a precise and accurate answer.

+This approach is highly effective for building chatbots that need to answer questions about private or domain-specific data.

+## How It Works (RAG Pipeline)

+The application follows a classic RAG pipeline, orchestrated by the Express.js backend:

+1.  **Seeding:** A script reads local data (`insurance_data.json`), generates vector embeddings for each record using OpenAI's `text-embedding-3-small` model, and stores them in a MongoDB Atlas collection.
+2.  **User Query:** The user asks a question through the React-based chat interface.
+3.  **Query Embedding:** The backend receives the query and uses the same OpenAI embedding model to convert the user's question into a vector.
+4.  **Retrieval:** The backend performs a **vector search** on the MongoDB Atlas collection to find the most semantically similar document chunks based on the query vector.
+5.  **Augmentation:** The content of the top matching documents is collected and compiled into a single `context` string.
+6.  **Generation:** This context, along with the original user query, is sent to an OpenAI chat model (`gpt-4o-mini`). The model is instructed to answer the question based *only* on the provided context.
+7.  **Response:** The final answer from the LLM is streamed back to the React frontend and displayed to the user with a typing effect.

+## Tech Stack

+| Category      | Technology                                       |
+| ------------- | ------------------------------------------------ |
+| **Frontend**  | React, Vite, Axios                               |
+| **Backend**   | Node.js, Express.js                              |
+| **Database**  | MongoDB Atlas (for Vector Search)                |
+| **AI / LLM**  | OpenAI (`gpt-4o-mini`, `text-embedding-3-small`) |

+## Prerequisites

+Before you begin, ensure you have the following installed and configured:

+- **Node.js and npm**: Download Node.js (v18 or later recommended).
+- **MongoDB Atlas Account**: A free-tier account is sufficient. Create an account.
+- **OpenAI API Key**: You'll need an API key from OpenAI. Get your key.

+## Setup and Installation

+Follow these steps to get the project running locally.

+### 1. Backend Setup

+First, set up the Node.js server and prepare the database.

+```bash
+# 1. Navigate to the backend directory
+cd backend

+# 2. Install dependencies
+npm install

+# 3. Create a .env file in the `backend` directory
+#    Copy the contents of .env.example (if available) or create it from scratch
+touch .env
+```

+Add the following environment variables to your `.env` file:

+```env
+# Your MongoDB Atlas connection string
+MONGO_URI="mongodb+srv://<user>:<password>@<cluster-url>/?retryWrites=true&w=majority"

+# Your OpenAI API Key
+OPENAI_API_KEY="sk-..."
+```

+### 2. MongoDB Atlas Vector Search Setup

+For the RAG retrieval step to work, you need to create a vector search index in your MongoDB Atlas cluster.

+1.  **Connect to your Cluster**: Log in to your Atlas account and navigate to your cluster.
+2.  **Create Database and Collection**: Create a database named `rag` and a collection named `insurance_embeddings`.
+3.  **Create a Vector Search Index**:
+    - In your `insurance_embeddings` collection, go to the "Search" tab.
+    - Click on "Create Search Index".
+    - Choose the "Atlas Vector Search" -> "JSON Editor" configuration method.
+    - Give the index a name: `insurance_vector_index`.
+    - Paste the following JSON configuration into the editor:

+      ```json
+      {
+        "fields": [
+          {
+            "type": "vector",
+            "path": "embedding",
+            "numDimensions": 512,
+            "similarity": "cosine"
+          }
+        ]
+      }
+      ```

+    - Click "Next" and then "Create Search Index". Wait for the index to finish building.

+4.  **Seed the Database**:
+    Once the index is ready, run the seed script from the `backend` directory. This will populate your collection with vector data.

+    ```bash
+    # Make sure you are in the `backend` directory
+    node seed/seed.js
+    ```

+### 3. Frontend Setup

+Now, set up the React chat interface.

+```bash
+# 1. Open a new terminal and navigate to the frontend directory
+cd rag-chat

+# 2. Install dependencies
+npm install
+```

+The frontend is configured to connect to the backend at `http://localhost:8080`. No further configuration is needed.

+## Running the Application

+1.  **Start the Backend Server**:
+    In your terminal for the `backend` directory:
+    ```bash
+    npm start
+    # Or: node index.js
+    ```
+    You should see the message: `🚀 RAG server running on port 8080`.

+2.  **Start the Frontend Application**:
+    In your terminal for the `rag-chat` directory:
+    ```bash
+    npm run dev
+    ```
+    This will start the React development server. Open your browser and navigate to the URL provided (usually `http://localhost:5173`).

+You can now start asking questions in the chat interface!

+## Project Structure

+```
+MERN-RAG/
+├── backend/
+│   ├── db.js               # MongoDB connection helper
+│   ├── index.js            # Express server and RAG API endpoint
+│   ├── package.json
+│   └── seed/
+│       ├── insurance_data.json # Sample data for seeding
+│       └── seed.js           # Script to generate embeddings and seed DB
+│
+└── rag-chat/ (frontend)
+    ├── public/
+    └── src/
+        ├── App.css
+        ├── App.jsx         # Main React component with chat UI and logic
+        ├── index.css
+        └── main.jsx
+```
