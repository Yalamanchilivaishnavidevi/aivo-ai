import express from "express";
import fs from "fs";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static("public"));

const MEMORY_FILE = "memory.json";

let memory = {
  conversations: [],
  currentChatId: null
};

if (fs.existsSync(MEMORY_FILE)) {
  memory = JSON.parse(fs.readFileSync(MEMORY_FILE));
}

function saveMemory() {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
}

app.get("/conversations", (req, res) => {
  res.json({
    conversations: memory.conversations,
    currentChatId: memory.currentChatId
  });
});

app.post("/new-chat", (req, res) => {
  const newChat = {
    id: Date.now().toString(),
    title: "New Chat",
    messages: []
  };

  memory.conversations.unshift(newChat);
  memory.currentChatId = newChat.id;
  saveMemory();

  res.json(newChat);
});

app.post("/load-chat", (req, res) => {
  const { id } = req.body;
  memory.currentChatId = id;
  saveMemory();
  res.json({ success: true });
});

app.post("/delete-chat", (req, res) => {
  const { id } = req.body;

  memory.conversations = memory.conversations.filter(c => c.id !== id);

  if (memory.currentChatId === id) {
    memory.currentChatId = memory.conversations[0]?.id || null;
  }

  saveMemory();
  res.json({ success: true });
});
// 🔥 MAIN AI ROUTE (CONNECTED TO OLLAMA)

app.post("/chat", async (req, res) => {
  const { message } = req.body;

  if (!memory.currentChatId) {
    return res.json({ reply: "Create a new chat first." });
  }

  const chat = memory.conversations.find(
    c => c.id === memory.currentChatId
  );

  if (!chat) {
    return res.json({ reply: "Chat not found." });
  }

  chat.messages.push({ role: "user", message });

  try {
    const response = await fetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mistral",
        messages: [
          {
            role: "system",
            content:
              "You are AIVO, an advanced AI assistant that helps with business, coding, studies, and life guidance. Respond clearly and intelligently."
          },
          {
            role: "user",
            content: message
          }
        ],
        stream: false
      })
    });

    const data = await response.json();

    const reply = data.message?.content || "No response from model.";

    chat.messages.push({ role: "assistant", message: reply });

    saveMemory();

    res.json({ reply });

  } catch (error) {
    console.error("FULL ERROR:", error);
    res.json({ reply: "Ollama connection failed." });
  }
});

app.listen(3000, () => {
  console.log("🚀 AIVO AI (Local Free Version) running on http://localhost:3000");
});